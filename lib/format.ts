export type Segment = { id: number; start: number; end: number; text: string };

const pad = (n: number, w = 2) => String(Math.floor(n)).padStart(w, "0");

export function clock(sec: number, sep: "," | "." = ",") {
  const s = Math.max(0, sec);
  const ms = Math.round((s - Math.floor(s)) * 1000) % 1000;
  return `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}${sep}${pad(ms, 3)}`;
}

export function shortClock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

/** Split long recognizer segments into readable subtitle cues (≤ 2 lines of ~42 chars, ≤ 7s). */
export function toCues(segments: Segment[], maxChars = 84, maxDur = 7): Segment[] {
  const out: Segment[] = [];
  for (const seg of segments) {
    const text = seg.text.trim();
    if (!text) continue;
    const dur = Math.max(0.3, seg.end - seg.start);
    if (text.length <= maxChars && dur <= maxDur) {
      out.push({ ...seg, text });
      continue;
    }
    const pieces = Math.max(Math.ceil(text.length / maxChars), Math.ceil(dur / maxDur));
    const target = text.length / pieces;
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (cur && (next.length > maxChars || (cur.length >= target && /[.,!?;:،။।]$/.test(cur)))) {
        chunks.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) chunks.push(cur);
    const total = chunks.reduce((a, c) => a + c.length, 0) || 1;
    let t = seg.start;
    for (const c of chunks) {
      const d = (dur * c.length) / total;
      out.push({ id: 0, start: t, end: t + d, text: c });
      t += d;
    }
  }
  return out.map((s, i) => ({ ...s, id: i + 1 }));
}

/** Wrap a cue into at most two balanced lines. */
function wrap(text: string, width = 42) {
  if (text.length <= width) return text;
  const mid = text.length / 2;
  let best = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  }
  return best < 0 ? text : `${text.slice(0, best)}\n${text.slice(best + 1)}`;
}

export function toSRT(segs: Segment[]) {
  return toCues(segs)
    .map((s, i) => `${i + 1}\n${clock(s.start)} --> ${clock(s.end)}\n${wrap(s.text)}\n`)
    .join("\n");
}

export function toVTT(segs: Segment[]) {
  return (
    "WEBVTT\n\n" +
    toCues(segs)
      .map((s, i) => `${i + 1}\n${clock(s.start, ".")} --> ${clock(s.end, ".")}\n${wrap(s.text)}\n`)
      .join("\n")
  );
}

export function toTXT(segs: Segment[], timestamps: boolean) {
  if (timestamps) return segs.map((s) => `[${shortClock(s.start)}] ${s.text.trim()}`).join("\n");
  // Group into paragraphs at long pauses for a readable transcript.
  const paras: string[] = [];
  let cur = "";
  segs.forEach((s, i) => {
    cur += (cur ? " " : "") + s.text.trim();
    const gap = segs[i + 1] ? segs[i + 1].start - s.end : 99;
    if (gap > 2 || cur.length > 700) {
      paras.push(cur);
      cur = "";
    }
  });
  if (cur) paras.push(cur);
  return paras.join("\n\n");
}

export function toCSV(segs: Segment[]) {
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return "index,start,end,text\n" + segs.map((s, i) => `${i + 1},${clock(s.start)},${clock(s.end)},${q(s.text.trim())}`).join("\n");
}

export function toJSON(segs: Segment[], meta: Record<string, unknown>) {
  return JSON.stringify({ ...meta, segments: segs }, null, 2);
}

export function download(name: string, content: string | Blob, mime = "text/plain;charset=utf-8") {
  const blob = typeof content === "string" ? new Blob(["﻿" + content], { type: mime }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const baseName = (n: string) => n.replace(/\.[^.]+$/, "") || "transcript";
