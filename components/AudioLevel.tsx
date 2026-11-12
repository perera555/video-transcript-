"use client";
import { useEffect, useRef } from "react";

// Live audio level meter + mini spectrum. Works with a <video>/<audio> element
// or a microphone MediaStream.
const sources = new WeakMap<HTMLMediaElement, { ctx: AudioContext; node: MediaElementAudioSourceNode }>();

export default function AudioLevel({
  media, stream, className = "",
}: { media?: HTMLMediaElement | null; stream?: MediaStream | null; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let raf = 0;
    let ownCtx = false;
    let streamNode: MediaStreamAudioSourceNode | null = null;

    const setup = () => {
      if (analyser) return;
      try {
        if (media) {
          let entry = sources.get(media);
          if (!entry) {
            const c = new AudioContext();
            entry = { ctx: c, node: c.createMediaElementSource(media) };
            entry.node.connect(c.destination);
            sources.set(media, entry);
          }
          ctx = entry.ctx;
          analyser = ctx.createAnalyser();
          entry.node.connect(analyser);
          ctx.resume().catch(() => {});
        } else if (stream) {
          ctx = new AudioContext();
          ownCtx = true;
          analyser = ctx.createAnalyser();
          streamNode = ctx.createMediaStreamSource(stream);
          streamNode.connect(analyser);
        }
        if (analyser) analyser.fftSize = 256;
      } catch {}
    };

    if (stream) setup();
    const onPlay = () => { setup(); ctx?.resume().catch(() => {}); };
    media?.addEventListener("play", onPlay);
    if (media && !media.paused) onPlay();

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const cv = canvas.current;
      if (!cv) return;
      const g = cv.getContext("2d");
      if (!g) return;
      const dpr = window.devicePixelRatio || 1;
      const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const bars = 32;
      const data = new Uint8Array(analyser ? analyser.frequencyBinCount : bars);
      if (analyser) analyser.getByteFrequencyData(data);
      const bw = w / bars;
      const grad = g.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, "#059669"); grad.addColorStop(0.55, "#22c55e"); grad.addColorStop(1, "#a3e635");
      g.fillStyle = grad;
      for (let i = 0; i < bars; i++) {
        const v = data[Math.floor((i / bars) * data.length * 0.7)] / 255;
        const bh = Math.max(2, v * h);
        g.globalAlpha = 0.35 + v * 0.65;
        g.beginPath();
        g.roundRect(i * bw + 1.5, h - bh, Math.max(1, bw - 3), bh, 2);
        g.fill();
      }
      g.globalAlpha = 1;
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      media?.removeEventListener("play", onPlay);
      try { analyser?.disconnect(); streamNode?.disconnect(); } catch {}
      if (ownCtx) ctx?.close().catch(() => {});
    };
  }, [media, stream]);

  return <canvas ref={canvas} className={`h-10 w-full ${className}`} aria-label="Audio level" />;
}
