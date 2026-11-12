"use client";
import { useEffect, useState } from "react";
import { Icon } from "./ui";

// Animated user guide. If NEXT_PUBLIC_GUIDE_VIDEO_URL is set (YouTube link or
// .mp4 URL), a real tutorial video is shown above the walkthrough.
const VIDEO = process.env.NEXT_PUBLIC_GUIDE_VIDEO_URL || "";

const STEPS = [
  {
    icon: "upload", title: "Upload your movie or video",
    text: "Drag & drop or tap “Choose file”. MP4, MKV, MOV, AVI, WEBM, MP3, WAV, M4A — even 4-hour movies.",
    demo: "upload",
  },
  {
    icon: "sparkle", title: "Pick engine & language",
    text: "Cloud AI = fastest & most accurate (free Groq key). On-device = private, no key, works offline. Choose the spoken language or Auto-detect.",
    demo: "settings",
  },
  {
    icon: "captions", title: "Generate — watch subtitles appear live",
    text: "Press Generate. Audio is processed in parts; lines appear as each part finishes. Stop anytime and Resume later.",
    demo: "progress",
  },
  {
    icon: "globe", title: "Edit, translate & download",
    text: "Click a timestamp to jump the video. Click text to fix it. Translate to Sinhala, Tamil, Spanish & more. Download SRT, VTT, TXT.",
    demo: "export",
  },
  {
    icon: "music", title: "Extra: grab audio or record voice",
    text: "Audio Extractor saves a movie's soundtrack as MP3/WAV/original. Voice Recorder records your mic and transcribes it.",
    demo: "audio",
  },
  {
    icon: "install", title: "Install the app",
    text: "Tap “Install App” at the top. On iPhone: Safari → Share → Add to Home Screen. Works on Windows, Mac, Android, iOS.",
    demo: "install",
  },
];

function embed(url: string) {
  const yt = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return yt ? `https://www.youtube-nocookie.com/embed/${yt[1]}` : null;
}

