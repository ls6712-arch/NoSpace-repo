import { hobbies } from "../data/hobbies";
import { curatedBySlug } from "../data/curatedCorners";

/**
 * Where a Corner's page lives. A curated Corner has the Corners page
 * (/corners/:slug); every other Corner keeps the older one (/corner/:slug).
 * Pass the old Space slug when it is known, so a slug two Spaces share is
 * only treated as curated under the Space that curates it.
 */
export function cornerPath(spaceSlug: string | undefined, slug: string): string {
  const curated = curatedBySlug(slug);
  return curated && (spaceSlug === undefined || curated.spaceSlug === spaceSlug) ? `/corners/${slug}` : `/corner/${slug}`;
}

/**
 * The /corner/:slug route resolves a bare slug to the first Space in
 * hobbies.ts that has it. It goes to the Corners page only when that Corner
 * is the curated one, so an old link never lands on a different Corner.
 */
export function curatedRedirectFor(slug: string): string | null {
  const curated = curatedBySlug(slug);
  if (!curated) return null;
  const first = hobbies.find((h) => h.subItems.some((s) => s.slug === slug));
  return first?.slug === curated.spaceSlug ? `/corners/${slug}` : null;
}
