"use client";
// Audio extraction with ffmpeg.wasm. The source file is mounted with WORKERFS,
// so ffmpeg reads it lazily from disk: a 4-hour, multi-GB movie never has to
// fit into memory. We pull out one short audio window at a time.
import type { FFmpeg, FFFSType } from "@ffmpeg/ffmpeg";

const CORE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";
const MOUNT = "/input";

// Speech clean-up: cut rumble & hiss, then even out loudness so quiet dialogue
// under loud music/effects is easier to recognise.
const VOICE_BOOST = "highpass=f=80,lowpass=f=8000,dynaudnorm=f=150:g=15";

let ffmpeg: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;
let mounted: File | null = null;

export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;
  if (!loading) {
    loading = (async () => {
      // Served from /public/ffmpeg (see scripts/copy-ffmpeg.mjs), imported outside the bundle.
      const mod: { FFmpeg: new () => FFmpeg } = await import(
        /* webpackIgnore: true */ /* turbopackIgnore: true */ new URL("/ffmpeg/index.js", location.origin).href
      );
      const toBlobURL = async (url: string, type: string) =>
        URL.createObjectURL(new Blob([await (await fetch(url)).arrayBuffer()], { type }));
      const f = new mod.FFmpeg();
      await f.load({
        classWorkerURL: new URL("/ffmpeg/worker.js", location.origin).href,
        coreURL: await toBlobURL(`${CORE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE}/ffmpeg-core.wasm`, "application/wasm"),
      });
      ffmpeg = f;
      return f;
    })();
    loading.catch(() => (loading = null));
  }
  return loading;
}

async function mount(file: File) {
  const f = await getFFmpeg();
  if (mounted === file) return f;
  if (mounted) {
    try { await f.unmount(MOUNT); } catch {}
  } else {
    try { await f.createDir(MOUNT); } catch {}
  }
  await f.mount("WORKERFS" as FFFSType,{ files: [file] }, MOUNT);
  mounted = file;
  return f;
}

const inPath = (file: File) => `${MOUNT}/${file.name}`;

/** Duration via the browser first (fast); falls back to parsing ffmpeg's log. */
export async function probeDuration(file: File): Promise<number> {
  const viaElement = await new Promise<number>((resolve) => {
    const el = document.createElement(file.type.startsWith("audio") ? "audio" : "video");
    const url = URL.createObjectURL(file);
    const done = (d: number) => { URL.revokeObjectURL(url); resolve(d); };
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) return done(el.duration);
      // MediaRecorder WebM files have no duration header: seek far to force the browser to compute it.
      el.ondurationchange = () => { if (Number.isFinite(el.duration) && el.duration > 0) done(el.duration); };
      el.currentTime = 1e101;
    };
    el.onerror = () => done(0);
    setTimeout(() => done(0), 8000);
    el.src = url;
  });
  if (viaElement > 0) return viaElement;

  const f = await mount(file);
  let dur = 0;
  const onLog = ({ message }: { message: string }) => {
    const m = message.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (m) dur = +m[1] * 3600 + +m[2] * 60 + +m[3];
  };
  f.on("log", onLog);
  await f.exec(["-hide_banner", "-i", inPath(file)]).catch(() => {});
  f.off("log", onLog);
  return dur;
}

type WindowOpts = { start: number; length: number; boost: boolean };

/** 16 kHz mono float PCM for the on-device Whisper model. */
export async function extractPCM(file: File, { start, length, boost }: WindowOpts): Promise<Float32Array> {
  const f = await mount(file);
  const out = `pcm_${start}.f32`;
  const args = ["-hide_banner", "-ss", String(start), "-t", String(length), "-i", inPath(file), "-vn", "-ac", "1", "-ar", "16000"];
  if (boost) args.push("-af", VOICE_BOOST);
  args.push("-f", "f32le", out);
  const code = await f.exec(args);
  if (code !== 0) throw new Error("Could not read audio from this file");
  const data = (await f.readFile(out)) as Uint8Array;
  await f.deleteFile(out).catch(() => {});
  return new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4);
}