function Demo({ kind, tick }: { kind: string; tick: number }) {
  const t = tick % 4;
  if (kind === "upload")
    return (
      <div className="dropzone flex h-full flex-col items-center justify-center gap-3 rounded-2xl">
        <div className={`btn-gradient flex h-14 w-14 items-center justify-center rounded-2xl text-white transition-transform duration-700 ${t % 2 ? "-translate-y-2 scale-110" : ""}`}><Icon name="upload" className="h-7 w-7" /></div>
        <div className={`rounded-xl bg-white px-3 py-1.5 text-xs font-semibold shadow transition-all duration-700 ${t >= 2 ? "opacity-100" : "translate-y-2 opacity-0"}`}>🎬 My_Movie_2024.mkv · 2:48:10</div>
      </div>
    );
  if (kind === "settings")
    return (
      <div className="flex h-full flex-col justify-center gap-2.5 p-4">
        <div className="grid grid-cols-2 gap-2">
          <div className={`rounded-xl p-2.5 text-xs font-bold transition ${t < 2 ? "btn-gradient text-white" : "bg-white"}`}>⚡ Cloud AI</div>
          <div className={`rounded-xl p-2.5 text-xs font-bold transition ${t >= 2 ? "btn-gradient text-white" : "bg-white"}`}>🛡 On-device</div>
        </div>
        <div className="rounded-xl bg-white p-2.5 text-xs">Language: <b>{["Auto-detect", "සිංහල", "தமிழ்", "Español"][t]}</b></div>
        <div className="rounded-xl bg-white p-2.5 text-xs">Voice boost: <b className="text-emerald-600">On</b></div>
      </div>
    );
  if (kind === "progress")
    return (
      <div className="flex h-full flex-col justify-center gap-2 p-4">
        <div className="h-2.5 overflow-hidden rounded-full bg-emerald-900/10"><div className="btn-gradient h-full rounded-full transition-all duration-1000" style={{ width: `${25 + t * 25}%` }} /></div>
        {["[0:01] Where have you been all this time?", "[0:04] I was looking for you everywhere.", "[0:07] We need to leave — now.", "[0:10] Then let's go."].slice(0, t + 1).map((l) => (
          <div key={l} className="fade-up rounded-lg bg-white px-2.5 py-1.5 text-xs">{l}</div>
        ))}
      </div>
    );
  if (kind === "export")
    return (
      <div className="flex h-full flex-col justify-center gap-3 p-4">
        <div className="rounded-xl bg-emerald-950 px-3 py-4 text-center text-sm font-semibold text-white">{["Where have you been?", "ඔබ මෙතෙක් කොහෙද හිටියේ?", "நீ இவ்வளவு நேரம் எங்கே இருந்தாய்?", "¿Dónde has estado?"][t]}</div>
        <div className="grid grid-cols-3 gap-1.5">
          {["SRT", "VTT", "TXT"].map((x, i) => <div key={x} className={`rounded-lg py-1.5 text-center text-xs font-bold transition ${i === t % 3 ? "btn-gradient text-white scale-105" : "bg-white"}`}>⬇ {x}</div>)}
        </div>
      </div>
    );
  if (kind === "audio")
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
        <div className="flex h-12 items-end gap-1">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} className="btn-gradient w-2 rounded-full transition-all duration-500" style={{ height: `${20 + ((i * 37 + tick * 53) % 80)}%` }} />
          ))}
        </div>
        <div className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold shadow">🎵 My_Movie_2024.mp3 · 192 kbps</div>
      </div>
    );
  return (
    <div className="flex h-full items-center justify-center gap-4 p-4">
      {["💻", "🍎", "🤖", "📱"].map((d, i) => (
        <div key={d} className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow transition duration-500 ${i === t ? "scale-125 ring-2 ring-emerald-500" : ""}`}>{d}</div>
      ))}
    </div>
  );
}

export default function Guide() {
  const [step, setStep] = useState(0);
  const [tick, setTick] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setTick((x) => {
        const n = x + 1;
        if (auto && n % 4 === 0) setStep((s) => (s + 1) % STEPS.length);
        return n;
      });
    }, 1400);
    return () => clearInterval(id);
  }, [auto]);

  const yt = VIDEO ? embed(VIDEO) : null;

  return (
    <section id="guide" className="mt-16 scroll-mt-24">
      <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">How to use <span className="text-gradient">SubtitleAI</span></h2>
      <p className="mt-2 text-center text-sm text-emerald-900/60">A 30-second walkthrough — tap any step.</p>

      {VIDEO && (
        <div className="glass mx-auto mt-6 max-w-4xl overflow-hidden rounded-3xl p-2">
          {yt ? (
            <iframe src={yt} title="SubtitleAI tutorial" className="aspect-video w-full rounded-2xl" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen />
          ) : (
            <video src={VIDEO} controls playsInline className="aspect-video w-full rounded-2xl bg-black" />
          )}
        </div>
      )}

      <div className="glass card-3d no-tilt mx-auto mt-6 grid max-w-5xl gap-5 rounded-3xl p-4 sm:p-6 md:grid-cols-[1fr_1.1fr]">
        <ol className="flex flex-col gap-1.5">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <button onClick={() => { setStep(i); setAuto(false); setTick(0); }}
                className={`flex w-full gap-3 rounded-2xl p-3 text-left transition ${i === step ? "bg-white shadow-md shadow-emerald-900/10 ring-1 ring-emerald-200" : "hover:bg-white/60"}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${i === step ? "btn-gradient text-white" : "bg-emerald-100 text-emerald-700"}`}>{i + 1}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{s.title}</span>
                  {i === step && <span className="fade-up mt-0.5 block text-xs text-emerald-900/65">{s.text}</span>}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-3">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-100 via-green-50 to-lime-100 ring-1 ring-emerald-200">
            <div className="flex items-center gap-1.5 border-b border-emerald-900/10 bg-white/70 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-300" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="ml-2 text-[11px] font-semibold text-emerald-900/60">Step {step + 1} · {STEPS[step].title}</span>
            </div>
            <div className="absolute inset-x-0 bottom-0 top-9"><Demo key={step} kind={STEPS[step].demo} tick={tick} /></div>
          </div>
          <div className="flex items-center justify-between">
            <button onClick={() => { setStep((s) => (s + STEPS.length - 1) % STEPS.length); setAuto(false); }} className="rounded-full px-3 py-1.5 text-sm font-semibold text-emerald-800 hover:bg-white">← Back</button>
            <button onClick={() => setAuto((a) => !a)} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">{auto ? "❚❚ Pause" : "▶ Auto-play"}</button>
            <button onClick={() => { setStep((s) => (s + 1) % STEPS.length); setAuto(false); }} className="rounded-full px-3 py-1.5 text-sm font-semibold text-emerald-800 hover:bg-white">Next →</button>
          </div>
        </div>
      </div>
    </section>
  );
}
