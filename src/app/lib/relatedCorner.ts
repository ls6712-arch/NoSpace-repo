import { categoryOfCorner } from "../data/cornerCategories";
import { homeCornersIn, type HomeCorner } from "../data/homeCorners";
import { hasHobbyPhoto } from "../data/hobbyPhotos";
import { similarity, traitsOf } from "./cornerSimilarity";

/**
 * "People who make pasta also try Sourdough": the most alike Corner in the same
 * group, from facts about the activities (cornerSimilarity.ts), never from what
 * people did. Only Corners with a photo of their own, never adults-only ones.
 */
export function relatedCorner(spaceSlug: string, slug: string): HomeCorner | undefined {
  const category = categoryOfCorner(spaceSlug, slug);
  if (!category) return undefined;
  const here = homeCornersIn(category.slug).find((c) => c.slug === slug);
  const traits = here ? traitsOf(here) : undefined;
  let best: { corner: HomeCorner; score: number } | undefined;
  for (const c of homeCornersIn(category.slug)) {
    if (c.slug === slug || !hasHobbyPhoto(c.slug)) continue;
    const t = traitsOf(c);
    if (t.adultsOnly) continue;
    const score = traits ? similarity(traits, t) : 0;
    if (!best || score > best.score || (score === best.score && c.name.localeCompare(best.corner.name) < 0)) best = { corner: c, score };
  }
  return best?.corner;
}
