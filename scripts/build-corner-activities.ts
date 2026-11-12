/**
 * Reads data/corner_activities.csv and writes src/app/data/cornerActivities.ts.
 * Every corner_slug is resolved through the same catalog merge the Corners went through, so an activity lands on
 * the Corner people actually see. A slug that does not resolve stops the build and is listed.
 *
 * Usage: npx tsx scripts/build-corner-activities.ts [--check]
 *   --check  exit 1 if the generated file is out of date, write nothing.
 */
import fs from "node:fs";
import path from "node:path";
import { hobbies } from "../src/app/data/hobbies";
import { parseActivities, renderActivitiesFile, resolveActivities } from "./cornerActivitiesLogic";
import { loadCatalogMerge } from "./catalogMerge";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const rows = parseActivities(fs.readFileSync(path.join(root, "data/corner_activities.csv"), "utf8"));
const { result } = loadCatalogMerge(root);

// slug -> the Corner it lands on: a catalog Corner under its own slug, a merged one on the existing Corner, else a built-in Corner.
const landing = new Map<string, { spaceSlug: string; slug: string }>();
for (const h of hobbies) for (const s of h.subItems) if (!landing.has(s.slug)) landing.set(s.slug, { spaceSlug: h.slug, slug: s.slug });
for (const c of result.fresh) landing.set(c.slug, { spaceSlug: c.spaceSlug, slug: c.slug });
for (const m of [...result.merged, ...result.crossSpace]) landing.set(m.catalog.slug, { spaceSlug: m.existing.spaceSlug, slug: m.existing.slug });

const { resolved, unresolved } = resolveActivities(rows, (slug) => landing.get(slug) ?? null);
if (unresolved.length > 0) {
  console.error(`These corner_slug values do not resolve to a Corner (nothing written):\n${unresolved.map((u) => `  - ${u}`).join("\n")}`);
  process.exit(1);
}
const merged = new Set(result.merged.map((m) => m.catalog.slug));
console.log(`${resolved.length} activities on ${new Set(resolved.map((a) => a.cornerSlug)).size} Corners; resolved through the catalog merge (${[...new Set(resolved.map((a) => a.cornerSlug))].filter((s) => merged.has(s)).length} onto an existing Corner of the same slug).`);

const out = renderActivitiesFile(resolved);
const target = path.join(root, "src/app/data/cornerActivities.ts");
if (process.argv.includes("--check")) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
  if (current !== out) {
    console.error("cornerActivities.ts is out of date. Run: npx tsx scripts/build-corner-activities.ts");
    process.exit(1);
  }
} else {
  fs.writeFileSync(target, out);
  console.log(`wrote ${path.relative(root, target)}`);
}
