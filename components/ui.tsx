"use client";
import { useSyncExternalStore, type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

/** Live online/offline status. */
export function useOnline() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
    },
    () => navigator.onLine,
    () => true
  );
}

export function NetworkBadge() {
  const online = useOnline();
  return (
    <span title={online ? "Online: Cloud AI and On-device AI available" : "Offline: On-device AI only"}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-bold ring-1 ${online ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-300"}`}>
      <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
      {online ? "Online" : "Offline"}
    </span>
  );
}

export function Card({ children, className = "", tilt = false }: { children: ReactNode; className?: string; tilt?: boolean }) {
  return <div className={`glass card-3d ${tilt ? "" : "no-tilt"} rounded-3xl p-5 sm:p-6 ${className}`}>{children}</div>;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "soft" };
export function Button({ variant = "primary", className = "", ...rest }: BtnProps) {
  const styles = {
    primary: "btn-gradient text-white hover:brightness-105",
    ghost: "btn-ghost text-emerald-900",
    soft: "bg-emerald-100 hover:bg-emerald-200/80 text-emerald-800 ring-1 ring-emerald-300/60",
    danger: "bg-rose-50 hover:bg-rose-100 text-rose-700 ring-1 ring-rose-200",
  }[variant];
  return (
    <button
      {...rest}
      className={`btn inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-emerald-800/60">{label}</span>
      {children}
      {hint && <span className="text-xs text-emerald-950/50">{hint}</span>}
    </label>
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl bg-white px-3 py-2.5 text-sm text-emerald-950 ring-1 ring-emerald-900/15 outline-none focus:ring-2 focus:ring-emerald-500 ${props.className ?? ""}`}
    />
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-start gap-3 text-left">
      <span className={`mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${checked ? "btn-gradient" : "bg-emerald-900/15"}`}>
        <span className={`h-5 w-5 rounded-full bg-white shadow transition ${checked ? "translate-x-5" : ""}`} />
      </span>
      <span>
        <span className="block text-sm font-semibold text-emerald-950">{label}</span>
        {hint && <span className="block text-xs text-emerald-950/50">{hint}</span>}
      </span>
    </button>
  );
}

export function ProgressBar({ value, indeterminate }: { value: number; indeterminate?: boolean }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-emerald-900/10">
      <div
        className={`h-full rounded-full btn-gradient transition-[width] duration-500 ${indeterminate ? "animate-pulse" : ""}`}
        style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Icon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const paths: Record<string, ReactNode> = {
    upload: <path d="M12 16V4m0 0 4 4m-4-4L8 8M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />,
    download: <path d="M12 4v12m0 0 4-4m-4 4-4-4M4 18v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1" />,
    mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
    music: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
    captions: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 10.5a2 2 0 1 0 0 3M17 10.5a2 2 0 1 0 0 3" /></>,
    sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
    stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
    play: <path d="M7 5l12 7-12 7V5z" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    install: <><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><rect x="3" y="17" width="18" height="4" rx="1" /></>,
    shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />,
    bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
    trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    x: <path d="M6 6l12 12M18 6 6 18" />,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h10" /></>,
    key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l3 3M15 8l2 2" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {paths[name]}
    </svg>
  );
}

export function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  const u = ["KB", "MB", "GB"];
  let i = -1;
  do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
  return `${b.toFixed(b < 10 ? 1 : 0)} ${u[i]}`;
}

export function store<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
