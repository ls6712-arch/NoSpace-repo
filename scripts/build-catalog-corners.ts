/**
 * Reads data/corners_catalog.csv and writes src/app/data/catalogCorners.ts.
 * Existing Corners (hobbies.ts plus data/existing_corners_snapshot.json) always
 * win: a matching catalog row adds its aliases to the existing Corner and is
 * not created separately. Prints the match table for the PR.
 *
 * Usage: npx tsx scripts/build-catalog-corners.ts [--check]
 *   --check  exit 1 if the generated file is out of date, write nothing.
 */
import fs from "node:fs";
import path from "node:path";
import { canonicalCorner, hobbies } from "../src/app/data/hobbies";
import { csvRows, keptEntries, mergeCatalog, renderCatalogFile, type ExistingCorner } from "./catalogCornersLogic";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const csv = fs.readFileSync(path.join(root, "data/corners_catalog.csv"), "utf8");
const snapshot = JSON.parse(fs.readFileSync(path.join(root, "data/existing_corners_snapshot.json"), "utf8"));

const existing: ExistingCorner[] = [
  ...hobbies.flatMap((h) => h.subItems.map((s) => ({ spaceSlug: h.slug, slug: s.slug, name: s.label }))),
  ...(snapshot.corners as ExistingCorner[]),
];
// De-dupe by space/slug (a table row for a curated Corner is the same Corner).
const uniq = [...new Map(existing.map((c) => [`${c.spaceSlug}/${c.slug}`, c])).values()];

const entries = keptEntries(csvRows(csv));
const approvals = JSON.parse(fs.readFileSync(path.join(root, "data/catalog_merge_overrides.json"), "utf8"));
const overrides = approvals.overrides as Record<string, string>;
const keepSeparate = approvals.keepSeparate as string[];
const acceptFollowOn = (approvals.acceptFollowOn ?? []) as string[];
const result = mergeCatalog(entries, uniq, { overrides, keepSeparate, acceptFollowOn, canonical: canonicalCorner });
const out = renderCatalogFile(result);
const target = path.join(root, "src/app/data/catalogCorners.ts");

const table = (title: string, rows: { catalog: { name: string; spaceSlug: string }; existing: ExistingCorner; rule: string }[]) => {
  console.log(`\n${title}\n| Catalog name | Existing Corner | Rule |\n|---|---|---|`);
  for (const m of rows) console.log(`| ${m.catalog.name} (${m.catalog.spaceSlug}) | ${m.existing.name} (${m.existing.spaceSlug}/${m.existing.slug}) | ${m.rule} |`);
};
console.log(`kept ${entries.length}; catalog Corners ${result.fresh.length}; merged into existing ${result.merged.length}; held (other Space) ${result.crossSpace.length}; fuzzy suggestions ${result.suggested.length}`);
table("Merged (existing Corner wins):", result.merged);
table("Same hobby in another Space (no second Corner; the existing one gains the aliases, nyc_fit and season):", result.crossSpace);
table("Follow-on merges, NOT applied (the match was a Corner already merged away; decision for the founder):", result.followOn.map((m) => ({ ...m, rule: `${m.rule}, via ${m.via!.name}` })));
table("Fuzzy suggestions, NOT merged (add to data/catalog_merge_overrides.json to approve):", result.suggested);

if (process.argv.includes("--check")) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
  if (current !== out) {
    console.error("catalogCorners.ts is out of date. Run: npx tsx scripts/build-catalog-corners.ts");
    process.exit(1);
  }
} else {
  fs.writeFileSync(target, out);
  console.log(`\nwrote ${path.relative(root, target)}`);
}
