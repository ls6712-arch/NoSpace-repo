import { hobbies, isBrowsableCorner } from "./hobbies";
import { catalogCategoryOf, cornersInCategory } from "./cornerCategories";
import { CATALOG_CORNERS } from "./catalogCorners";
import { CORNER_GUIDES } from "./cornerGuides";
import { curatedFor, type CuratedCorner } from "./curatedCorners";
import { hasHobbyPhoto, photoCredit } from "./hobbyPhotos";
import { hasActivities } from "../lib/cornerActivities";

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

/** A guide, or activities: a Corner with activities counts as having a guide (brief of Nov 7, 2026, 2.4). */
export const hasGuide = (spaceSlug: string, slug: string): boolean => `${spaceSlug}/${slug}` in CORNER_GUIDES || hasActivities(slug);

/** A Corner ships in the main grid only with a guide (or activities), a curated entry and its own photo with a credit (cornerCompleteness.test.ts). */
export function isCompleteCorner(spaceSlug: string, slug: string): boolean {
  return hasGuide(spaceSlug, slug) && !!curatedFor(spaceSlug, slug) && hasHobbyPhoto(slug) && !!photoCredit(slug);
}

/**
 * The catalog Corners (data/corners_catalog.csv) in a category, split: those that are complete
 * join the main grid, the rest are the "Not started here yet" chips. A catalog Corner moves from
 * the chips to the grid on its own the moment it has a guide, a curated entry and a photo.
 * `complete` is a parameter only so a test can promote one.
 */
export function catalogCornersIn(
  categorySlug: string,
  complete: (spaceSlug: string, slug: string) => boolean = isCompleteCorner,
): { grid: HomeCorner[]; notStarted: HomeCorner[] } {
  const grid: HomeCorner[] = [];
  const notStarted: HomeCorner[] = [];
  for (const c of CATALOG_CORNERS) {
    if (catalogCategoryOf(c.spaceSlug, c.slug)?.slug !== categorySlug) continue;
    if (!isBrowsableCorner(c.spaceSlug, c.slug)) continue;
    const hobby = hobbies.find((h) => h.slug === c.spaceSlug);
    if (hobby?.hidden) continue;
    const corner: HomeCorner = { spaceSlug: c.spaceSlug, slug: c.slug, name: c.name, curated: curatedFor(c.spaceSlug, c.slug) };
    (complete(c.spaceSlug, c.slug) ? grid : notStarted).push(corner);
  }
  notStarted.sort((a, b) => a.name.localeCompare(b.name));
  return { grid, notStarted };
}

/** Catalog Corners with no guide, curated entry or photo yet, for a category's "Not started here yet" chips. */
export const notStartedIn = (categorySlug: string): HomeCorner[] => catalogCornersIn(categorySlug).notStarted;

export function homeCornersIn(categorySlug: string): HomeCorner[] {
  const out: HomeCorner[] = [];
  for (const { spaceSlug, cornerSlug } of cornersInCategory(categorySlug)) {
    const hobby = hobbies.find((h) => h.slug === spaceSlug);
    const name = hobby?.subItems.find((s) => s.slug === cornerSlug)?.label;
    if (!hobby || hobby.hidden || !name || !isBrowsableCorner(spaceSlug, cornerSlug)) continue;
    out.push({ spaceSlug, slug: cornerSlug, name, curated: curatedFor(spaceSlug, cornerSlug) });
  }
  // Catalog Corners that have since become complete.
  out.push(...catalogCornersIn(categorySlug).grid);
  return out;
}

/** The `${spaceSlug}/${slug}` key live data and Moment activity are joined on. */
export const cornerKey = (c: { spaceSlug: string; slug: string }) => `${c.spaceSlug}/${c.slug}`;
