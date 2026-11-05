// Validate the draft directory without requesting sites or publishing links.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const folder = path.join(root, "docs/content/website-directory");
const directory = JSON.parse(fs.readFileSync(path.join(folder, "websites.json"), "utf8"));
const records = directory.resources;
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "soosh-directory-check-"));

try {
  const bundled = path.join(temporary, "corners.cjs");
  await build({
    stdin: { contents: 'export { CORNER_GUIDES } from "./src/app/data/cornerGuides"; export { isBrowsableCorner } from "./src/app/data/hobbies";', resolveDir: root },
    bundle: true, platform: "node", format: "cjs", outfile: bundled, logLevel: "silent",
  });
  const catalog = createRequire(import.meta.url)(bundled);
  assert.equal(directory.status, "draft_link_directory");
  assert.equal(records.length, 16);
  assert.equal(new Set(records.map(record => record.id)).size, 16);
  assert.equal(new Set(records.map(record => record.url)).size, 16);
  const readable = fs.readFileSync(path.join(folder, "websites.md"), "utf8");
  for (const record of records) {
    const url = new URL(record.url);
    assert.equal(url.protocol, "https:", record.id);
    assert.equal(url.username, "", record.id);
    assert.equal(url.password, "", record.id);
    assert(url.hostname.includes("."), record.id);
    assert(record.name && record.description && record.rights_note, record.id);
    assert.equal(record.presentation, "outbound_link_only", record.id);
    assert.equal(record.thumbnail, "none", record.id);
    assert.equal(record.copyright_status, "not_assumed_copyright_free", record.id);
    assert.equal(record.reuse_permission, "not_assessed_do_not_republish_from_this_listing", record.id);
    assert.equal(record.verification_status, "known_source_candidate_not_live_verified", record.id);
    assert.equal(record.listing_review.approved_for_listing, false, record.id);
    for (const field of ["last_live_checked_at", "current_terms_checked_at", "audience_suitability_checked_at"]) {
      assert.equal(record.listing_review[field], null, record.id);
    }
    assert.equal(record.corner_keys.length, record.suggested_corners.length, record.id);
    for (const key of record.corner_keys) {
      assert(catalog.CORNER_GUIDES[key], key);
      assert(catalog.isBrowsableCorner(...key.split("/")), key);
    }
    assert(readable.includes(record.url) && readable.includes(record.name), record.id);
  }
  console.log("Website directory: 16 unique HTTPS candidates, valid Corner mappings, link-only scope and explicit pending review validated. No network or publication performed.");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
