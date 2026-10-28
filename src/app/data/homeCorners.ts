import { hobbies, isBrowsableCorner } from "./hobbies";
import { cornersInCategory } from "./cornerCategories";
import { curatedFor, type CuratedCorner } from "./curatedCorners";

/**
 * A built-in Corner as the Corners home lists it: every Corner in hobbies.ts,
 * once, under its group of 18. `curated` is set for the ones with a guide.
 * Corners of a hidden Space, database-only Corners, Corners merged into another
 * and Corners too thin to browse (hobbies.ts) are not listed.
 */
export interface HomeCorner {
  spaceSlug: string;
  slug: string;
  name: string;
  curated?: CuratedCorner;
}

export function homeCornersIn(categorySlug: string): HomeCorner[] {
  const out: HomeCorner[] = [];
  for (const { spaceSlug, cornerSlug } of cornersInCategory(categorySlug)) {
    const hobby = hobbies.find((h) => h.slug === spaceSlug);
    const name = hobby?.subItems.find((s) => s.slug === cornerSlug)?.label;
    if (!hobby || hobby.hidden || !name || !isBrowsableCorner(spaceSlug, cornerSlug)) continue;
    out.push({ spaceSlug, slug: cornerSlug, name, curated: curatedFor(spaceSlug, cornerSlug) });
  }
  return out;
}

/** The `${spaceSlug}/${slug}` key live data and Moment activity are joined on. */
export const cornerKey = (c: { spaceSlug: string; slug: string }) => `${c.spaceSlug}/${c.slug}`;
