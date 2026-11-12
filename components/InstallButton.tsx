"use client";
import { useEffect, useState } from "react";
import { Button, Icon } from "./ui";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Full-width strip at the very top of the page inviting users to install the app. */
export function InstallBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem("vtg-install-dismissed") === "1"; } catch {}
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    setShow(!dismissed && !standalone);
  }, []);
  if (!show) return null;
  return (
    <div className="relative z-50 bg-gradient-to-r from-emerald-700 via-green-600 to-lime-600 text-white" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 sm:px-6">
        <span className="text-lg">📲</span>
        <p className="min-w-0 flex-1 text-xs font-semibold sm:text-sm">
          <b>Install SubtitleAI</b><span className="hidden sm:inline"> — free app for Windows, Mac, Android &amp; iPhone. Opens in its own window, works offline.</span>
        </p>
        <InstallButton light />
        <button onClick={() => { setShow(false); try { localStorage.setItem("vtg-install-dismissed", "1"); } catch {} }}
          aria-label="Dismiss" className="rounded-full p-1 text-white/80 hover:bg-white/15"><Icon name="x" className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export default function InstallButton({ light = false }: { light?: boolean }) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "mac" | "desktop">("desktop");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
      // Hand the worker everything this page loaded so the app works offline right away.
      navigator.serviceWorker.ready.then((reg) => {
        const urls = performance.getEntriesByType("resource").map((e) => e.name).filter((u) => {
          try {
            const url = new URL(u);
            return (url.origin === location.origin && /^\/(_next\/static|icons|ffmpeg|workers)\//.test(url.pathname)) ||
              url.hostname === "cdn.jsdelivr.net" || url.hostname === "unpkg.com";
          } catch { return false; }
        });
        reg.active?.postMessage({ type: "precache", urls: [location.origin + "/", ...urls] });
      }).catch(() => {});
    }
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
    setPlatform(ios ? "ios" : /Android/.test(ua) ? "android" : /Mac/.test(ua) ? "mac" : "desktop");
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);

    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-300">✓ App installed</span>;
  }

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferred(null);
    } else setHelp(true);
  };

  const steps: Record<typeof platform, string[]> = {
    ios: ["Open this site in Safari", "Tap the Share button (square with ↑ arrow)", "Choose “Add to Home Screen”", "Tap “Add” — SubtitleAI is now an app on your iPhone/iPad"],
    android: ["Open this site in Chrome", "Tap the ⋮ menu (top right)", "Choose “Install app” or “Add to Home screen”", "Confirm — the app appears in your app drawer"],
    mac: ["Chrome / Edge: click the install icon ⊕ in the address bar, or ⋮ → “Install SubtitleAI”", "Safari (macOS Sonoma+): File → “Add to Dock”", "The app opens in its own window from Launchpad / Dock"],
    desktop: ["Chrome / Edge: click the install icon ⊕ in the address bar", "Or open ⋮ menu → “Install SubtitleAI”", "The app gets a Start-menu / desktop shortcut and its own window"],
  };

  return (
    <>
      {light ? (
        <button onClick={install} className="btn inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-extrabold text-emerald-800 shadow-[0_3px_0_#064e3b] sm:text-sm">
          <Icon name="install" className="h-4 w-4" /> Install
        </button>
      ) : (
        <Button onClick={install} className="!rounded-full !px-4 !py-2">
          <Icon name="install" className="h-4 w-4" /> <span className="hidden sm:inline">Install App</span><span className="sm:hidden">Install</span>
        </Button>
      )}
      {help && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-emerald-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={() => setHelp(false)}>
          <div className="glass-solid w-full max-w-md rounded-3xl p-6 text-emerald-950" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Install SubtitleAI</h3>
              <button onClick={() => setHelp(false)} className="rounded-full p-1 hover:bg-emerald-100" aria-label="Close"><Icon name="x" /></button>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {(["ios", "android", "mac", "desktop"] as const).map((p) => (
                <button key={p} onClick={() => setPlatform(p)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${platform === p ? "btn-gradient text-white ring-transparent" : "ring-emerald-900/15 text-emerald-900/70"}`}>
                  {{ ios: "iPhone / iPad", android: "Android", mac: "Mac", desktop: "Windows / Linux" }[p]}
                </button>
              ))}
            </div>
            <ol className="space-y-3">
              {steps[platform].map((s, i) => (
                <li key={i} className="flex gap-3 text-sm text-emerald-950/80">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
