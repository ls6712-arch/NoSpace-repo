import { categoryOfCorner, cornersInCategory } from "../../data/cornerCategories";
import type { CornerGuide } from "../../data/cornerGuides";
import { DAY_MS, clamp01, decay, squash } from "./math";
import { DEFAULT_WEIGHTS, type RankingWeights } from "./weights";
import { cornerKey, type CornerEvent, type Interaction, type RankPost, type Signals } from "./types";

/**
 * The features of the ranking (brief §4.3). Every one returns 0 to 1, and
 * every one is a pure function of the arguments: nothing here reads a global,
 * the clock (pass `now`), or anything about an author beyond what the viewer
 * did toward them.
 */

const INTERACTION_WINDOW_DAYS = 90;

/** How much the viewer's actions toward an author add up to, squashed to 0 to 1. */
export function authorAffinity(
  interactions: readonly Interaction[],
  authorId: string,
  now: number,
  weights: RankingWeights["interaction"] = DEFAULT_WEIGHTS.interaction,
): number {
  let x = 0;
  for (const i of interactions) {
    if (i.authorId !== authorId) continue;
    const ageDays = (now - i.at) / DAY_MS;
    if (ageDays > INTERACTION_WINDOW_DAYS) continue;
    x += weights[i.kind] * decay(ageDays, 21);
  }
  return squash(x);
}

/** How much the viewer has done in a Corner (key `space/slug`), squashed to 0 to 1. */
export function cornerAffinity(
  events: readonly CornerEvent[],
  hobbyFollowKeys: ReadonlySet<string>,
  key: string,
  now: number,
): number {
  let x = 0;
  for (const e of events) {
    if (e.cornerKey !== key) continue;
    const ageDays = (now - e.at) / DAY_MS;
    x += e.kind === "own" ? 3 * decay(ageDays, 30) : decay(ageDays, 21);
  }
  const [space, corner] = key.split("/");
  if (hobbyFollowKeys.has(key) || hobbyFollowKeys.has(corner) || hobbyFollowKeys.has(space)) x += 2;
  return squash(x);
}

/** The strongest Corner affinity in a category, times 0.6. */
export function categoryAffinity(categorySlug: string, affinityOf: (key: string) => number): number {
  let best = 0;
  for (const c of cornersInCategory(categorySlug)) best = Math.max(best, affinityOf(cornerKey(c.spaceSlug, c.cornerSlug)));
  return clamp01(best * 0.6);
}

/** 1 when someone the viewer follows logged a Moment in the Corner in the last 7 days, else 0. */
export function friendDidIt(
  posts: readonly RankPost[],
  following: ReadonlyMap<string, unknown>,
  key: string,
  now: number,
): { value: 0 | 1; userId?: string } {
  let newest: RankPost | undefined;
  for (const p of posts) {
    if (!p.userId || !following.has(p.userId) || p.corner === undefined) continue;
    if (cornerKey(p.hobbySlug, p.corner) !== key) continue;
    if (now - p.createdAt > 7 * DAY_MS || p.createdAt > now) continue;
    if (!newest || p.createdAt > newest.createdAt) newest = p;
  }
  return newest ? { value: 1, userId: newest.userId } : { value: 0 };
}

/** 1 when the viewer has never logged a Moment in the Corner. */
export function novelty(ownMoments: Signals["ownMoments"], key: string): 0 | 1 {
  return ownMoments.some((m) => m.cornerKey === key) ? 0 : 1;
}

/** 1 for a brand-new Moment, falling by half every 1.5 days. */
export function freshness(createdAt: number, now: number): number {
  return decay(Math.max(0, now - createdAt) / DAY_MS, 1.5);
}

/**
 * Smoothed 0 to 1 from the Moment's own reaction counts. Never an author's
 * follower count. (docs/moment-card-and-reactions-spec.md §4.6 says counts
 * never rank anything; the Door list brief of Oct 23, 2026 asks for this and
 * is the later decision. Set the weights that use it to 0 to turn it off.)
 */
export function momentQuality(post: Pick<RankPost, "loveCount" | "inCount" | "thoughtCount">): number {
  const q = Math.max(0, post.loveCount) + 3 * Math.max(0, post.thoughtCount) + 4 * Math.max(0, post.inCount);
  return Math.log1p(q) / Math.log1p(q + 20);
}

export const hasPhoto = (post: Pick<RankPost, "hasMedia">): 0 | 1 => (post.hasMedia ? 1 : 0);

export type TimeFitKind = "weeknight" | "weekend";

/** How well the guide fits the viewer's local time, and which phrase says why ("weeknight" or "weekend"). */
export function timeFit(
  guide: Pick<CornerGuide, "quick" | "together" | "where">,
  now: Date,
): { value: number; fits?: TimeFitKind } {
  const day = now.getDay();
  const hour = now.getHours();
  if (guide.quick && day >= 1 && day <= 4 && hour < 17) return { value: 1, fits: "weeknight" };
  if (guide.together === "together" && (day === 5 || day === 6) && hour >= 17) return { value: 1, fits: "weekend" };
  if (guide.where === "outdoors" && (day === 6 || day === 0) && hour >= 7 && hour < 18) return { value: 1, fits: "weekend" };
  return { value: 0.5 };
}

/** The library's own 15-minute ordering for quick guides, else 0.3. */
export function libraryPrior(guide: Pick<CornerGuide, "quick" | "order">): number {
  if (guide.quick) return clamp01(1 - (guide.order ?? 50) / 100);
  return 0.3;
}

export { categoryOfCorner };