/** Small mono MP3 for cloud transcription (≈2.4 MB per 10 minutes). */
export async function extractMP3(file: File, { start, length, boost }: WindowOpts): Promise<Blob> {
  const f = await mount(file);
  const out = `seg_${start}.mp3`;
  const args = ["-hide_banner", "-ss", String(start), "-t", String(length), "-i", inPath(file), "-vn", "-ac", "1", "-ar", "16000"];
  if (boost) args.push("-af", VOICE_BOOST);
  args.push("-c:a", "libmp3lame", "-b:a", "32k", out);
  const code = await f.exec(args);
  if (code !== 0) throw new Error("Could not read audio from this file");
  const data = (await f.readFile(out)) as Uint8Array;
  await f.deleteFile(out).catch(() => {});
  return new Blob([data as BlobPart], { type: "audio/mpeg" });
}

const COPY_EXT: Record<string, [string, string]> = {
  aac: ["m4a", "audio/mp4"],
  mp3: ["mp3", "audio/mpeg"],
  opus: ["opus", "audio/ogg"],
  vorbis: ["ogg", "audio/ogg"],
  flac: ["flac", "audio/flac"],
  ac3: ["ac3", "audio/ac3"],
  eac3: ["eac3", "audio/eac3"],
};

/** Reads the first audio stream's codec name from ffmpeg's log (e.g. "aac"). */
export async function probeAudioCodec(file: File): Promise<string | null> {
  const f = await mount(file);
  let codec: string | null = null;
  const onLog = ({ message }: { message: string }) => {
    const m = message.match(/Audio:\s*([a-z0-9_]+)/i);
    if (m && !codec) codec = m[1].toLowerCase();
  };
  f.on("log", onLog);
  await f.exec(["-hide_banner", "-i", inPath(file)]).catch(() => {});
  f.off("log", onLog);
  return codec;
}

export type AudioFormat = "mp3" | "wav" | "copy";

/** Grab the full soundtrack from a movie/video as a separate audio file. */
export async function extractFullAudio(
  file: File,
  opts: { format: AudioFormat; bitrate: string; boost: boolean; mono: boolean },
  onProgress: (p: number) => void
): Promise<{ blob: Blob; ext: string }> {
  const f = await mount(file);
  const handler = ({ progress }: { progress: number }) => onProgress(Math.max(0, Math.min(1, progress)));
  f.on("progress", handler);
  try {
    let ext = "mp3";
    let mime = "audio/mpeg";
    const args = ["-hide_banner", "-i", inPath(file), "-vn", "-sn", "-map", "0:a:0"];
    if (opts.format === "copy") {
      const codec = (await probeAudioCodec(file)) ?? "";
      [ext, mime] = COPY_EXT[codec] ?? ["mka", "audio/x-matroska"];
      args.push("-c:a", "copy");
    } else {
      if (opts.boost) args.push("-af", VOICE_BOOST);
      if (opts.mono) args.push("-ac", "1");
      if (opts.format === "wav") {
        ext = "wav";
        mime = "audio/wav";
        args.push("-ar", "44100", "-c:a", "pcm_s16le");
      } else {
        args.push("-c:a", "libmp3lame", "-b:a", opts.bitrate);
      }
    }
    const out = `full.${ext}`;
    args.push(out);
    const code = await f.exec(args);
    if (code !== 0) throw new Error("Could not extract audio from this file");
    const data = (await f.readFile(out)) as Uint8Array;
    await f.deleteFile(out).catch(() => {});
    return { blob: new Blob([data as BlobPart], { type: mime }), ext };
  } finally {
    f.off("progress", handler);
  }
}

/** Abort any running ffmpeg job (terminates the worker; reloads lazily next time). */
export function stopFFmpeg() {
  if (ffmpeg) {
    try { ffmpeg.terminate(); } catch {}
  }
  ffmpeg = null;
  loading = null;
  mounted = null;
}
