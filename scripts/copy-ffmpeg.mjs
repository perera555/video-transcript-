// Copies the ffmpeg.wasm class worker into /public so it can be served from the
// same origin (browsers refuse cross-origin module workers). Runs on postinstall.
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "@ffmpeg", "ffmpeg", "dist", "esm");
const dest = join(root, "public", "ffmpeg");

if (!existsSync(src)) {
  console.warn("[copy-ffmpeg] @ffmpeg/ffmpeg not installed yet, skipping");
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
// The whole ESM build is served statically and imported at runtime, so the
// bundler never tries to resolve ffmpeg's internal `new Worker(new URL(...))`.
for (const f of readdirSync(src).filter((f) => f.endsWith(".js"))) {
  cpSync(join(src, f), join(dest, f));
}
console.log("[copy-ffmpeg] ffmpeg.wasm ESM copied to public/ffmpeg");
