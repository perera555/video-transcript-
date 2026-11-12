"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./ui";

const LINES = [
  { en: "Where have you been all this time?", si: "ඔබ මෙතෙක් කොහෙද හිටියේ?" },
  { en: "I was looking for you everywhere.", si: "මම ඔබව හැමතැනම සෙව්වා." },
  { en: "We need to leave — right now.", si: "අපි දැන්ම යන්න ඕනේ." },
];

/** Floating 3D scene: video player, transcript sheet and audio card layered in depth. Follows the mouse. */
export default function Hero3D() {
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % LINES.length), 2600);
    return () => clearInterval(id);
  }, []);

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || e.pointerType !== "mouse") return;
    setTilt({ x: ((e.clientY - r.top) / r.height - 0.5) * -10, y: ((e.clientX - r.left) / r.width - 0.5) * 14 });
  };

  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={() => setTilt({ x: 0, y: 0 })} className="scene relative mx-auto w-full max-w-[560px] select-none py-6" aria-hidden>
      <div className="stage relative" style={{ rotate: `x ${tilt.x}deg`, translate: `0 0`, transition: "rotate .3s" }}>
        <div style={{ transform: `rotateY(${tilt.y}deg)`, transition: "transform .3s", transformStyle: "preserve-3d" }}>
          {/* Back: video player */}
          <div className="layer relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 p-3 shadow-[0_8px_0_#064e3b,0_40px_70px_-20px_rgba(4,120,87,.6)]">
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_30%_30%,#34d399_0,#065f46_45%,#022c22_100%)]">
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_50%,rgba(0,0,0,.55))]" />
              <div className="absolute left-1/2 top-[38%] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur">
                <Icon name="play" className="h-7 w-7" />
              </div>
              <div className="absolute inset-x-0 bottom-3 flex flex-col items-center gap-1 px-4 text-center">
                <span key={`en${i}`} className="fade-up rounded bg-black/60 px-2 py-0.5 text-[13px] font-semibold text-white sm:text-sm">{LINES[i].en}</span>
                <span key={`si${i}`} className="fade-up rounded bg-black/45 px-2 py-0.5 text-[12px] text-lime-200 sm:text-[13px]">{LINES[i].si}</span>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 px-1">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-lime-300 transition-all duration-1000" style={{ width: `${30 + i * 25}%` }} /></div>
              <span className="font-mono text-[11px] text-white/70">1:{12 + i}:0{i * 3}</span>
            </div>
          </div>

          {/* Front-left: transcript sheet */}
          <div className="z-80px chip-3d absolute -bottom-10 -left-4 w-[58%] rounded-2xl bg-white p-3 ring-1 ring-emerald-100 sm:-left-10">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-700"><Icon name="captions" className="h-3.5 w-3.5" /> Transcript</p>
            {LINES.map((l, n) => (
              <div key={n} className={`mb-1 flex gap-2 rounded-lg px-1.5 py-1 text-[11px] transition ${n === i ? "bg-emerald-100 font-semibold text-emerald-950" : "text-emerald-900/60"}`}>
                <span className="font-mono text-emerald-600">1:{12 + n}</span><span className="truncate">{l.en}</span>
              </div>
            ))}
          </div>

          {/* Front-right: audio card */}
          <div className="z-120px chip-3d absolute -right-2 -top-8 w-[42%] rounded-2xl bg-white p-3 ring-1 ring-emerald-100 sm:-right-8">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-700"><Icon name="music" className="h-3.5 w-3.5" /> Audio</p>
            <div className="flex h-9 items-end gap-[3px]">
              {Array.from({ length: 16 }).map((_, n) => (
                <span key={n} className="btn-gradient w-1.5 rounded-full transition-all duration-700" style={{ height: `${20 + ((n * 37 + i * 53) % 80)}%` }} />
              ))}
            </div>
            <p className="mt-1.5 truncate text-[10px] font-semibold text-emerald-900/60">movie.mp3 · 192 kbps</p>
          </div>

          {/* Floating chips */}
          <div className="z-40px chip-3d absolute -right-3 bottom-6 rounded-xl bg-white px-2.5 py-1.5 text-[11px] font-extrabold text-emerald-700 sm:-right-10">⬇ SRT · VTT · TXT</div>
          <div className="z-120px chip-3d absolute -left-3 -top-5 rounded-xl bg-gradient-to-r from-emerald-600 to-lime-500 px-2.5 py-1.5 text-[11px] font-extrabold text-white sm:-left-8">සිංහල · தமிழ் · Español</div>
        </div>
      </div>
    </div>
  );
}
