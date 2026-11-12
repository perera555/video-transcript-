"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AudioLevel from "./AudioLevel";
import Dropzone from "./Dropzone";
import { Button, Card, Field, Icon, ProgressBar, Select, Toggle, formatBytes, save, store, useOnline } from "./ui";
import { getFFmpeg, probeDuration, stopFFmpeg } from "@/lib/audio";
import { LANGUAGES, langByCode } from "@/lib/languages";
import { baseName, clock, download, shortClock, toCSV, toCues, toJSON, toSRT, toTXT, toVTT, type Segment } from "@/lib/format";
import { transcribeFile, translateSegments, whisper, nllb, type Engine, type Progress, type Task } from "@/lib/transcribe";

const LOCAL_MODELS = [
  { id: "onnx-community/whisper-base", label: "Balanced — Whisper Base (~150 MB)" },
  { id: "onnx-community/whisper-tiny", label: "Fastest — Whisper Tiny (~75 MB)" },
  { id: "onnx-community/whisper-small", label: "Accurate — Whisper Small (~500 MB, better Sinhala/Tamil)" },
  { id: "onnx-community/whisper-large-v3-turbo", label: "Best — Large v3 Turbo (~1.6 GB, desktop GPU)" },
];
const CLOUD_MODELS = [
  { id: "whisper-large-v3-turbo", label: "Whisper Large v3 Turbo — fast" },
  { id: "whisper-large-v3", label: "Whisper Large v3 — most accurate" },
];

type Settings = { engine: Engine; language: string; task: Task; localModel: string; cloudModel: string; boost: boolean };
type Project = { fileName: string; duration: number; processed: number; segments: Segment[]; translations: Record<string, Segment[]>; language?: string; settings: Settings };

const DEFAULTS: Settings = { engine: "cloud", language: "auto", task: "transcribe", localModel: LOCAL_MODELS[0].id, cloudModel: CLOUD_MODELS[0].id, boost: true };

