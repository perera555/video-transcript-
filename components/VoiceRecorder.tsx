"use client";
import { useEffect, useRef, useState } from "react";
import AudioLevel from "./AudioLevel";
import { Button, Card, Icon, formatBytes } from "./ui";
import { download, shortClock } from "@/lib/format";

function pickMime() {
  for (const m of ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg"]) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

export default function VoiceRecorder({ onTranscribe }: { onTranscribe: (f: File) => void }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState<{ blob: Blob; url: string; name: string } | null>(null);
  const [err, setErr] = useState("");
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [playEl, setPlayEl] = useState<HTMLAudioElement | null>(null);

  useEffect(() => () => { stream?.getTracks().forEach((t) => t.stop()); if (timer.current) clearInterval(timer.current); }, [stream]);
  useEffect(() => () => { if (clip) URL.revokeObjectURL(clip.url); }, [clip]);

  const start = async () => {
    setErr("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const mime = pickMime();
      const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        const type = r.mimeType || mime || "audio/webm";
        const blob = new Blob(chunks.current, { type });
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
        setClip({ blob, url: URL.createObjectURL(blob), name: `voice-${stamp}.${ext}` });
        s.getTracks().forEach((t) => t.stop());
        setStream(null);
      };
      r.start(1000);
      rec.current = r;
      setStream(s);
      setClip(null);
      setRecording(true);
      setPaused(false);
      setElapsed(0);
      timer.current = setInterval(() => setElapsed((x) => (rec.current?.state === "recording" ? x + 1 : x)), 1000);
    } catch {
      setErr("Microphone access was blocked. Allow the microphone in your browser settings and try again.");
    }
  };

  const stop = () => {
    rec.current?.stop();
    setRecording(false);
    if (timer.current) clearInterval(timer.current);
  };
  const togglePause = () => {
    if (!rec.current) return;
    if (rec.current.state === "recording") { rec.current.pause(); setPaused(true); }
    else { rec.current.resume(); setPaused(false); }
  };

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <Card className="relative overflow-hidden text-center">
        <div className="blob -left-16 -top-16 h-48 w-48 bg-emerald-300" />
        <div className="blob -bottom-16 -right-10 h-48 w-48 bg-lime-300" style={{ animationDelay: "-5s" }} />
        <div className="relative flex flex-col items-center gap-5 py-6">
          <button onClick={recording ? stop : start} aria-label={recording ? "Stop recording" : "Start recording"}
            className={`relative flex h-28 w-28 items-center justify-center rounded-full text-white shadow-2xl transition hover:scale-105 ${recording ? "bg-rose-500 shadow-rose-500/40" : "btn-gradient shadow-emerald-600/40"}`}>
            {recording && !paused && <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/40" />}
            <Icon name={recording ? "stop" : "mic"} className="relative h-12 w-12" />
          </button>
          <div>
            <p className="font-mono text-4xl font-bold tracking-tight">{shortClock(elapsed)}</p>
            <p className="mt-1 text-sm text-emerald-900/60">{recording ? (paused ? "Paused" : "Recording… speak clearly") : "Tap the mic to record your voice"}</p>
          </div>
          <div className="w-full max-w-md rounded-2xl bg-white/70 px-3 py-2 ring-1 ring-emerald-900/10">
            <AudioLevel stream={stream} media={!stream ? playEl : null} className="!h-14" />
          </div>
          {recording && <Button variant="ghost" onClick={togglePause}>{paused ? "Resume" : "Pause"}</Button>}
          {err && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{err}</p>}
        </div>
      </Card>

      {clip && (
        <Card className="fade-up space-y-4">
          <audio ref={setPlayEl} src={clip.url} controls className="w-full" />
          <div className="flex items-center justify-between text-sm">
            <span className="truncate font-semibold">{clip.name}</span>
            <span className="text-emerald-900/55">{formatBytes(clip.blob.size)}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={() => onTranscribe(new File([clip.blob], clip.name, { type: clip.blob.type }))} className="!py-3"><Icon name="captions" /> Transcribe recording</Button>
            <Button variant="ghost" onClick={() => download(clip.name, clip.blob)} className="!py-3"><Icon name="download" /> Download recording</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
