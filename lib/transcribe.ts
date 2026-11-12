"use client";
import { extractMP3, extractPCM } from "./audio";
import type { Segment } from "./format";
import { codeFromName } from "./languages";

export type Engine = "cloud" | "local";
export type Task = "transcribe" | "translate";

export type TranscribeOptions = {
  engine: Engine;
  language: string; // "auto" or ISO code
  task: Task;
  localModel: string;
  cloudModel: string;
  boost: boolean;
  apiKey?: string;
};

export type Progress = {
  phase: "preparing" | "model" | "extracting" | "transcribing" | "waiting" | "done";
  processed: number; // seconds of media done
  total: number;
  message: string;
  modelProgress?: number; // 0..100 when downloading the model
  device?: string;
};

const CLOUD_WINDOW = 600; // 10 min → ~2.4 MB MP3, under Vercel's 4.5 MB body limit
const LOCAL_WINDOW = 300; // 5 min keeps memory low on phones

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); rej(new DOMException("Aborted", "AbortError")); }, { once: true });
  });

/* ---------------- On-device Whisper worker ---------------- */

type Pending = { resolve: (v: any) => void; reject: (e: Error) => void };

class WorkerClient {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  onDownload?: (p: number, file: string) => void;
  constructor(private url: string) {}

  private ensure() {
    if (this.worker) return this.worker;
    const w = new Worker(this.url, { type: "module" });
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === "download") this.onDownload?.(m.progress ?? 0, m.file ?? "");
      else if (m.id !== undefined && this.pending.has(m.id)) {
        const p = this.pending.get(m.id)!;
        this.pending.delete(m.id);
        if (m.type === "error") p.reject(new Error(m.message));
        else p.resolve(m);
      } else if (m.type === "ready" || m.type === "error") {
        // load() responses have no id; resolve the oldest waiter
        const first = this.pending.entries().next().value as [number, Pending] | undefined;
        if (first) {
          this.pending.delete(first[0]);
          if (m.type === "error") first[1].reject(new Error(m.message));
          else first[1].resolve(m);
        }
      }
    };
    w.onerror = (e) => {
      const err = new Error(e.message || "Worker failed to start");
      this.pending.forEach((p) => p.reject(err));
      this.pending.clear();
    };
    this.worker = w;
    return w;
  }

  call<T = any>(msg: Record<string, unknown>, transfer: Transferable[] = [], withId = true): Promise<T> {
    const w = this.ensure();
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      w.postMessage(withId ? { ...msg, id } : msg, transfer);
    });
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
    const err = new DOMException("Aborted", "AbortError");
    this.pending.forEach((p) => p.reject(err as unknown as Error));
    this.pending.clear();
  }
}

export const whisper = new WorkerClient("/workers/whisper.js");
export const nllb = new WorkerClient("/workers/translate.js");

/* ---------------- Cloud (Groq Whisper large-v3) ---------------- */

