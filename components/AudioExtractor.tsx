"use client";
import { useEffect, useRef, useState } from "react";
import AudioLevel from "./AudioLevel";
import Dropzone from "./Dropzone";
import { Button, Card, Field, Icon, ProgressBar, Select, Toggle, formatBytes } from "./ui";
import { extractFullAudio, probeDuration, stopFFmpeg, type AudioFormat } from "@/lib/audio";
import { baseName, download, shortClock } from "@/lib/format";

const FORMATS: { id: AudioFormat; label: string; hint: string }[] = [
  { id: "mp3", label: "MP3", hint: "Plays everywhere. Best choice for most people." },
  { id: "copy", label: "Original (no quality loss)", hint: "Copies the movie's audio track as-is — very fast, same quality as the source." },
  { id: "wav", label: "WAV (uncompressed)", hint: "Studio editing. Large: ~10 MB per minute (stereo)." },
];

export default function AudioExtractor({ onTranscribe }: { onTranscribe: (f: File) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [format, setFormat] = useState<AudioFormat>("mp3");
  const [bitrate, setBitrate] = useState("192k");
  const [boost, setBoost] = useState(false);
  const [mono, setMono] = useState(false);
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<{ url: string; name: string; size: number; blob: Blob } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);

  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  const pick = async (f: File) => {
    setFile(f); setResult(null); setState("idle"); setErr(""); setPct(0);
    setDuration(await probeDuration(f).catch(() => 0));
  };

  const run = async () => {
    if (!file) return;
    setState("running"); setErr(""); setPct(0); setResult(null);
    let lock: { release: () => Promise<void> } | null = null;
    try { lock = await (navigator as any).wakeLock?.request("screen"); } catch {}
    try {
      const { blob, ext } = await extractFullAudio(file, { format, bitrate, boost, mono }, setPct);
      const name = `${baseName(file.name)}.${ext}`;
      setResult({ url: URL.createObjectURL(blob), name, size: blob.size, blob });
      setState("done");
    } catch (e: any) {
      setErr(e?.message || "Extraction failed");
      setState("error");
    } finally {
      lock?.release().catch(() => {});
    }
  };

  const est = (() => {
    if (!duration) return "";
    const kbps = format === "wav" ? (mono ? 705 : 1411) : format === "mp3" ? parseInt(bitrate) * (mono ? 0.5 : 1) : 0;
    return kbps ? `≈ ${formatBytes((kbps * 1000 * duration) / 8)}` : "";
  })();

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="flex flex-col gap-5">
        {!file ? (
          <Dropzone onFile={pick} accept="video/*,audio/*,.mkv,.avi,.mov,.wmv,.flv"
            title="Drop a movie or video to grab its audio"
            subtitle="Extract the full soundtrack as MP3, WAV or original quality" />
        ) : (
          <Card className="fade-up">
            <div className="flex items-center gap-4">
              <div className="btn-gradient flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white"><Icon name="music" className="h-7 w-7" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{file.name}</p>
                <p className="text-sm text-emerald-900/55">{formatBytes(file.size)}{duration ? ` · ${shortClock(duration)}` : ""}</p>
              </div>
              <Button variant="ghost" disabled={state === "running"} onClick={() => { setFile(null); setResult(null); }} className="!py-1.5 !text-xs">Change</Button>
            </div>
          </Card>
        )}

        <Card>
          <h3 className="mb-4 flex items-center gap-2 text-base font-bold"><Icon name="music" className="h-5 w-5 text-emerald-600" /> Audio format</h3>
          <div className="grid gap-2">
            {FORMATS.map((f) => (
              <button key={f.id} onClick={() => setFormat(f.id)} disabled={state === "running"}
                className={`rounded-2xl px-4 py-3 text-left transition ring-1 ${format === f.id ? "bg-white ring-2 ring-emerald-500 shadow-md shadow-emerald-900/10" : "bg-white/50 ring-emerald-900/10 hover:bg-white"}`}>
                <span className="block text-sm font-bold">{f.label}</span>
                <span className="block text-xs text-emerald-900/55">{f.hint}</span>
              </button>
            ))}
          </div>
          {format !== "copy" && (
            <div className="mt-4 grid gap-4">
              {format === "mp3" && (
                <Field label="Quality">
                  <Select value={bitrate} onChange={(e) => setBitrate(e.target.value)} disabled={state === "running"}>
                    <option value="96k">96 kbps — small, voice</option>
                    <option value="128k">128 kbps — good</option>
                    <option value="192k">192 kbps — great (recommended)</option>
                    <option value="320k">320 kbps — maximum</option>
                  </Select>
                </Field>
              )}
              <Toggle checked={boost} onChange={setBoost} label="Voice boost" hint="Levels loudness and makes dialogue clearer" />
              <Toggle checked={mono} onChange={setMono} label="Mono" hint="Half the size — fine for speech & podcasts" />
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {state === "running" ? (
              <Button variant="danger" onClick={() => { stopFFmpeg(); setState("idle"); }} className="flex-1 !py-3"><Icon name="stop" /> Stop</Button>
            ) : (
              <Button onClick={run} disabled={!file} className="flex-1 !py-3 !text-base"><Icon name="download" /> Extract audio</Button>
            )}
            {est && <span className="text-xs text-emerald-900/55">Output {est}</span>}
          </div>
          {state === "running" && (
            <div className="mt-4 space-y-1.5 fade-up">
              <ProgressBar value={pct * 100} indeterminate={pct === 0} />
              <p className="text-xs text-emerald-900/60">{pct ? `${Math.round(pct * 100)}% extracted` : "Loading audio engine…"} — long movies take a few minutes. Keep this tab open.</p>
            </div>
          )}
          {err && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{err}</p>}
        </Card>
      </div>

      <Card className="flex flex-col">
        <h3 className="mb-4 flex items-center gap-2 text-base font-bold"><Icon name="play" className="h-5 w-5 text-emerald-600" /> Your audio</h3>
        {!result ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600"><Icon name="music" className="h-8 w-8" /></div>
            <p className="font-semibold">The extracted audio will appear here</p>
            <p className="max-w-xs text-sm text-emerald-900/55">Preview it, download it, or send it straight to the transcript generator.</p>
          </div>
        ) : (
          <div className="fade-up space-y-4">
            <div className="rounded-2xl bg-emerald-950 p-4">
              <AudioLevel media={audioEl} className="!h-16" />
              <audio ref={(el) => { (audioRef as any).current = el; setAudioEl(el); }} src={result.url} controls className="mt-3 w-full" />
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3 ring-1 ring-emerald-900/10">
              <div className="min-w-0"><p className="truncate text-sm font-bold">{result.name}</p><p className="text-xs text-emerald-900/55">{formatBytes(result.size)}</p></div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Ready</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={() => download(result.name, result.blob)} className="!py-3"><Icon name="download" /> Download audio</Button>
              <Button variant="soft" onClick={() => onTranscribe(new File([result.blob], result.name, { type: result.blob.type }))} className="!py-3">
                <Icon name="captions" /> Transcribe this audio
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
