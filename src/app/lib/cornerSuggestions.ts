import { hobbies, isBrowsableCorner, findSpaceForInterest } from "../data/hobbies";

export interface CornerSuggestion {
  spaceSlug: string;
  slug: string;
  name: string;
}

export const MAX_CORNER_SUGGESTIONS = 3;

/**
 * Up to three Corners to offer on Posted for a Moment that has none. Only ever
 * offered: nothing here is applied until the person taps a chip. In order: the
 * Corner of the Pursuit it counts toward, Corners named by its tags, then other
 * Corners in its Space (A to Z).
 */
export function suggestCorners(input: {
  pursuitCorner?: { spaceSlug?: string; slug?: string };
  tags?: readonly string[];
  spaceSlug?: string;
}): CornerSuggestion[] {
  const out: CornerSuggestion[] = [];
  const add = (spaceSlug: string | undefined, slug: string | undefined) => {
    if (!spaceSlug || !slug || out.length >= MAX_CORNER_SUGGESTIONS) return;
    if (out.some((c) => c.slug === slug)) return;
    const name = hobbies.find((h) => h.slug === spaceSlug)?.subItems.find((s) => s.slug === slug)?.label;
    if (name) out.push({ spaceSlug, slug, name });
  };

  add(input.pursuitCorner?.spaceSlug, input.pursuitCorner?.slug);
  for (const tag of input.tags ?? []) {
    const match = findSpaceForInterest(tag);
    if (match) add(match.hobbySlug, match.slug);
  }
  const space = hobbies.find((h) => h.slug === input.spaceSlug);
  if (space) {
    const rest = space.subItems.filter((s) => isBrowsableCorner(space.slug, s.slug)).sort((a, b) => a.label.localeCompare(b.label));
    for (const s of rest) add(space.slug, s.slug);
  }
  return out;
}
