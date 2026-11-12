"use client";
import { useRef, useState } from "react";
import AudioExtractor from "./AudioExtractor";
import Hero3D from "./Hero3D";
import { InstallBanner } from "./InstallButton";
import Guide from "./Guide";
import ToolCards from "./ToolCards";
import InstallButton from "./InstallButton";
import TranscribeTool from "./TranscribeTool";
import VoiceRecorder from "./VoiceRecorder";
import { Icon, NetworkBadge } from "./ui";

type Tab = "transcribe" | "subtitles" | "audio" | "voice";

const TABS: { id: Tab; icon: string; label: string; short: string }[] = [
  { id: "transcribe", icon: "play", label: "Video Transcript", short: "Transcript" },
  { id: "subtitles", icon: "captions", label: "Subtitles", short: "Subtitles" },
  { id: "audio", icon: "music", label: "Audio", short: "Audio" },
  { id: "voice", icon: "mic", label: "Voice", short: "Voice" },
];

const FEATURES = [
  { icon: "clock", title: "Any length", text: "Full 2–4 hour movies. Audio is processed in parts, so even huge files work." },
  { icon: "globe", title: "35+ languages", text: "English, සිංහල, தமிழ், Español, हिन्दी and more — plus subtitle translation." },
  { icon: "captions", title: "Auto subtitles", text: "Perfectly-timed SRT & VTT, live preview on your video, editable lines." },
  { icon: "music", title: "Audio tools", text: "Extract MP3/WAV from movies, record your voice, live audio levels, voice boost." },
  { icon: "shield", title: "Private & free", text: "On-device AI runs in your browser. No sign-up, no watermark, no limits." },
  { icon: "install", title: "Install anywhere", text: "Windows, Mac, Linux, Android, iPhone & iPad — one tap from the top bar." },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("transcribe");
  const [handoff, setHandoff] = useState<File | null>(null);

  const uploadRef = useRef<HTMLInputElement>(null);

  const scrollToTools = () => setTimeout(() => document.getElementById("tools")?.scrollIntoView({ behavior: "smooth" }), 50);
  const openWithFile = (f: File) => {
    setHandoff(f);
    setTab("transcribe");
    scrollToTools();
  };
  const sendToTranscribe = openWithFile;

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <InstallBanner />
      {/* ---------- Top bar ---------- */}
      <header className="sticky top-0 z-40 border-b border-white/70 bg-white/65 backdrop-blur-xl" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <a href="#" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon.svg" alt="" className="h-9 w-9 rounded-xl shadow-md shadow-emerald-700/25" />
            <span className="leading-tight">
              <span className="block text-base font-extrabold tracking-tight text-emerald-950">Subtitle<span className="text-gradient">AI</span></span>
              <span className="hidden text-[11px] font-medium text-emerald-900/55 sm:block">Video Transcript Generator</span>
            </span>
          </a>
          <div className="flex items-center gap-2">
            <a href="#guide" className="hidden rounded-full px-3 py-2 text-sm font-semibold text-emerald-900/70 hover:bg-emerald-100 sm:inline-flex">How to use</a>
            <a href="https://github.com/perera555/video-transcript-" target="_blank" rel="noreferrer"
              className="hidden rounded-full px-3 py-2 text-sm font-semibold text-emerald-900/70 hover:bg-emerald-100 sm:inline-flex">GitHub</a>
            <NetworkBadge />
            <InstallButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 sm:px-6">
        {/* ---------- Hero (3D) ---------- */}
        <section className="relative grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-[1.05fr_1fr]">
          <div className="blob left-[2%] top-6 h-56 w-56 bg-emerald-300/70" />
          <div className="blob right-[6%] top-24 h-72 w-72 bg-lime-200" style={{ animationDelay: "-7s" }} />
          <div className="relative text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-xs font-bold text-emerald-700 shadow-sm ring-1 ring-emerald-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> 100% free · No sign-up · Unlimited length
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.06] tracking-tight text-emerald-950 sm:text-6xl">
              Turn any movie into <span className="text-gradient">transcripts, subtitles</span> & audio
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base text-emerald-900/65 sm:text-lg lg:mx-0">
              Upload a video, movie or audio of any length — even 4 hours. Get the transcript, subtitles and soundtrack in English, Sinhala, Tamil, Spanish and 30+ languages.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <button onClick={() => uploadRef.current?.click()}
                className="btn btn-gradient inline-flex items-center gap-2.5 rounded-2xl px-7 py-4 text-base font-extrabold text-white sm:text-lg">
                <Icon name="upload" className="h-6 w-6" /> Upload video or movie
              </button>
              <a href="#guide" className="btn btn-ghost inline-flex items-center gap-2 rounded-2xl px-6 py-4 text-base font-bold text-emerald-900">
                <Icon name="play" /> How it works
              </a>
              <input ref={uploadRef} type="file" hidden accept="video/*,audio/*,.mkv,.avi,.mov,.wmv,.flv,.m4a,.opus,.flac"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) openWithFile(f); }} />
            </div>
            <p className="mt-3 text-xs text-emerald-900/55">MP4 · MKV · MOV · AVI · WEBM · MP3 · WAV · M4A — or drag &amp; drop into the box below</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs font-semibold text-emerald-900/70 lg:justify-start">
              {["English", "සිංහල", "தமிழ்", "Español", "हिन्दी", "Français", "العربية", "中文", "+27 more"].map((l) => (
                <span key={l} className="rounded-full bg-white/70 px-3 py-1 ring-1 ring-emerald-900/10">{l}</span>
              ))}
            </div>
          </div>
          <Hero3D />
        </section>

        {/* ---------- Tool cards: Transcript · Subtitles · Audio ---------- */}
        <ToolCards active={tab} open={(t) => { setTab(t); scrollToTools(); }} />

        {/* ---------- Tabs ---------- */}
        <nav id="tools" className="glass card-3d no-tilt mx-auto mb-6 grid max-w-3xl scroll-mt-24 grid-cols-4 gap-1 rounded-2xl p-1.5">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-1.5 py-2.5 transition sm:gap-2 sm:px-3 ${tab === t.id ? "btn-gradient text-white shadow-lg shadow-emerald-700/25" : "text-emerald-900 hover:bg-white/80"}`}>
              <Icon name={t.icon} className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
              <span className="truncate text-xs font-bold sm:text-sm">
                <span className="sm:hidden">{t.short}</span><span className="hidden sm:inline">{t.label}</span>
              </span>
            </button>
          ))}
        </nav>

        {/* Keep every tool mounted so a running job survives tab switches */}
        <div className={tab === "transcribe" || tab === "subtitles" ? "" : "hidden"}>
          <TranscribeTool incoming={handoff} panel={tab === "subtitles" ? "subtitles" : "transcript"}
            onPanel={(p) => setTab(p === "subtitles" ? "subtitles" : "transcribe")} />
        </div>
        <div className={tab === "audio" ? "" : "hidden"}><AudioExtractor onTranscribe={sendToTranscribe} /></div>
        <div className={tab === "voice" ? "" : "hidden"}><VoiceRecorder onTranscribe={sendToTranscribe} /></div>

        <Guide />

        {/* ---------- Features ---------- */}
        <section className="mt-16">
          <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">Everything you need, <span className="text-gradient">free forever</span></h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="glass card-3d rounded-3xl p-5">
                <div className="btn-gradient mb-3 flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-md shadow-emerald-700/25"><Icon name={f.icon} /></div>
                <p className="font-bold">{f.title}</p>
                <p className="mt-1 text-sm text-emerald-900/60">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 grid gap-4 md:grid-cols-3">
          {[
            ["1", "Upload", "Drop a movie, video or audio file — or record your voice."],
            ["2", "Generate", "AI listens and writes timed subtitles live, part by part."],
            ["3", "Download", "Edit lines, translate, then export SRT, VTT, TXT, CSV or JSON."],
          ].map(([n, t, d]) => (
            <div key={n} className="glass card-3d flex gap-4 rounded-3xl p-5">
              <span className="text-gradient text-4xl font-extrabold">{n}</span>
              <div><p className="font-bold">{t}</p><p className="text-sm text-emerald-900/60">{d}</p></div>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-emerald-900/10 bg-white/50 py-6 text-center text-xs text-emerald-900/55">
        <p className="font-semibold text-emerald-900/80">© 2026 Porage Thamara Dhanushka Perera. All rights reserved.</p>
        <p className="mt-1">SubtitleAI · Powered by OpenAI Whisper, Meta NLLB &amp; ffmpeg.wasm · Works on Windows, macOS, Linux, Android &amp; iOS</p>
      </footer>
    </div>
  );
}
