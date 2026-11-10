import { cornerHasStill } from "./cornerPicture";
import { yourCorners, type HomeCorner } from "./homeYourCorners";
import { pickKey } from "./tasteRemote";

/** The most Corners the Home row shows. */
export const HOME_ROW_CORNERS = 6;

/**
 * The Corners a person follows that the app knows: each has a real name and a page. A follow of a whole Space
 * (`space:<space-slug>`), an empty key, or a key for a Corner that is not in the catalog is not one of them.
 */
export function followedCorners(followed: readonly string[], known: readonly HomeCorner[]): HomeCorner[] {
  const isKnown = new Set(known);
  return yourCorners(followed, known, [], Number.POSITIVE_INFINITY).corners.filter((c) => isKnown.has(c));
}

/**
 * Which Corners the Home row shows: the Corners with a 3D world, for everyone (founder, Nov 10, 2026; before
 * that, someone who followed Corners saw only those, which hid the 3D Corners from them).
 *
 * Order: the ones the person follows first, then their onboarding picks, then by `my_corner_affinity()`, then
 * the rest in catalog order. A visitor follows nothing and has no picks or affinity, so catalog order.
 * A followed Corner without a 3D world is not in this row; it still feeds Still making on Home.
 */
export function homeCornersRow(o: {
  followed: readonly string[];
  /** Every known Corner, in catalog order. */
  known: readonly HomeCorner[];
  /** Onboarding picks, as "space-slug/corner-slug". */
  picks: readonly string[];
  /** `my_corner_affinity()`, by "space-slug/corner-slug". */
  affinity: ReadonlyMap<string, number>;
  limit?: number;
}): HomeCorner[] {
  const key = (c: HomeCorner) => pickKey(c.spaceSlug, c.slug);
  const seen = new Set<string>();
  // The Corner itself, once: not a Corner that was merged into it (that one opens the same page).
  const withWorld = o.known.filter((c) => cornerHasStill(c.spaceSlug, c.slug) && key(c) === `${c.spaceSlug}/${c.slug}` && !seen.has(c.slug) && seen.add(c.slug));
  // A follow of a Corner that was merged into one of these counts as following the kept Corner.
  const followed = new Set(followedCorners(o.followed, o.known).map(key));
  const rank = (c: HomeCorner) => (followed.has(key(c)) ? 0 : 1);
  const pickAt = (c: HomeCorner) => {
    const i = o.picks.indexOf(key(c));
    return i < 0 ? Number.POSITIVE_INFINITY : i;
  };
  // Array.sort is stable, so Corners that tie on all three stay in catalog order. (Infinity - Infinity is NaN, hence the comparison.)
  const byPick = (a: HomeCorner, b: HomeCorner) => (pickAt(a) === pickAt(b) ? 0 : pickAt(a) < pickAt(b) ? -1 : 1);
  return [...withWorld]
    .sort((a, b) => rank(a) - rank(b) || byPick(a, b) || (o.affinity.get(key(b)) ?? 0) - (o.affinity.get(key(a)) ?? 0))
    .slice(0, o.limit ?? HOME_ROW_CORNERS);
}
