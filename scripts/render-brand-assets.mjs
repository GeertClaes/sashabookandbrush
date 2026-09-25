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

const icon = path.join(publicDir, "favicon.svg");
await png(icon, path.join(publicDir, "favicon-32.png"), 32);
await png(icon, path.join(publicDir, "apple-touch-icon.png"), 180);
await png(icon, path.join(publicDir, "icon-192.png"), 192);
await png(icon, path.join(publicDir, "icon-512.png"), 512);
