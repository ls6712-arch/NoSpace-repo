// The catalog merge, loaded the way build-catalog-corners.ts runs it, so anything that has to land on "the Corner people
// actually see" (the catalog Corners themselves, the activities for them) resolves a slug the same way.
import fs from "node:fs";
import path from "node:path";
import { canonicalCorner, hobbies } from "../src/app/data/hobbies";
import { csvRows, keptEntries, mergeCatalog, type ExistingCorner } from "./catalogCornersLogic";

export function loadCatalogMerge(root: string) {
  const snapshot = JSON.parse(fs.readFileSync(path.join(root, "data/existing_corners_snapshot.json"), "utf8"));
  const existing: ExistingCorner[] = [
    ...hobbies.flatMap((h) => h.subItems.map((s) => ({ spaceSlug: h.slug, slug: s.slug, name: s.label }))),
    ...(snapshot.corners as ExistingCorner[]),
  ];
  // De-dupe by space/slug (a table row for a curated Corner is the same Corner).
  const uniq = [...new Map(existing.map((c) => [`${c.spaceSlug}/${c.slug}`, c])).values()];
  const entries = keptEntries(csvRows(fs.readFileSync(path.join(root, "data/corners_catalog.csv"), "utf8")));
  const approvals = JSON.parse(fs.readFileSync(path.join(root, "data/catalog_merge_overrides.json"), "utf8"));
  const result = mergeCatalog(entries, uniq, {
    overrides: approvals.overrides as Record<string, string>,
    keepSeparate: approvals.keepSeparate as string[],
    acceptFollowOn: (approvals.acceptFollowOn ?? []) as string[],
    canonical: canonicalCorner,
  });
  return { entries, result, existing: uniq };
}
