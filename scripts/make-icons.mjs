// Regenerates PNG app icons from public/icons/icon.svg. Run: node scripts/make-icons.mjs
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(root, "public", "icons", "icon.svg"));

for (const size of [192, 512]) {
  await sharp(svg).resize(size, size).png().toFile(join(root, "public", "icons", `icon-${size}.png`));
}
// Maskable: full-bleed square so Android can crop it into any shape.
await sharp(svg).resize(512, 512).flatten({ background: "#047857" }).png()
  .toFile(join(root, "public", "icons", "maskable-512.png"));
await sharp(svg).resize(180, 180).flatten({ background: "#047857" }).png()
  .toFile(join(root, "app", "apple-icon.png"));
console.log("icons written");
