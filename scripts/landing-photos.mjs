// Rebuild only the uploaded landing photographs. Originals are kept outside Git.
// node scripts/landing-photos.mjs /path/to/extracted-originals
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = process.argv[2];
if (!input) throw new Error("Pass the directory containing the six original JPEG files.");
const definitions = [
  { key: "painting", file: "sincerely-media-s3tPywNsLSo-unsplash.jpg", credit: "Sincerely Media", id: "s3tPywNsLSo", crop: { left: 0, top: 1500, width: 3456, height: 2160 } },
  { key: "guitar", file: "parker-coffman-GgsG8aNLgjQ-unsplash.jpg", credit: "Parker Coffman", id: "GgsG8aNLgjQ", crop: { left: 0, top: 100, width: 2936, height: 1835 } },
  { key: "photography", file: "alex-gorin-31KvOn6d818-unsplash.jpg", credit: "Alex Gorin", id: "31KvOn6d818", crop: { left: 0, top: 140, width: 5143, height: 3214 } },
  { key: "cooking", file: "maarten-van-den-heuvel-EzH46XCDQRY-unsplash.jpg", credit: "Maarten van den Heuvel", id: "EzH46XCDQRY", crop: { left: 0, top: 0, width: 4032, height: 2520 } },
  { key: "reading", file: "sergei-nikulin-tglfT2WsX8E-unsplash.jpg", credit: "Sergei Nikulin", id: "tglfT2WsX8E", crop: { left: 0, top: 86, width: 4152, height: 2595 } },
  { key: "reading-outside", file: "paniz-gm-XGZ72Knysyg-unsplash.jpg", credit: "Paniz GM", id: "XGZ72Knysyg", crop: { left: 0, top: 2300, width: 4906, height: 3066 } },
];
const output = path.join(root, "public/landing/photos");
await fs.mkdir(output, { recursive: true });
const manifest = [];
for (const entry of definitions) {
  const original = await fs.readFile(path.join(input, entry.file));
  const metadata = await sharp(original).metadata();
  const variants = [];
  for (const width of [400, 800, 1600]) {
    const name = `${entry.key}-${width}.webp`;
    const result = await sharp(original).rotate().extract(entry.crop)
      .resize(width, Math.round(width * 10 / 16), { fit: "fill", withoutEnlargement: true })
      .webp({ quality: 82, effort: 6 }).toFile(path.join(output, name));
    variants.push({ file: name, width: result.width, height: result.height, bytes: result.size });
  }
  manifest.push({ ...entry, source: `https://unsplash.com/photos/${entry.id}`, license: "https://unsplash.com/license", provenance: "Owner-uploaded Archive.zip; source and credit recorded from the original filename, not independently fetched", sha256: crypto.createHash("sha256").update(original).digest("hex"), originalWidth: metadata.width, originalHeight: metadata.height, variants });
}
await fs.writeFile(path.join(output, "uploaded-photos.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Prepared ${manifest.length} photographs and ${manifest.reduce((n, item) => n + item.variants.length, 0)} WebP files (${manifest.reduce((n, item) => n + item.variants.reduce((s, v) => s + v.bytes, 0), 0)} bytes).`);
