"use client";
import { useRef, useState } from "react";
import { Icon } from "./ui";

export default function Dropzone({ onFile, accept, title, subtitle }: { onFile: (f: File) => void; accept: string; title: string; subtitle: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      className={`dropzone fade-up group relative flex cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl px-6 py-14 text-center transition ${over ? "active" : ""}`}
    >
      <div className="blob -left-10 -top-10 h-40 w-40 bg-emerald-300" />
      <div className="blob -bottom-12 -right-6 h-44 w-44 bg-lime-300" style={{ animationDelay: "-6s" }} />
      <div className="btn-gradient relative flex h-20 w-20 items-center justify-center rounded-3xl text-white shadow-xl shadow-emerald-700/30 transition group-hover:scale-105 group-hover:-rotate-3">
        <Icon name="upload" className="h-9 w-9" />
      </div>
      <div className="relative">
        <p className="text-lg font-extrabold text-emerald-950 sm:text-xl">{title}</p>
        <p className="mt-1 text-sm text-emerald-900/60">{subtitle}</p>
      </div>
      <span className="relative rounded-full bg-emerald-950 px-5 py-2 text-sm font-semibold text-white shadow-lg">Choose file</span>
      <p className="relative text-xs text-emerald-900/45">Your file never leaves your device unless you pick Cloud AI (then only compressed audio is sent).</p>
      <input ref={input} type="file" accept={accept} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
    </div>
  );
}
