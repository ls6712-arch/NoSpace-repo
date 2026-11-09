import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";

// The founder-uploaded ZIP is checked into the feature branch. Extract only
// expected WebP files; never trust arbitrary archive paths or ZIP metadata.
const zip = readFileSync(new URL("../soosh_gardening_20_images.zip", import.meta.url));
const names = ["01-start-seeds.webp","02-balcony-garden.webp","03-indoor-herbs.webp","04-repot-refresh.webp","05-terrarium.webp","06-grow-food.webp","07-propagate-plants.webp","08-low-maintenance-plants.webp","09-raised-bed.webp","10-plant-with-friends.webp","11-diy-pots.webp","12-cut-flowers.webp","13-strawberries.webp","14-plant-journal.webp","15-seed-library.webp","16-pollinator-garden.webp","17-compost.webp","18-citrus-tree.webp","19-vertical-garden.webp","20-garden-nook.webp"];
const expected = new Set(names);
const extracted = new Set();
const destination = new URL("../public/gardening/", import.meta.url);
mkdirSync(destination, { recursive: true });
let offset = 0;
while (offset + 30 <= zip.length && zip.readUInt32LE(offset) === 0x04034b50) {
  const flags = zip.readUInt16LE(offset + 6);
  const method = zip.readUInt16LE(offset + 8);
  const compressedSize = zip.readUInt32LE(offset + 18);
  const uncompressedSize = zip.readUInt32LE(offset + 22);
  const nameLength = zip.readUInt16LE(offset + 26);
  const extraLength = zip.readUInt16LE(offset + 28);
  if (flags & 0x08) throw new Error("Unsupported ZIP data descriptor");
  const filename = zip.subarray(offset + 30, offset + 30 + nameLength).toString("utf8");
  const dataStart = offset + 30 + nameLength + extraLength;
  const dataEnd = dataStart + compressedSize;
  if (dataEnd > zip.length) throw new Error("Truncated gardening ZIP");
  if (!expected.has(filename) || extracted.has(filename)) throw new Error(`Unexpected/duplicate ZIP entry: ${filename}`);
  if (uncompressedSize > 2_000_000) throw new Error(`Image exceeds 2 MB: ${filename}`);
  const content = method === 8 ? inflateRawSync(zip.subarray(dataStart, dataEnd)) :
    method === 0 ? zip.subarray(dataStart, dataEnd) : null;
  if (!content || content.length !== uncompressedSize) throw new Error(`Invalid ZIP data: ${filename}`);
  if (content.toString("ascii", 0, 4) !== "RIFF" || content.toString("ascii", 8, 12) !== "WEBP")
    throw new Error(`Not a WebP image: ${filename}`);
  writeFileSync(new URL(filename, destination), content);
  extracted.add(filename);
  offset = dataEnd;
}
if (extracted.size !== names.length) throw new Error(`Expected 20 gardening images, found ${extracted.size}`);
console.log(`Extracted ${extracted.size} original gardening images to public/gardening`);
