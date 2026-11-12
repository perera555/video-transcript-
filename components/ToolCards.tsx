"use client";
import { useEffect, useState } from "react";
import { Icon } from "./ui";

type Tab = "transcribe" | "subtitles" | "audio" | "voice";

const LINES = [
  "Where have you been all this time?",
  "I was looking for you everywhere.",
  "We need to leave — right now.",
  "Then let's go together.",
];
const SUBS = ["Where have you been?", "ඔබ මෙතෙක් කොහෙද හිටියේ?", "நீ எங்கே இருந்தாய்?", "¿Dónde has estado?"];

export default function ToolCards({ open, active }: { open: (t: Tab) => void; active: Tab }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1600);
    return () => clearInterval(id);
  }, []);
  const t = tick % 4;

  const cards = [
    {
      id: "transcribe" as const, icon: "play", title: "Video Transcript", tag: "Speech → text",
      text: "Full, editable transcript of any movie or video — even 2–4 hours. Search, click to jump, copy or export TXT, CSV, JSON.",
      cta: "Create transcript",
      preview: (
        <div className="flex h-full flex-col justify-center gap-1.5 p-3">
          {LINES.map((l, i) => (
            <div key={l} className={`flex gap-2 rounded-lg px-2 py-1 text-[11px] transition-all duration-500 ${i === t ? "bg-white shadow-md scale-[1.03]" : "bg-white/50 opacity-70"}`}>
              <span className="font-mono font-bold text-emerald-600">0:{String(i * 3 + 1).padStart(2, "0")}</span>
              <span className="truncate text-emerald-950">{l}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "subtitles" as const, icon: "captions", title: "Subtitles", tag: "SRT · VTT",
      text: "Auto-timed subtitles you can preview live on your video, translate to Sinhala, Tamil, Spanish & 30+ languages, then download.",
      cta: "Make subtitles",
      preview: (
        <div className="relative flex h-full items-end justify-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 p-3">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur"><Icon name="play" className="h-5 w-5" /></div>
          </div>
          <div key={t} className="fade-up relative rounded-md bg-black/60 px-2.5 py-1 text-center text-xs font-semibold text-white">{SUBS[t]}</div>
        </div>
      ),
    },
    {
      id: "audio" as const, icon: "music", title: "Audio", tag: "Extract · Record",
      text: "Grab the soundtrack from any movie as MP3, WAV or original quality — or record your voice and transcribe it.",
      cta: "Extract audio",
      preview: (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-3">
          <div className="flex h-14 items-end gap-[3px]">
            {Array.from({ length: 22 }).map((_, i) => (
              <span key={i} className="btn-gradient w-1.5 rounded-full transition-all duration-700"
                style={{ height: `${18 + ((i * 41 + tick * 67) % 82)}%` }} />
            ))}
          </div>
          <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 shadow">🎵 movie.mp3 · 192 kbps</span>
        </div>
      ),
    },
  ];

  return (
    <section className="mb-10 grid gap-6 md:grid-cols-3">
      {cards.map((c, i) => {
        const on = active === c.id || (c.id === "audio" && active === "voice");
        return (
          <div key={c.id} style={{ animationDelay: `${i * 90}ms` }}
            className={`glass card-3d fade-up group relative flex flex-col rounded-3xl p-4 sm:p-5 ${on ? "ring-2 ring-emerald-500" : ""}`}>
            <div className="mb-4 aspect-[16/9] overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-100 via-green-50 to-lime-100 ring-1 ring-emerald-200">
              {c.preview}
            </div>
            <div className="flex items-center gap-3">
              <div className="btn-gradient chip-3d flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white transition group-hover:-translate-y-1 group-hover:rotate-[-6deg]">
                <Icon name={c.icon} className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-extrabold leading-tight text-emerald-950">{c.title}</h3>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">{c.tag}</span>
              </div>
              {on && <span className="ml-auto rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">OPEN</span>}
            </div>
            <p className="mt-3 flex-1 text-sm text-emerald-900/65">{c.text}</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => open(c.id)} className="btn btn-gradient inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white">
                <Icon name={c.icon} className="h-4 w-4" /> {c.cta}
              </button>
              {c.id === "audio" && (
                <button onClick={() => open("voice")} className="btn btn-ghost inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-emerald-900">
                  <Icon name="mic" className="h-4 w-4" /> Voice
                </button>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
