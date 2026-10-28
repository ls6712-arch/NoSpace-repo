import { CURATED_CORNERS, type CuratedCorner } from "../data/curatedCorners";
import { cornerKey } from "../data/homeCorners";
import { cornerPhoto } from "./cornerPhoto";
import { thisWeek, type CornerLive } from "./cornersLive";

const WEEK_MS = 7 * 24 * 3_600_000;
export const BILLBOARD_SLIDES = 5;

/**
 * The Corners in the billboard at the top of /corners. First the curated
 * Corners with events this week (most events first), then, to fill the
 * slides, the rest of the curated Corners that have a photo, starting from a
 * different place each week, or, for a person with a taste profile, the best
 * fits (recommend.ts). The first slide is the "Corner of the week".
 */
export function billboardCorners(
  live: ReadonlyMap<string, CornerLive>,
  now = Date.now(),
  n = BILLBOARD_SLIDES,
  /** A person's own score for a Corner, when there is one: the slides after the events are then the best fits instead of the week's rotation. */
  score?: (x: CuratedCorner) => number,
): CuratedCorner[] {
  const withEvents = CURATED_CORNERS.map((x) => ({ x, n: thisWeek(live.get(cornerKey(x))?.events ?? [], now).length }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n)
    .map((r) => r.x);
  const picked = withEvents.slice(0, n);
  const rest = CURATED_CORNERS.filter((x) => !picked.includes(x) && cornerPhoto(x.spaceSlug, x.slug));
  if (score && rest.length > 0) {
    for (const x of [...rest].sort((a, b) => score(b) - score(a)).slice(0, Math.max(0, n - picked.length))) picked.push(x);
  } else if (rest.length > 0) {
    const start = Math.floor(now / WEEK_MS) % rest.length;
    for (let i = 0; picked.length < n && i < rest.length; i++) picked.push(rest[(start + i) % rest.length]);
  }
  return picked;
}