export default function TranscribeTool({ incoming, panel, onPanel }: {
  incoming: File | null;
  panel: "transcript" | "subtitles";
  onPanel: (p: "transcript" | "subtitles") => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string>("");
  const [duration, setDuration] = useState(0);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [apiKey, setApiKey] = useState("");
  const [serverKey, setServerKey] = useState<boolean | null>(null);
  const [showKey, setShowKey] = useState(false);

  const [status, setStatus] = useState<"idle" | "running" | "done" | "stopped" | "error">("idle");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [processed, setProcessed] = useState(0);
  const [detected, setDetected] = useState<string | undefined>();
  const [translations, setTranslations] = useState<Record<string, Segment[]>>({});
  const [view, setView] = useState("original");
  const [restoredName, setRestoredName] = useState("");

  const [target, setTarget] = useState("si");
  const [transState, setTransState] = useState<{ running: boolean; done: number; total: number; msg?: string; error?: string }>({ running: false, done: 0, total: 0 });

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [showSubs, setShowSubs] = useState(true);
  const [follow, setFollow] = useState(true);
  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const [mediaEl, setMediaEl] = useState<HTMLMediaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stopAt = useRef<number | null>(null);
  const [linePlaying, setLinePlaying] = useState(-1);
  const [readAloud, setReadAloud] = useState(false);
  const [rate, setRate] = useState(1);
  const [paused, setPaused] = useState(true);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const el = mediaEl;
    if (!el) return;
    const on = () => setPaused(el.paused);
    el.addEventListener("play", on); el.addEventListener("pause", on);
    return () => { el.removeEventListener("play", on); el.removeEventListener("pause", on); };
  }, [mediaEl]);
  const transAbort = useRef<AbortController | null>(null);
  const startedAt = useRef<{ t: number; from: number }>({ t: 0, from: 0 });
  const listRef = useRef<HTMLDivElement>(null);

  /* ---------- load persisted state ---------- */
  useEffect(() => {
    setSettings({ ...DEFAULTS, ...store<Partial<Settings>>("vtg-settings", {}) });
    setApiKey(store("vtg-key", ""));
    const p = store<Project | null>("vtg-project", null);
    if (p?.segments?.length) {
      setSegments(p.segments);
      setTranslations(p.translations || {});
      setProcessed(p.processed || 0);
      setDuration(p.duration || 0);
      setDetected(p.language);
      setRestoredName(p.fileName);
      setStatus(p.processed >= p.duration - 1 ? "done" : "stopped");
    }
    fetch("/api/config").then((r) => r.json()).then((d) => setServerKey(!!d.serverKey)).catch(() => setServerKey(false));
  }, []);

  const online = useOnline();
  const cloudReady = !!apiKey || !!serverKey;
  const cloudOK = cloudReady && online;

  /* ---------- offline preparation ---------- */
  const [offlinePrep, setOfflinePrep] = useState<{ state: "idle" | "working" | "ready" | "error"; msg: string; pct: number }>({ state: "idle", msg: "", pct: 0 });
  useEffect(() => {
    const ready = store<Record<string, boolean>>("vtg-offline", {});
    setOfflinePrep((p) => (p.state === "working" ? p : { state: ready[settings.localModel] ? "ready" : "idle", msg: "", pct: 0 }));
  }, [settings.localModel]);
  const prepareOffline = async (withTranslation: boolean) => {
    setOfflinePrep({ state: "working", msg: "Downloading audio engine…", pct: 5 });
    try {
      await getFFmpeg();
      whisper.onDownload = (pct) => setOfflinePrep({ state: "working", msg: "Downloading speech AI model…", pct });
      await whisper.call({ type: "load", model: settings.localModel }, [], false);
      if (withTranslation) {
        nllb.onDownload = (pct) => setOfflinePrep({ state: "working", msg: "Downloading translation model…", pct });
        await nllb.call({ type: "load" });
      }
      save("vtg-offline", { ...store<Record<string, boolean>>("vtg-offline", {}), [settings.localModel]: true, ...(withTranslation ? { nllb: true } : {}) });
      setOfflinePrep({ state: "ready", msg: "", pct: 100 });
    } catch (e: any) {
      setOfflinePrep({ state: "error", msg: e?.message || "Download failed — check your internet", pct: 0 });
    }
  };
  useEffect(() => {
    if (serverKey === null) return;
    if (!cloudReady && settings.engine === "cloud" && !store<Partial<Settings>>("vtg-settings", {}).engine) {
      setSettings((s) => ({ ...s, engine: "local" }));
    }
  }, [serverKey, cloudReady, settings.engine]);

  const update = (patch: Partial<Settings>) => setSettings((s) => { const n = { ...s, ...patch }; save("vtg-settings", n); return n; });

  const persist = useCallback((p: Partial<Project>) => {
    const prev = store<Project | null>("vtg-project", null);
    save("vtg-project", { ...(prev || {}), ...p });
  }, []);

  /* ---------- file selection ---------- */
  const pickFile = useCallback(async (f: File) => {
    abortRef.current?.abort();
    setFile(f);
    setFileUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(f); });
    setError("");
    const sameAsRestored = restoredName && restoredName === f.name;
    if (!sameAsRestored) {
      setSegments([]); setTranslations({}); setProcessed(0); setView("original"); setStatus("idle"); setDetected(undefined); setRestoredName("");
    }
    if (!sameAsRestored) setAskLang(true);
    const d = await probeDuration(f).catch(() => 0);
    setDuration(d);
  }, [restoredName]);

  useEffect(() => { if (incoming) pickFile(incoming); }, [incoming]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- language question after upload ---------- */
  const [askLang, setAskLang] = useState(false);
  const [wantLang, setWantLang] = useState<string>("original");
  const startFromDialog = () => {
    setAskLang(false);
    const spoken = settings.language;
    let task: Task = "transcribe";
    let thenTranslate: string | undefined;
    if (wantLang === "en" && spoken !== "en") task = "translate"; // Whisper translates speech → English directly
    else if (wantLang !== "original" && wantLang !== spoken) thenTranslate = wantLang;
    update({ task });
    run(false, { task }, thenTranslate);
  };

  /* ---------- run ---------- */
  const run = async (resume: boolean, override: Partial<Settings> = {}, thenTranslateTo?: string) => {
    if (!file) return;
    const cfg = { ...settings, ...override };
    // Offline → always use the on-device engine.
    const engine: Engine = online ? cfg.engine : "local";
    if (engine === "cloud" && !cloudReady) { setShowKey(true); setError("Add a free Groq API key for Cloud mode, or choose On-device mode."); return; }
    setError("");
    setStatus("running");
    const from = resume ? processed : 0;
    const existing = resume ? segments : [];
    if (!resume) { setSegments([]); setTranslations({}); setView("original"); }
    startedAt.current = { t: 0, from };
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let lock: { release: () => Promise<void> } | null = null;
    try { lock = await (navigator as any).wakeLock?.request("screen"); } catch {}
    try {
      const total = duration || (await probeDuration(file));
      if (!total) throw new Error("Couldn't read the length of this file. Try converting it to MP4 or MP3.");
      setDuration(total);
      persist({ fileName: file.name, duration: total, settings: cfg, translations: {} });
      const res = await transcribeFile(
        file, total,
        { ...cfg, engine, apiKey: apiKey || undefined },
        (p) => {
          if (p.phase === "transcribing" && !startedAt.current.t) startedAt.current = { t: Date.now(), from: p.processed };
          setProgress(p);
          setProcessed(p.processed);
        },
        (segs) => { setSegments(segs); persist({ segments: segs }); },
        ctrl.signal, from, existing
      );
      setDetected(res.language);
      setStatus("done");
      persist({ processed: total, segments: res.segments, language: res.language });
      if (thenTranslateTo) {
        lock?.release().catch(() => {});
        lock = null;
        await translate({ segs: res.segments, tgtCode: thenTranslateTo, srcCode: cfg.task === "translate" ? "en" : res.language ?? (cfg.language !== "auto" ? cfg.language : "en") });
      }
    } catch (e: any) {
      if (e?.name === "AbortError") { setStatus("stopped"); }
      else { setStatus("error"); setError(e?.message || String(e)); }
    } finally {
      lock?.release().catch(() => {});
      abortRef.current = null;
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    whisper.terminate();
    stopFFmpeg();
    setStatus("stopped");
    setProcessed((p) => { persist({ processed: p }); return p; });
  };

  /* ---------- translation ---------- */
  const translate = async (opts: { segs?: Segment[]; tgtCode?: string; srcCode?: string } = {}) => {
    const segs = opts.segs ?? segments;
    const tgtCode = opts.tgtCode ?? target;
    const tgt = langByCode(tgtCode);
    const srcCode = opts.srcCode ?? (settings.task === "translate" ? "en" : detected ?? (settings.language !== "auto" ? settings.language : "en"));
    const src = langByCode(srcCode) ?? langByCode("en");
    if (!tgt || !src || !segs.length) return;
    if (opts.tgtCode) setTarget(tgtCode);
    const ctrl = new AbortController();
    transAbort.current = ctrl;
    setTransState({ running: true, done: 0, total: segs.length });
    try {
      const out = await translateSegments(
        segs, src, tgt, cloudOK ? "cloud" : "local", apiKey || undefined,
        (done, total, msg) => setTransState({ running: true, done, total, msg }), ctrl.signal
      );
      setTranslations((t) => { const n = { ...t, [tgtCode]: out }; persist({ translations: n }); return n; });
      setView(tgtCode);
      setTransState({ running: false, done: segs.length, total: segs.length });
    } catch (e: any) {
      setTransState({ running: false, done: 0, total: 0, error: e?.name === "AbortError" ? undefined : e?.message });
    }
  };

  /* ---------- derived ---------- */
  const shown = view === "original" ? segments : translations[view] ?? segments;
  const vttUrl = useMemo(() => (shown.length ? URL.createObjectURL(new Blob([toVTT(shown)], { type: "text/vtt" })) : ""), [shown]);
  useEffect(() => () => { if (vttUrl) URL.revokeObjectURL(vttUrl); }, [vttUrl]);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    const onTime = () => {
      const t = el.currentTime;
      let lo = 0, hi = shown.length - 1, idx = -1;
      while (lo <= hi) { const m = (lo + hi) >> 1; if (shown[m].start <= t) { idx = m; lo = m + 1; } else hi = m - 1; }
      setActive(idx >= 0 && t <= shown[idx].end + 0.6 ? idx : -1);
      setNow(t);
      // "Play this line" mode: stop at the end of the line.
      if (stopAt.current != null && t >= stopAt.current) { el.pause(); stopAt.current = null; setLinePlaying(-1); }
    };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [shown, fileUrl]);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el || !el.textTracks[0]) return;
    el.textTracks[0].mode = showSubs ? "showing" : "hidden";
  }, [showSubs, vttUrl]);

  useEffect(() => {
    if (!follow || active < 0 || query) return;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`);
    const box = listRef.current;
    if (row && box) box.scrollTo({ top: row.offsetTop - box.clientHeight / 3, behavior: "smooth" });
  }, [active, follow, query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shown.map((s, i) => ({ s, i })).filter(({ s }) => !q || s.text.toLowerCase().includes(q));
  }, [shown, query]);
  const cues = useMemo(() => (panel === "subtitles" ? toCues(shown) : []), [panel, shown]);
  const [subSize, setSubSize] = useState(100);
  const activeCue = useMemo(() => {
    if (panel !== "subtitles" || active < 0) return -1;
    const t = shown[active]?.start ?? -1;
    return cues.findIndex((c) => c.end >= t);
  }, [panel, active, cues, shown]);

  const editSeg = (i: number, text: string) => {
    if (view === "original") setSegments((all) => { const n = all.map((s, j) => (j === i ? { ...s, text } : s)); persist({ segments: n }); return n; });
    else setTranslations((t) => { const n = { ...t, [view]: t[view].map((s, j) => (j === i ? { ...s, text } : s)) }; persist({ translations: n }); return n; });
  };

  const [editing, setEditing] = useState(-1);
  const [draft, setDraft] = useState("");
  const [savedAt, setSavedAt] = useState("");
  const deleteSeg = (i: number) => {
    const drop = (list: Segment[]) => list.filter((_, j) => j !== i).map((s, j) => ({ ...s, id: j + 1 }));
    if (view === "original") {
      // Keep translations aligned with the original lines.
      setSegments((all) => { const n = drop(all); persist({ segments: n }); return n; });
      setTranslations((t) => { const n = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, drop(v)])); persist({ translations: n }); return n; });
    } else {
      setTranslations((t) => { const n = { ...t, [view]: drop(t[view]) }; persist({ translations: n }); return n; });
    }
    setEditing(-1);
  };
  const saveProject = () => {
    persist({ fileName: file?.name || restoredName, duration, processed, segments, translations, language: detected });
    setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  };

  const seek = (t: number) => { const el = mediaRef.current; if (el) { stopAt.current = null; setLinePlaying(-1); el.currentTime = t + 0.01; el.play().catch(() => {}); } };

  /* ---------- Listen & Read ---------- */
  const playLine = (i: number) => {
    const el = mediaRef.current;
    const s = shown[i];
    if (!el || !s) return;
    if (linePlaying === i && !el.paused) { el.pause(); stopAt.current = null; setLinePlaying(-1); return; }
    el.currentTime = s.start + 0.01;
    stopAt.current = s.end + 0.15;
    setLinePlaying(i);
    el.play().catch(() => {});
  };
  const speak = (text: string) => {
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const lang = view === "original" ? (settings.task === "translate" ? "en" : detected || (settings.language !== "auto" ? settings.language : "en")) : view;
      u.lang = lang;
      const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang));
      if (voice) u.voice = voice;
      u.rate = rate;
      synth.speak(u);
    } catch {}
  };
  // Read-aloud mode: speak each line as it becomes active (video muted meanwhile).
  useEffect(() => {
    const el = mediaRef.current;
    if (el) el.muted = readAloud;
    if (!readAloud) { try { window.speechSynthesis.cancel(); } catch {} return; }
    if (active >= 0 && shown[active]) speak(shown[active].text);
  }, [readAloud, active]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const el = mediaRef.current; if (el) el.playbackRate = rate; }, [rate, fileUrl]);
  const step = (dir: 1 | -1) => {
    const cur = active >= 0 ? active : 0;
    const n = Math.max(0, Math.min(shown.length - 1, cur + dir));
    if (shown[n]) seek(shown[n].start);
  };
  const togglePlay = () => { const el = mediaRef.current; if (!el) return; if (el.paused) el.play().catch(() => {}); else el.pause(); };

  const name = baseName(file?.name || restoredName || "transcript") + (view === "original" ? "" : `.${view}`);
  const exp = (kind: string) => {
    const meta = { file: file?.name || restoredName, language: view === "original" ? detected : view, duration };
    const map: Record<string, [string, string, string?]> = {
      srt: [`${name}.srt`, toSRT(shown), "application/x-subrip;charset=utf-8"],
      vtt: [`${name}.vtt`, toVTT(shown), "text/vtt;charset=utf-8"],
      txt: [`${name}.txt`, toTXT(shown, false)],
      txtt: [`${name}.timestamps.txt`, toTXT(shown, true)],
      csv: [`${name}.csv`, toCSV(shown), "text/csv;charset=utf-8"],
      json: [`${name}.json`, toJSON(shown, meta), "application/json"],
    };
    const [n, c, m] = map[kind];
    download(n, c, m);
  };
  const [copied, setCopied] = useState(false);
  /* ---------- Grab everything: one ZIP with transcript, subtitles & audio ---------- */
  const [pack, setPack] = useState<{ running: boolean; msg: string; pct: number; error?: string }>({ running: false, msg: "", pct: 0 });
  const [packAudio, setPackAudio] = useState(true);
  const grabAll = async () => {
    const base = baseName(file?.name || restoredName || "transcript");
    setPack({ running: true, msg: "Preparing transcript & subtitles…", pct: 0 });
    try {
      const { zip, strToU8 } = await import("fflate");
      const enc = (s: string) => strToU8("﻿" + s);
      const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {};
      const meta = { file: file?.name || restoredName, language: detected, duration };
      const addSet = (segs: Segment[], suffix: string, folder: string) => {
        files[`${folder}/${base}${suffix}.srt`] = enc(toSRT(segs));
        files[`${folder}/${base}${suffix}.vtt`] = enc(toVTT(segs));
      };
      files[`transcript/${base}.txt`] = enc(toTXT(segments, false));
      files[`transcript/${base}.timestamps.txt`] = enc(toTXT(segments, true));
      files[`transcript/${base}.csv`] = enc(toCSV(segments));
      files[`transcript/${base}.json`] = strToU8(toJSON(segments, meta));
      addSet(segments, "", "subtitles");
      for (const [code, segs] of Object.entries(translations)) {
        addSet(segs, `.${code}`, "subtitles");
        files[`transcript/${base}.${code}.txt`] = enc(toTXT(segs, false));
      }
      if (packAudio && file) {
        const a = await grabAudio();
        if (a) files[`audio/${a.name}`] = [new Uint8Array(await a.blob.arrayBuffer()), { level: 0 }];
      }
      setPack({ running: true, msg: "Packing ZIP…", pct: 100 });
      const data = await new Promise<Uint8Array>((res, rej) => zip(files, { level: 6 }, (err, out) => (err ? rej(err) : res(out))));
      download(`${base}-all.zip`, new Blob([data as BlobPart], { type: "application/zip" }));
      setPack({ running: false, msg: "Downloaded!", pct: 100 });
    } catch (e: any) {
      setPack({ running: false, msg: "", pct: 0, error: e?.message || "Could not create the package" });
    }
  };

  const grabAudio = async () => {
    if (!file) return null;
    const base = baseName(file.name);
    const { extractFullAudio } = await import("@/lib/audio");
    setPack({ running: true, msg: "Extracting audio from the video…", pct: 0 });
    const { blob, ext } = await extractFullAudio(file, { format: "mp3", bitrate: "128k", boost: false, mono: false },
      (p) => setPack({ running: true, msg: `Extracting audio… ${Math.round(p * 100)}%`, pct: p * 100 }));
    return { blob, name: `${base}.${ext}` };
  };

  /** Each item as its own download (browsers may ask once to allow multiple downloads). */
  const grabSeparate = async () => {
    const base = baseName(file?.name || restoredName || "transcript");
    const wait = () => new Promise((r) => setTimeout(r, 450));
    try {
      setPack({ running: true, msg: "Downloading transcript & subtitles…", pct: 10 });
      const items: [string, string, string?][] = [
        [`${base}.txt`, toTXT(segments, false)],
        [`${base}.timestamps.txt`, toTXT(segments, true)],
        [`${base}.srt`, toSRT(segments), "application/x-subrip;charset=utf-8"],
        [`${base}.vtt`, toVTT(segments), "text/vtt;charset=utf-8"],
      ];
      for (const [code, segs] of Object.entries(translations)) {
        items.push([`${base}.${code}.srt`, toSRT(segs), "application/x-subrip;charset=utf-8"]);
        items.push([`${base}.${code}.txt`, toTXT(segs, false)]);
      }
      for (const [n, c, m] of items) { download(n, c, m); await wait(); }
      if (packAudio && file) {
        const a = await grabAudio();
        if (a) download(a.name, a.blob);
      }
      setPack({ running: false, msg: "Downloaded!", pct: 100 });
    } catch (e: any) {
      setPack({ running: false, msg: "", pct: 0, error: e?.message || "Download failed" });
    }
  };
  const downloadAudioOnly = async () => {
    try {
      const a = await grabAudio();
      if (a) download(a.name, a.blob);
      setPack({ running: false, msg: "", pct: 100 });
    } catch (e: any) {
      setPack({ running: false, msg: "", pct: 0, error: e?.message || "Audio extraction failed" });
    }
  };

  const copyAll = async () => { try { await navigator.clipboard.writeText(toTXT(shown, false)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} };

  const pct = progress && duration ? (progress.processed / duration) * 100 : 0;
  const eta = (() => {
    if (!progress || status !== "running" || !startedAt.current.t) return "";
    const doneSec = progress.processed - startedAt.current.from;
    if (doneSec < 30) return "";
    const elapsed = (Date.now() - startedAt.current.t) / 1000;
    const remain = ((duration - progress.processed) / doneSec) * elapsed;
    return `~${shortClock(remain)} left`;
  })();

  const running = status === "running";
  const GrabAll = (
    <div className="mt-4 rounded-2xl bg-gradient-to-br from-emerald-600 via-green-600 to-lime-600 p-4 text-white shadow-lg shadow-emerald-700/30">
      <p className="flex items-center gap-2 text-sm font-extrabold"><Icon name="sparkle" className="h-4 w-4" /> Grab everything from this video</p>
      <p className="mt-1 text-xs text-white/85">One ZIP: transcript (TXT, CSV, JSON) · subtitles (SRT, VTT{Object.keys(translations).length ? " + translations" : ""}){packAudio ? " · MP3 audio" : ""}</p>
      <label className="mt-3 flex items-center gap-2 text-xs font-semibold">
        <input type="checkbox" checked={packAudio} disabled={!file || pack.running} onChange={(e) => setPackAudio(e.target.checked)} className="h-4 w-4 accent-white" />
        Include audio (MP3){!file && " — load the video first"}
      </label>
      {pack.running && <div className="mt-3 space-y-1"><div className="h-2 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-white transition-all" style={{ width: `${Math.max(3, pack.pct)}%` }} /></div><p className="text-xs">{pack.msg}</p></div>}
      {pack.error && <p className="mt-2 text-xs font-semibold text-rose-100">{pack.error}</p>}
      <button onClick={grabAll} disabled={pack.running || running || !segments.length}
        className="btn mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-emerald-800 shadow-[0_4px_0_#065f46]">
        <Icon name="download" className="h-4 w-4" /> {pack.running ? "Working…" : pack.msg === "Downloaded!" ? "Downloaded ✓ — download again" : "Download all (ZIP)"}
      </button>
      <button onClick={grabSeparate} disabled={pack.running || running || !segments.length}
        className="btn mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/50 hover:bg-white/25">
        <Icon name="download" className="h-4 w-4" /> Download each file separately
      </button>
    </div>
  );

  const isAudio = file?.type.startsWith("audio") || /\.(mp3|wav|m4a|aac|ogg|opus|flac|wma)$/i.test(file?.name || "");
  const canResume = (status === "stopped" || status === "error") && processed > 0 && processed < duration - 1 && !!file;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {/* ------------ LEFT: upload, settings, player ------------ */}
      <div className="flex min-w-0 flex-col gap-5">
        {!file ? (
          <Dropzone onFile={pickFile} accept="video/*,audio/*,.mkv,.avi,.mov,.wmv,.flv,.m4a,.opus,.flac"
            title="Drop your movie, video or audio here"
            subtitle="MP4 · MKV · MOV · AVI · WEBM · MP3 · WAV · M4A — any length, 2–4 hour movies welcome" />
        ) : (
          <Card className="fade-up !p-3 sm:!p-4">
            <div className="overflow-hidden rounded-2xl bg-emerald-950">
              {isAudio ? (
                <div className="flex flex-col items-center gap-4 p-6">
                  <div className="btn-gradient flex h-20 w-20 items-center justify-center rounded-3xl text-white shadow-lg"><Icon name="music" className="h-10 w-10" /></div>
                  <div className="min-h-[3rem] px-2 text-center text-lg font-semibold text-white">{active >= 0 && showSubs ? shown[active]?.text : " "}</div>
                  <audio ref={(el) => { (mediaRef as any).current = el; setMediaEl(el); }} src={fileUrl} controls className="w-full" />
                </div>
              ) : (
                <video ref={(el) => { (mediaRef as any).current = el; setMediaEl(el); }} src={fileUrl} controls playsInline className="aspect-video w-full bg-black">
                  {vttUrl && <track key={vttUrl} kind="subtitles" src={vttUrl} srcLang={view === "original" ? detected || "en" : view} label="Subtitles" default />}
                </video>
              )}
            </div>
            <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-1.5 ring-1 ring-emerald-100">
              <AudioLevel media={mediaEl} className="!h-8" />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-emerald-950">{file.name}</p>
                <p className="text-xs text-emerald-900/55">{formatBytes(file.size)}{duration ? ` · ${shortClock(duration)}` : ""}</p>
              </div>
              <div className="flex gap-2">
                {!isAudio && <Button variant="ghost" onClick={() => setShowSubs((v) => !v)} className="!py-1.5 !text-xs"><Icon name="captions" className="h-4 w-4" />{showSubs ? "Hide" : "Show"} subs</Button>}
                <Button variant="ghost" disabled={running} onClick={() => { setFile(null); setFileUrl(""); }} className="!py-1.5 !text-xs">Change file</Button>
              </div>
            </div>

            {/* ---- Listen & Read: watch/listen while reading along ---- */}
            {shown.length > 0 && (
              <div className="mt-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-lime-50 p-4 ring-1 ring-emerald-100">
                <p className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-700"><Icon name="play" className="h-4 w-4" /> Listen &amp; Read</p>
                <div className="space-y-1.5 text-center">
                  <p className="min-h-[1.25rem] truncate text-sm text-emerald-900/40">{active > 0 ? shown[active - 1]?.text : " "}</p>
                  <p key={active} className="fade-up min-h-[3.5rem] text-xl font-extrabold leading-snug sm:text-2xl">
                    {active >= 0 && shown[active] ? (() => {
                      // Karaoke: highlight words in step with the voice.
                      const s = shown[active];
                      const words = s.text.split(/\s+/);
                      const frac = Math.max(0, Math.min(1, (now - s.start) / Math.max(0.3, s.end - s.start)));
                      const lit = Math.ceil(frac * words.length);
                      return words.map((w, k) => (
                        <span key={k} className={`transition-colors duration-200 ${k < lit ? "text-emerald-700" : "text-emerald-950/35"}`}>{w}{k < words.length - 1 ? " " : ""}</span>
                      ));
                    })() : <span className="text-emerald-950">Press play — the current line appears here</span>}
                  </p>
                  <p className="min-h-[1.25rem] truncate text-sm text-emerald-900/40">{shown[(active >= 0 ? active : -1) + 1]?.text ?? " "}</p>
                </div>
                {/* Timeline: transcript blocks scroll past the playhead in sync with the voice */}
                <div className="relative mt-4 h-20 overflow-hidden rounded-xl bg-emerald-950 ring-1 ring-emerald-900/20">
                  <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0,transparent_calc(10%-1px),rgba(255,255,255,.07)_calc(10%-1px),rgba(255,255,255,.07)_10%)]" />
                  {shown.map((s, k) => {
                    const WIN = 20; // seconds visible
                    const left = ((s.start - now) / WIN + 0.5) * 100;
                    const width = ((s.end - s.start) / WIN) * 100;
                    if (left > 105 || left + width < -5) return null;
                    const on = k === active;
                    return (
                      <button key={k} onClick={() => seek(s.start)} title={s.text}
                        className={`absolute top-3 h-14 overflow-hidden rounded-lg px-1.5 py-1 text-left text-[10px] leading-tight transition-[left] duration-300 ease-linear ${on ? "bg-gradient-to-br from-lime-300 to-emerald-400 font-bold text-emerald-950 shadow-lg" : "bg-white/15 text-white/85 hover:bg-white/25"}`}
                        style={{ left: `${left}%`, width: `calc(${Math.max(width, 1.5)}% - 3px)` }}>
                        {s.text}
                      </button>
                    );
                  })}
                  <div className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-lime-300 shadow-[0_0_12px_#bef264]" />
                  <span className="pointer-events-none absolute left-1/2 top-0.5 -translate-x-1/2 rounded bg-lime-300 px-1 font-mono text-[9px] font-bold text-emerald-950">{shortClock(now)}</span>
                </div>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button onClick={() => step(-1)} aria-label="Previous line" className="btn btn-ghost flex h-11 w-11 items-center justify-center rounded-full text-emerald-800">⏮</button>
                  <button onClick={togglePlay} aria-label={paused ? "Play" : "Pause"} className="btn btn-gradient flex h-14 w-14 items-center justify-center rounded-full text-white">
                    {paused ? <Icon name="play" className="h-6 w-6" /> : <span className="text-xl font-black">❚❚</span>}
                  </button>
                  <button onClick={() => step(1)} aria-label="Next line" className="btn btn-ghost flex h-11 w-11 items-center justify-center rounded-full text-emerald-800">⏭</button>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <div className="flex rounded-xl bg-emerald-900/5 p-1">
                    {[0.75, 1, 1.25, 1.5].map((r) => (
                      <button key={r} onClick={() => setRate(r)} className={`rounded-lg px-2.5 py-1 text-xs font-bold ${rate === r ? "bg-white text-emerald-800 shadow" : "text-emerald-900/60"}`}>{r}×</button>
                    ))}
                  </div>
                  <button onClick={() => setReadAloud((v) => !v)}
                    className={`btn inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${readAloud ? "btn-gradient text-white" : "btn-ghost text-emerald-900"}`}>
                    🔊 {readAloud ? "Reading aloud" : "Read text aloud"}
                  </button>
                </div>
                <p className="mt-2 text-center text-[11px] text-emerald-900/50">Tip: “Read text aloud” speaks each line in the selected language — great for listening to translations.</p>
              </div>
            )}
          </Card>
        )}

        {askLang && file && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-emerald-950/45 p-4 backdrop-blur-sm sm:items-center" onClick={() => setAskLang(false)}>
            <div className="glass-solid fade-up w-full max-w-lg rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start gap-3">
                <div className="btn-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"><Icon name="globe" className="h-6 w-6" /></div>
                <div className="min-w-0">
                  <h3 className="text-lg font-extrabold text-emerald-950">Choose languages</h3>
                  <p className="truncate text-sm text-emerald-900/60">{file.name}</p>
                </div>
              </div>

              <div className="mt-5 space-y-5">
                <Field label="1 · What language is spoken in this video?">
                  <Select value={settings.language} onChange={(e) => update({ language: e.target.value })}>
                    <option value="auto">🌐 Not sure — detect automatically</option>
                    {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name} — {l.native}</option>)}
                  </Select>
                </Field>

                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-800/60">2 · Transcript &amp; subtitles in which language?</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button onClick={() => setWantLang("original")}
                      className={`rounded-2xl px-4 py-3 text-left ring-1 transition ${wantLang === "original" ? "btn-gradient text-white ring-transparent" : "bg-white ring-emerald-900/10 hover:bg-emerald-50"}`}>
                      <span className="block text-sm font-bold">Original language</span>
                      <span className={`block text-xs ${wantLang === "original" ? "text-white/85" : "text-emerald-900/55"}`}>Same as spoken</span>
                    </button>
                    <button onClick={() => setWantLang(wantLang === "original" ? "en" : wantLang)}
                      className={`rounded-2xl px-4 py-3 text-left ring-1 transition ${wantLang !== "original" ? "btn-gradient text-white ring-transparent" : "bg-white ring-emerald-900/10 hover:bg-emerald-50"}`}>
                      <span className="block text-sm font-bold">Other language</span>
                      <span className={`block text-xs ${wantLang !== "original" ? "text-white/85" : "text-emerald-900/55"}`}>Translate automatically</span>
                    </button>
                  </div>
                  {wantLang !== "original" && (
                    <div className="mt-3">
                      <Select value={wantLang} onChange={(e) => setWantLang(e.target.value)}>
                        {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name} — {l.native}</option>)}
                      </Select>
                      <p className="mt-1.5 text-xs text-emerald-900/55">
                        You&apos;ll get both: the original transcript and the {langByCode(wantLang)?.name} version (switch between them above the transcript).
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex gap-2">
                <Button variant="ghost" onClick={() => setAskLang(false)} className="!py-3">Later</Button>
                <Button onClick={startFromDialog} className="flex-1 !py-3 !text-base"><Icon name="sparkle" /> Start</Button>
              </div>
            </div>
          </div>
        )}

        {restoredName && !file && (
          <div className="rounded-2xl bg-lime-50 px-4 py-3 text-sm text-lime-900 ring-1 ring-lime-200">
            Restored your last transcript of <b>{restoredName}</b>. Load the same file again to preview it with subtitles{status === "stopped" ? " or resume" : ""}.
          </div>
        )}

        <Card>
          <h3 className="mb-4 flex items-center gap-2 text-base font-bold"><Icon name="sparkle" className="h-5 w-5 text-emerald-600" /> Settings</h3>
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-emerald-900/5 p-1.5">
            {([
              ["cloud", "bolt", "Cloud AI", "Fastest · best accuracy"],
              ["local", "shield", "On-device", "Private · works offline"],
            ] as const).map(([id, icon, title, sub]) => (
              <button key={id} disabled={running} onClick={() => update({ engine: id })}
                className={`flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${settings.engine === id ? "btn-gradient text-white shadow-lg shadow-emerald-700/25" : "bg-white/70 text-emerald-950 hover:bg-white"}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${settings.engine === id ? "bg-white/25 text-white" : "bg-emerald-100 text-emerald-700"}`}><Icon name={icon} className="h-4.5 w-4.5" /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{title}{settings.engine === id && " ✓"}</span>
                  <span className={`block truncate text-[11px] ${settings.engine === id ? "text-white/85" : "text-emerald-900/60"}`}>{sub}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Spoken language">
              <Select value={settings.language} disabled={running} onChange={(e) => update({ language: e.target.value })}>
                <option value="auto">🌐 Auto-detect</option>
                {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name} — {l.native}</option>)}
              </Select>
            </Field>
            <Field label="Output">
              <Select value={settings.task} disabled={running} onChange={(e) => update({ task: e.target.value as Task })}>
                <option value="transcribe">Same language as spoken</option>
                <option value="translate">Translate to English</option>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              {settings.engine === "local" ? (
                <Field label="AI model" hint="Downloaded once, then cached. Uses your GPU (WebGPU) when available.">
                  <Select value={settings.localModel} disabled={running} onChange={(e) => update({ localModel: e.target.value })}>
                    {LOCAL_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </Select>
                </Field>
              ) : (
                <Field label="AI model" hint="Runs on Groq's free tier. Very long movies may pause briefly for rate limits — it resumes automatically.">
                  <Select value={settings.cloudModel} disabled={running} onChange={(e) => update({ cloudModel: e.target.value })}>
                    {CLOUD_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </Select>
                </Field>
              )}
            </div>
          </div>

          {!online && (
            <div className="mt-4 rounded-2xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200">
              <b>You&apos;re offline.</b> On-device AI will be used automatically{offlinePrep.state === "ready" ? " — your model is downloaded and ready." : ". It works if the model was downloaded earlier while online."}
            </div>
          )}

          {(settings.engine === "local" || !online) && (
            <div className="mt-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-lime-50 p-3 ring-1 ring-emerald-100">
              {offlinePrep.state === "ready" ? (
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><Icon name="shield" className="h-4 w-4" /> Ready offline — this model works without internet.</p>
              ) : offlinePrep.state === "working" ? (
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-emerald-900">{offlinePrep.msg}</p>
                  <ProgressBar value={offlinePrep.pct} />
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 text-xs text-emerald-900/70"><b className="text-emerald-900">Use without internet:</b> download the AI model once, then transcribe anywhere — even in airplane mode.</p>
                  <Button variant="soft" disabled={!online} onClick={() => prepareOffline(false)} className="!py-2 !text-xs"><Icon name="download" className="h-3.5 w-3.5" /> Make available offline</Button>
                  <Button variant="ghost" disabled={!online} onClick={() => prepareOffline(true)} className="!py-2 !text-xs">+ offline translation</Button>
                </div>
              )}
              {offlinePrep.state === "error" && <p className="mt-1 text-xs text-rose-700">{offlinePrep.msg}</p>}
            </div>
          )}

          <div className="mt-4 border-t border-emerald-900/10 pt-4">
            <Toggle checked={settings.boost} onChange={(v) => update({ boost: v })}
              label="Voice boost" hint="Cleans rumble/hiss and levels the audio so quiet dialogue under music is recognised better" />
          </div>

          {settings.engine === "cloud" && (
            <div className="mt-4 rounded-2xl bg-emerald-50/80 p-3 ring-1 ring-emerald-100">
              <button onClick={() => setShowKey((v) => !v)} className="flex w-full items-center justify-between text-left text-sm font-semibold text-emerald-900">
                <span className="flex items-center gap-2"><Icon name="key" className="h-4 w-4" />
                  {serverKey ? "Cloud AI is ready (shared free key)" : apiKey ? "Your Groq key is saved" : "Add your free Groq API key"}
                </span>
                <span className="text-xs text-emerald-700">{showKey ? "Hide" : "Edit"}</span>
              </button>
              {showKey && (
                <div className="mt-3 space-y-2">
                  <input type="password" value={apiKey} placeholder="gsk_…" autoComplete="off"
                    onChange={(e) => { setApiKey(e.target.value.trim()); save("vtg-key", e.target.value.trim()); }}
                    className="w-full rounded-xl bg-white px-3 py-2.5 font-mono text-sm ring-1 ring-emerald-900/15 outline-none focus:ring-2 focus:ring-emerald-500" />
                  <p className="text-xs text-emerald-900/60">
                    Free, no credit card: create one at{" "}
                    <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="font-semibold text-emerald-700 underline">console.groq.com/keys</a>.
                    It stays in this browser only.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            {!running ? (
              <>
                <Button onClick={() => run(false)} disabled={!file} className="flex-1 !py-3 !text-base">
                  <Icon name="sparkle" /> {segments.length ? "Transcribe again" : "Generate transcript & subtitles"}
                </Button>
                {canResume && <Button variant="soft" onClick={() => run(true)} className="!py-3">Resume from {shortClock(processed)}</Button>}
              </>
            ) : (
              <Button variant="danger" onClick={stop} className="flex-1 !py-3"><Icon name="stop" /> Stop</Button>
            )}
          </div>

          {(running || progress?.phase === "done") && progress && (
            <div className="mt-5 space-y-2 fade-up">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium text-emerald-900">{progress.message}</span>
                <span className="shrink-0 font-mono text-xs text-emerald-900/60">{progress.phase === "model" && progress.modelProgress != null ? `${Math.round(progress.modelProgress)}%` : `${Math.floor(pct)}%`}</span>
              </div>
              <ProgressBar value={progress.phase === "model" ? progress.modelProgress ?? 0 : pct} indeterminate={progress.phase === "preparing" || progress.phase === "waiting"} />
              <div className="flex justify-between text-xs text-emerald-900/50">
                <span>{progress.device ? `Running on ${progress.device === "webgpu" ? "GPU (WebGPU)" : "CPU (WASM)"}` : settings.engine === "cloud" ? "Cloud AI · Whisper large-v3" : ""}</span>
                <span>{eta}</span>
              </div>
              {running && <p className="text-xs text-emerald-900/50">Keep this tab open. Subtitles appear live as each part finishes.</p>}
            </div>
          )}
          {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}
        </Card>
      </div>

      {/* ------------ RIGHT: transcript ------------ */}
      <Card className="flex min-w-0 flex-col lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-emerald-900/5 p-1">
              {(["transcript", "subtitles"] as const).map((p) => (
                <button key={p} onClick={() => onPanel(p)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition ${panel === p ? "btn-gradient text-white shadow" : "text-emerald-900/70 hover:text-emerald-950"}`}>
                  <Icon name={p === "transcript" ? "play" : "captions"} className="h-4 w-4" />{p === "transcript" ? "Transcript" : "Subtitles"}
                </button>
              ))}
            </div>
            {segments.length > 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">{panel === "subtitles" ? `${cues.length} cues` : `${shown.length} lines`}</span>}
          </div>
          {Object.keys(translations).length > 0 && (
            <div className="flex flex-wrap gap-1 rounded-xl bg-emerald-900/5 p-1">
              {["original", ...Object.keys(translations)].map((k) => (
                <button key={k} onClick={() => setView(k)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${view === k ? "bg-white text-emerald-800 shadow" : "text-emerald-900/60 hover:text-emerald-900"}`}>
                  {k === "original" ? "Original" : langByCode(k)?.native ?? k}
                </button>
              ))}
            </div>
          )}
        </div>

        {segments.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600"><Icon name="captions" className="h-8 w-8" /></div>
            <p className="font-semibold text-emerald-950">Your transcript will appear here</p>
            <p className="max-w-xs text-sm text-emerald-900/55">Upload a file and press Generate. Lines stream in live — click any line to jump the video there, or edit it.</p>
          </div>
        ) : panel === "subtitles" ? (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-emerald-50 px-3 py-2 ring-1 ring-emerald-100">
              <span className="text-xs font-bold text-emerald-800">Subtitle size</span>
              <input type="range" min={70} max={180} value={subSize} onChange={(e) => setSubSize(+e.target.value)} className="flex-1" />
              <span className="w-10 text-right font-mono text-xs">{subSize}%</span>
              <style>{`video::cue{font-size:${(subSize / 100) * 1.05}em}`}</style>
            </div>
            <div ref={listRef} className="scroll-thin relative mt-3 min-h-[300px] flex-1 overflow-y-auto rounded-2xl bg-white/60 p-1.5 ring-1 ring-emerald-900/5 max-lg:max-h-[60vh]">
              {cues.map((c, i) => (
                <button key={i} onClick={() => seek(c.start)} disabled={!file}
                  className={`seg-row flex w-full gap-3 rounded-xl px-3 py-2 text-left transition ${i === activeCue ? "bg-gradient-to-r from-emerald-100 to-lime-50 ring-1 ring-emerald-200" : "hover:bg-emerald-50"}`}>
                  <span className="w-7 shrink-0 pt-0.5 text-right font-mono text-[11px] font-bold text-emerald-600">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[11px] text-emerald-900/55">{clock(c.start)} → {clock(c.end)}</span>
                    <span className="block text-[15px] leading-snug text-emerald-950">{c.text}</span>
                  </span>
                </button>
              ))}
              {running && <div className="px-3 py-3 text-sm text-emerald-700/70 animate-pulse">Listening… more subtitles coming</div>}
            </div>
            <p className="mt-2 text-[11px] text-emerald-900/55">Subtitles are auto-split into readable 2-line cues. To fix wording, edit lines in the Transcript tab.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button onClick={() => exp("srt")} className="!py-3"><Icon name="download" className="h-4 w-4" /> Download SRT</Button>
              <Button variant="ghost" onClick={() => exp("vtt")} className="!py-3"><Icon name="download" className="h-4 w-4" /> Download VTT</Button>
            </div>
            {GrabAll}
          </>
        ) : (
          <>
            <div className="mt-4 flex gap-2">
              <div className="relative flex-1">
                <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-900/40" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search transcript…"
                  className="w-full rounded-xl bg-white py-2.5 pl-9 pr-3 text-sm ring-1 ring-emerald-900/10 outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <button onClick={() => setFollow((f) => !f)} title="Auto-scroll with video"
                className={`rounded-xl px-3 text-xs font-semibold ring-1 transition ${follow ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white text-emerald-800 ring-emerald-900/10"}`}>Follow</button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button variant="soft" onClick={saveProject} className="!px-3 !py-1.5 !text-xs">💾 {savedAt ? `Saved ${savedAt}` : "Save"}</Button>
              <Button onClick={() => exp("srt")} className="!px-3 !py-1.5 !text-xs"><Icon name="download" className="h-3.5 w-3.5" /> Download SRT</Button>
              <Button variant="ghost" onClick={() => exp("txt")} className="!px-3 !py-1.5 !text-xs"><Icon name="download" className="h-3.5 w-3.5" /> Download TXT</Button>
              <span className="text-[11px] text-emerald-900/50">✏️ edit · 🗑 delete · ▶ play line · 🔊 read aloud</span>
            </div>

            <div ref={listRef} className="scroll-thin relative mt-3 min-h-[300px] flex-1 overflow-y-auto rounded-2xl bg-white/60 p-1.5 ring-1 ring-emerald-900/5 max-lg:max-h-[60vh]">
              {filtered.map(({ s, i }) => (
                <div key={`${view}-${i}`} data-i={i}
                  className={`seg-row group flex gap-3 rounded-xl px-2.5 py-2 transition ${i === active ? "bg-gradient-to-r from-emerald-100 to-lime-50 ring-1 ring-emerald-200" : "hover:bg-emerald-50"}`}>
                  <button onClick={() => seek(s.start)} disabled={!file}
                    className="mt-0.5 h-fit shrink-0 rounded-md bg-emerald-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-700 hover:bg-emerald-600 hover:text-white disabled:hover:bg-emerald-100 disabled:hover:text-emerald-700">
                    {shortClock(s.start)}
                  </button>
                  {editing === i ? (
                    <div className="min-w-0 flex-1">
                      <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={2}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); editSeg(i, draft.trim()); setEditing(-1); } if (e.key === "Escape") setEditing(-1); }}
                        className="w-full resize-y rounded-lg bg-white px-2 py-1.5 text-[15px] text-emerald-950 ring-2 ring-emerald-400 outline-none" />
                      <div className="mt-1.5 flex gap-1.5">
                        <button onClick={() => { editSeg(i, draft.trim()); setEditing(-1); }} className="btn btn-gradient rounded-lg px-3 py-1 text-xs font-bold text-white">✓ Save</button>
                        <button onClick={() => setEditing(-1)} className="btn btn-ghost rounded-lg px-3 py-1 text-xs font-bold text-emerald-900">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <p onDoubleClick={() => { setEditing(i); setDraft(s.text); }}
                      className="min-w-0 flex-1 rounded px-1 text-[15px] leading-relaxed text-emerald-950">
                      {s.text}
                    </p>
                  )}
                  <div className="flex shrink-0 items-start gap-1">
                    {editing !== i && (
                      <>
                        <button onClick={() => { setEditing(i); setDraft(s.text); }} title="Edit line"
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs ring-1 ring-emerald-200 hover:bg-emerald-50">✏️</button>
                        <button onClick={() => deleteSeg(i)} title="Delete line"
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs ring-1 ring-rose-200 hover:bg-rose-50">🗑</button>
                      </>
                    )}
                    <button onClick={() => playLine(i)} disabled={!file} title="Play this line"
                      className={`flex h-7 w-7 items-center justify-center rounded-full transition ${linePlaying === i ? "btn-gradient text-white" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white"} disabled:opacity-40`}>
                      {linePlaying === i ? <span className="text-[9px] font-black">❚❚</span> : <Icon name="play" className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => speak(s.text)} title="Read this line aloud"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-lime-100 text-sm hover:bg-lime-200">🔊</button>
                  </div>
                </div>
              ))}
              {running && <div className="px-3 py-3 text-sm text-emerald-700/70 animate-pulse">Listening… more lines coming</div>}
            </div>

            {/* Export */}
            <div className="mt-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-800/60">Download {view !== "original" && `(${langByCode(view)?.name})`}</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {[["srt", "SRT"], ["vtt", "VTT"], ["txt", "TXT"], ["txtt", "TXT ⏱"], ["csv", "CSV"], ["json", "JSON"]].map(([k, l]) => (
                  <Button key={k} variant={k === "srt" ? "primary" : "ghost"} onClick={() => exp(k)} className="!px-2 !py-2 !text-xs"><Icon name="download" className="h-3.5 w-3.5" />{l}</Button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button variant="ghost" onClick={copyAll} className="!py-2 !text-xs"><Icon name="copy" className="h-3.5 w-3.5" />{copied ? "Copied!" : "Copy transcript"}</Button>
                <Button variant="ghost" onClick={downloadAudioOnly} disabled={!file || pack.running} className="!py-2 !text-xs"><Icon name="music" className="h-3.5 w-3.5" />Audio MP3</Button>
              </div>
            </div>
            {GrabAll}

            {/* Translate */}
            <div className="mt-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-lime-50 p-4 ring-1 ring-emerald-100">
              <p className="mb-3 flex items-center gap-2 text-sm font-bold text-emerald-900"><Icon name="globe" className="h-4 w-4" /> Translate subtitles</p>
              <div className="flex flex-wrap gap-2">
                <Select value={target} onChange={(e) => setTarget(e.target.value)} disabled={transState.running} className="!w-auto flex-1">
                  {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name} — {l.native}</option>)}
                </Select>
                {transState.running ? (
                  <Button variant="danger" onClick={() => { transAbort.current?.abort(); nllb.terminate(); }}>Stop</Button>
                ) : (
                  <Button onClick={() => translate()} disabled={running || !segments.length}>Translate</Button>
                )}
              </div>
              {transState.running && (
                <div className="mt-3 space-y-1.5">
                  <ProgressBar value={transState.total ? (transState.done / transState.total) * 100 : 0} />
                  <p className="text-xs text-emerald-900/60">{transState.msg ?? `${transState.done} / ${transState.total} lines`}</p>
                </div>
              )}
              {transState.error && <p className="mt-2 text-xs text-rose-700">{transState.error}</p>}
              <p className="mt-2 text-[11px] text-emerald-900/50">{cloudOK ? "Online: uses free cloud AI (Llama 3.3 70B)." : !online ? "Offline: runs on your device with Meta NLLB-200 (must be downloaded once while online)." : "Runs on your device with Meta NLLB-200 (~600 MB, downloaded once)."}</p>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
