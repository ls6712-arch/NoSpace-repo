// Validate the editorial draft without loading it into the application.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "docs/content/starter-batch-01");
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
const pack = read("content.json");
const manifest = read("image-manifest.json");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "soosh-content-check-"));

try {
  const bundled = path.join(temporary, "catalog.cjs");
  await build({
    stdin: {
      contents: 'export { CORNER_GUIDES } from "./src/app/data/cornerGuides"; export { CORNER_IDEAS } from "./src/app/data/cornerIdeas"; export { isBrowsableCorner } from "./src/app/data/hobbies";',
      resolveDir: root,
    },
    bundle: true, platform: "node", format: "cjs", outfile: bundled, logLevel: "silent",
  });
  const catalog = createRequire(import.meta.url)(bundled);
  const records = [...pack.activities, ...pack.pursuit_templates];
  assert.equal(pack.status, "draft_for_review");
  assert.equal(pack.activities.length, 30);
  assert.equal(pack.pursuit_templates.length, 10);
  assert.equal(new Set(records.map(record => record.id)).size, records.length);
  assert.equal(new Set(records.map(record => record.corner_key)).size, 10);
  for (const record of records) {
    assert.equal(record.status, "draft", record.id);
    assert(catalog.isBrowsableCorner(...record.corner_key.split("/")), record.corner_key);
    assert(catalog.CORNER_GUIDES[record.corner_key], record.corner_key);
    assert(catalog.CORNER_IDEAS[record.corner_key], record.corner_key);
    assert(!/[\u2013\u2014]/.test(record.title), record.title);
    assert(!("user_id" in record) && !("owner_id" in record), "Editorial templates must not be member records");
  }
  for (const activity of pack.activities) {
    assert.equal(activity.steps.length, 3, activity.id);
    assert(activity.duration.min_minutes > 0 && activity.duration.max_minutes >= activity.duration.min_minutes, activity.id);
    assert.equal(activity.cost.total_status, "unknown");
    assert.equal(activity.cost.amount, null);
    assert(activity.requirements.required.length || activity.requirements.choose_one_groups.length, activity.id);
    for (const item of activity.requirements.optional) assert(!activity.requirements.required.includes(item), activity.id);
    for (const group of activity.requirements.choose_one_groups) {
      assert(group.options.length >= 2, activity.id);
      assert(group.options.every(option => option.required_items.length > 0), activity.id);
    }
    assert(!Object.values(catalog.CORNER_IDEAS).some(idea => idea.ideaTitle.toLowerCase() === activity.title.toLowerCase()), activity.title);
  }
  for (const pursuit of pack.pursuit_templates) {
    assert.equal(pursuit.milestones.length, 3, pursuit.id);
    assert.equal(pursuit.starting_activity_ids.length, 3, pursuit.id);
    for (const id of pursuit.starting_activity_ids) assert(pack.activities.some(activity => activity.id === id && activity.corner_key === pursuit.corner_key), id);
  }
  assert.deepEqual(pack.corner_images, manifest.assets);
  const assets = new Map(manifest.assets.map(asset => [asset.id, asset]));
  let variants = 0;
  for (const image of manifest.assets.filter(asset => asset.status === "attached")) {
    assert(image.credit && image.source && image.alt, image.id);
    for (const variant of image.variants) {
      const file = path.resolve(dir, variant.path);
      assert(file.startsWith(path.join(root, "public/landing/photos") + path.sep), variant.path);
      const bytes = fs.readFileSync(file);
      assert.equal(bytes.length, variant.bytes, variant.path);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), variant.sha256, variant.path);
      variants++;
    }
  }
  for (const record of records) {
    if (record.image_status === "attached") assert.equal(assets.get(record.corner_cover_asset_id)?.corner_key, record.corner_key);
    else assert.equal(record.corner_cover_asset_id, null);
  }
  assert.equal(manifest.assets.filter(asset => asset.status === "attached").length, 6);
  assert.equal(manifest.assets.filter(asset => asset.status === "needs_photo").length, 4);
  assert.equal(variants, 17);
  console.log("Content batch: 30 activity drafts, 10 Pursuit templates, 10 existing Corners and 17 image variants validated. Four covers remain pending. Nothing published.");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