async function cloudWindow(
  audio: Blob, offset: number, opts: TranscribeOptions, signal: AbortSignal,
  onWait: (sec: number) => void
): Promise<{ segments: Segment[]; language?: string }> {
  for (let attempt = 0; ; attempt++) {
    const fd = new FormData();
    fd.append("file", audio, `chunk_${offset}.mp3`);
    fd.append("model", opts.cloudModel);
    fd.append("task", opts.task);
    if (opts.language !== "auto") fd.append("language", opts.language);
    const headers: Record<string, string> = {};
    if (opts.apiKey) headers["x-groq-key"] = opts.apiKey;

    let res: Response;
    try {
      res = await fetch("/api/transcribe", { method: "POST", body: fd, headers, signal });
    } catch (err) {
      if (signal.aborted) throw err;
      if (attempt >= 4) throw new Error("Network error — check your connection");
      await sleep(3000 * (attempt + 1), signal);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= 8) throw new Error("The free cloud service is busy. Try again later or use On-device mode.");
      const wait = Math.min(600, Number(res.headers.get("retry-after")) || 20 * (attempt + 1));
      onWait(wait);
      await sleep(wait * 1000, signal);
      continue;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Transcription failed (${res.status})`);
    const segments: Segment[] = (data.segments || []).map((s: any) => ({
      id: 0, start: offset + s.start, end: offset + s.end, text: String(s.text || "").trim(),
    }));
    if (!segments.length && data.text) {
      segments.push({ id: 0, start: offset, end: offset + 5, text: String(data.text).trim() });
    }
    return { segments, language: codeFromName(data.language) };
  }
}

/* ---------------- Orchestrator ---------------- */

function clean(list: Segment[], windowEnd: number): Segment[] {
  const out: Segment[] = [];
  list.forEach((s, i) => {
    const text = s.text.replace(/\s+/g, " ").trim();
    if (!text) return;
    let end = s.end ?? list[i + 1]?.start ?? windowEnd;
    if (!Number.isFinite(end) || end <= s.start) end = Math.min(windowEnd, s.start + 3);
    // Drop Whisper's classic silence hallucination: the same line repeated 3+ times.
    const prev = out[out.length - 1];
    const prev2 = out[out.length - 2];
    if (prev && prev2 && prev.text === text && prev2.text === text) return;
    out.push({ id: 0, start: s.start, end: Math.min(end, windowEnd), text });
  });
  return out;
}

export async function transcribeFile(
  file: File,
  duration: number,
  opts: TranscribeOptions,
  onProgress: (p: Progress) => void,
  onSegments: (all: Segment[]) => void,
  signal: AbortSignal,
  resumeFrom = 0,
  existing: Segment[] = []
): Promise<{ segments: Segment[]; language?: string }> {
  const all: Segment[] = [...existing];
  const win = opts.engine === "cloud" ? CLOUD_WINDOW : LOCAL_WINDOW;
  const total = Math.max(1, duration);
  let detected: string | undefined;
  let device: string | undefined;

  const report = (p: Omit<Progress, "total" | "device">) => onProgress({ ...p, total, device });
  report({ phase: "preparing", processed: resumeFrom, message: "Loading audio engine…" });

  if (opts.engine === "local") {
    whisper.onDownload = (pct, f) =>
      report({ phase: "model", processed: resumeFrom, message: `Downloading AI model (one time) — ${f.split("/").pop()}`, modelProgress: pct });
    report({ phase: "model", processed: resumeFrom, message: "Loading AI model…" });
    const r = await whisper.call<{ device: string }>({ type: "load", model: opts.localModel }, [], false);
    device = r.device;
  }

  const extract = (start: number) => {
    const length = Math.min(win, total - start);
    return opts.engine === "cloud"
      ? extractMP3(file, { start, length, boost: opts.boost })
      : extractPCM(file, { start, length, boost: opts.boost });
  };

  let start = resumeFrom;
  let nextAudio: Promise<Blob | Float32Array> | null = start < total ? extract(start) : null;
  report({ phase: "extracting", processed: start, message: "Extracting audio…" });

  while (nextAudio) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const audio = await nextAudio;
    const windowStart = start;
    const windowEnd = Math.min(total, start + win);
    start = windowEnd;
    // Pre-extract the next window while this one is being recognised.
    nextAudio = start < total - 0.5 ? extract(start) : null;
    nextAudio?.catch(() => {});

    report({ phase: "transcribing", processed: windowStart, message: `Transcribing ${fmt(windowStart)} – ${fmt(windowEnd)}` });

    let segs: Segment[];
    if (opts.engine === "cloud") {
      const r = await cloudWindow(audio as Blob, windowStart, opts, signal, (sec) =>
        report({ phase: "waiting", processed: windowStart, message: `Free-tier limit reached — resuming in ${sec}s…` })
      );
      segs = r.segments;
      detected ??= r.language;
    } else {
      const pcm = audio as Float32Array;
      const r = await whisper.call<{ segments: { start: number; end: number | null; text: string }[] }>(
        { type: "transcribe", model: opts.localModel, audio: pcm, language: opts.language, task: opts.task },
        [pcm.buffer]
      );
      segs = r.segments.map((s) => ({ id: 0, start: windowStart + s.start, end: s.end == null ? (null as unknown as number) : windowStart + s.end, text: s.text }));
    }
    all.push(...clean(segs, windowEnd));
    all.forEach((s, i) => (s.id = i + 1));
    onSegments([...all]);
    report({ phase: "transcribing", processed: windowEnd, message: `Transcribed ${fmt(windowEnd)} of ${fmt(total)}` });
  }

  report({ phase: "done", processed: total, message: "Done!" });
  return { segments: all, language: detected ?? (opts.language !== "auto" ? opts.language : undefined) };
}

function fmt(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

/* ---------------- Translation ---------------- */

export async function translateSegments(
  segments: Segment[],
  src: { code: string; name: string; nllb: string },
  tgt: { code: string; name: string; nllb: string },
  engine: Engine,
  apiKey: string | undefined,
  onProgress: (done: number, total: number, msg?: string) => void,
  signal: AbortSignal
): Promise<Segment[]> {
  const out: Segment[] = segments.map((s) => ({ ...s }));
  const batch = engine === "cloud" ? 40 : 8;
  if (engine === "local") {
    nllb.onDownload = (pct) => onProgress(0, segments.length, `Downloading translation model (one time) — ${Math.round(pct)}%`);
  }
  for (let i = 0; i < segments.length; i += batch) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const slice = segments.slice(i, i + batch);
    let texts: string[];
    if (engine === "cloud") {
      texts = await cloudTranslate(slice.map((s) => s.text), src.name, tgt.name, apiKey, signal, (sec) =>
        onProgress(i, segments.length, `Free-tier limit reached — resuming in ${sec}s…`));
    } else {
      const r = await nllb.call<{ texts: string[] }>({ type: "translate", texts: slice.map((s) => s.text), src: src.nllb, tgt: tgt.nllb });
      texts = r.texts;
    }
    slice.forEach((s, j) => (out[i + j] = { ...s, text: texts[j] ?? s.text }));
    onProgress(Math.min(segments.length, i + batch), segments.length);
  }
  return out;
}

async function cloudTranslate(
  lines: string[], from: string, to: string, apiKey: string | undefined, signal: AbortSignal, onWait: (s: number) => void
): Promise<string[]> {
  for (let attempt = 0; ; attempt++) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (apiKey) headers["x-groq-key"] = apiKey;
    const res = await fetch("/api/translate", { method: "POST", headers, body: JSON.stringify({ lines, from, to }), signal });
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= 8) throw new Error("Translation service is busy. Try again later or use On-device mode.");
      const wait = Math.min(300, Number(res.headers.get("retry-after")) || 15 * (attempt + 1));
      onWait(wait);
      await sleep(wait * 1000, signal);
      continue;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Translation failed");
    return data.lines as string[];
  }
}
