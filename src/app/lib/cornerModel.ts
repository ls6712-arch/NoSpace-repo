import { hobbies } from "../data/hobbies";
import { categoryOfCorner } from "../data/cornerCategories";
import { cornerGuide } from "../data/cornerGuides";
import { cornerMeta, curatedBySlug, howToStart, type CuratedCorner } from "../data/curatedCorners";

/**
 * What a Corner page needs, for any Corner. A curated Corner fills every field;
 * a built-in Corner with no curated entry has only its name, its guide's
 * description and single step, and its category; a database-only Corner has
 * a name and maybe a description someone gave it. A section with nothing to
 * show is hidden by the page, never filled with a placeholder.
 */
export interface CornerModel {
  /** The old Space the Corner sits under, as Moments and Spaces reach it. */
  spaceSlug: string;
  slug: string;
  name: string;
  emoji?: string;
  /** "3 hr · Anywhere", only when the Corner has a duration and a setting. */
  meta?: string;
  about?: string;
  steps: string[];
  worth: string[];
  needs: string[];
  /** One of the 18, when the Corner is in one. */
  categorySlug?: string;
  curated?: CuratedCorner;
}

export function curatedModel(x: CuratedCorner): CornerModel {
  return {
    spaceSlug: x.spaceSlug,
    slug: x.slug,
    name: x.name,
    emoji: x.emoji || undefined,
    meta: cornerMeta(x) || undefined,
    about: cornerGuide(x.spaceSlug, x.slug)?.about,
    steps: howToStart(x),
    worth: x.worth,
    needs: x.needs,
    categorySlug: categoryOfCorner(x.spaceSlug, x.slug)?.slug,
    curated: x,
  };
}

/** A built-in Corner with no curated entry: what hobbies.ts, cornerGuides.ts and cornerCategories.ts know. */
export function plainModel(spaceSlug: string, slug: string, name: string, description?: string): CornerModel {
  const guide = cornerGuide(spaceSlug, slug);
  return {
    spaceSlug,
    slug,
    name,
    // A description someone gave the Corner wins; otherwise the library's.
    about: description?.trim() || guide?.about,
    steps: guide?.step ? [guide.step] : [],
    worth: [],
    needs: [],
    categorySlug: categoryOfCorner(spaceSlug, slug)?.slug,
  };
}

/**
 * The page model for a bare slug: the curated Corner, else the first built-in
 * Corner in hobbies.ts with that slug (the three Corners in two Spaces are one
 * Corner each, so the first match is the one), else undefined. Database-only
 * Corners are resolved by the page from its Corners context.
 */
export function builtInCornerModel(slug: string): CornerModel | undefined {
  const curated = curatedBySlug(slug);
  if (curated) return curatedModel(curated);
  for (const h of hobbies) {
    const sub = h.subItems.find((s) => s.slug === slug);
    if (sub) return plainModel(h.slug, slug, sub.label);
  }
  return undefined;
}
