import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");

async function png(svgPath, outPath, width, height = width) {
  const svg = await readFile(svgPath);
  await sharp(svg, { density: 384 })
    .resize(width, height, { fit: "contain", background: "#F5EAD5" })
    .png()
    .toFile(outPath);
  console.log(`wrote ${path.relative(root, outPath)} (${width}×${height})`);
}

await mkdir(path.join(publicDir, "images"), { recursive: true });

await png(path.join(publicDir, "favicon.svg"), path.join(publicDir, "favicon-32.png"), 32);
const icon = path.join(publicDir, "icon.svg");
await png(icon, path.join(publicDir, "apple-touch-icon.png"), 180);
await png(icon, path.join(publicDir, "icon-192.png"), 192);
await png(icon, path.join(publicDir, "icon-512.png"), 512);

const ogSvg = path.join(publicDir, "images", "og.svg");
await sharp(await readFile(ogSvg), { density: 192 })
  .resize(1200, 630)
  .png()
  .toFile(path.join(publicDir, "images", "og-default.png"));
console.log("wrote images/og-default.png (1200×630)");
