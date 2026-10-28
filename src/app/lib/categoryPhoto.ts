import { CORNER_CATEGORIES } from "../data/cornerCategories";
import { hasHobbyPhoto } from "../data/hobbyPhotos";
import { cornerKey, homeCornersIn, type HomeCorner } from "../data/homeCorners";
import { cornerPhoto } from "./cornerPhoto";

/**
 * The Corner whose photo stands for each of the 18 categories: the first
 * curated Corner in it that has a photo of its own, else the first Corner of
 * any kind that has one. No two categories use the same picture, so a row of
 * 18 tiles never repeats an image (a category takes its next candidate when an
 * earlier category already used its first).
 */
const PICKS = (() => {
  const used = new Set<string>();
  const out = new Map<string, HomeCorner>();
  for (const cat of CORNER_CATEGORIES) {
    const own = homeCornersIn(cat.slug).filter((c) => hasHobbyPhoto(c.slug));
    const ordered = [...own.filter((c) => c.curated), ...own.filter((c) => !c.curated)];
    const pick = ordered.find((c) => !used.has(cornerPhoto(c.spaceSlug, c.slug) ?? cornerKey(c)));
    const chosen = pick ?? homeCornersIn(cat.slug)[0];
    if (!chosen) continue;
    used.add(cornerPhoto(chosen.spaceSlug, chosen.slug) ?? cornerKey(chosen));
    out.set(cat.slug, chosen);
  }
  return out;
})();

export function categoryPhotoCorner(categorySlug: string): HomeCorner | undefined {
  return PICKS.get(categorySlug);
}
