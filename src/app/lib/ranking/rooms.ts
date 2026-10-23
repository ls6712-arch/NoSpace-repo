import { CORNER_CATEGORIES, categoryOfCorner } from "../../data/cornerCategories";
import { DAY_MS } from "./math";
import { buildViewerModel } from "./model";
import { cornerKey, type RankPost, type Signals } from "./types";
import { DEFAULT_WEIGHTS, type RankingWeights } from "./weights";

/** Rows shown before "See all rooms". */
export const ROOMS_SHOWN = 6;

export interface RankedRoom {
  slug: string;
  name: string;
  value: number;
  /** Followed people who logged here in the last 7 days, at most 2, newest first. */
  here: { userId: string; name: string }[];
  /** "{A} is here", "{A} and {B} are here", "New this week" or "Quiet right now". Never a number, never a stranger. */
  presence: string;
  /** True for "Quiet right now": drawn in muted text. */
  quiet: boolean;
}

export function presenceLine(names: readonly string[], newThisWeek: boolean): string {
  if (names.length === 1) return `${names[0]} is here`;
  if (names.length >= 2) return `${names[0]} and ${names[1]} are here`;
  return newThisWeek ? "New this week" : "Quiet right now";
}

const firstName = (name: string) => (name.trim().split(/\s+/)[0] ?? "").slice(0, 60);

/**
 * The 18 rooms, best first: where people you follow have been, how close the
 * room is to what you do, whether anyone public logged there this week, and
 * whether a Corner there got its first Moment this week. Only Moments the
 * viewer is allowed to see are passed in, and a name is only ever one of the
 * viewer's followed people.
 */
export function rankRooms(posts: readonly RankPost[], s: Signals, w: RankingWeights = DEFAULT_WEIGHTS): RankedRoom[] {
  const model = buildViewerModel(s, w);
  const weekAgo = s.now - 7 * DAY_MS;
  const visible = posts.filter(
    (p) =>
      p.userId !== s.viewerId &&
      !(p.userId && s.blockedIds.has(p.userId)) &&
      !s.reportedMomentIds.has(p.id) &&
      (p.visibility === "public" || (p.visibility === "followers" && !!p.userId && s.following.has(p.userId))),
  );

  // Per Corner: the earliest Moment seen, to tell which Corners started this week.
  const earliest = new Map<string, number>();
  for (const p of visible) {
    if (p.corner === undefined) continue;
    const k = cornerKey(p.hobbySlug, p.corner);
    earliest.set(k, Math.min(earliest.get(k) ?? Infinity, p.createdAt));
  }

  return CORNER_CATEGORIES.map((c, order) => {
    const inCat = visible.filter((p) => p.corner !== undefined && categoryOfCorner(p.hobbySlug, p.corner)?.slug === c.slug);
    const thisWeek = inCat.filter((p) => p.createdAt >= weekAgo && p.createdAt <= s.now);
    const followedHere = new Map<string, number>();
    for (const p of thisWeek) {
      if (p.userId && s.following.has(p.userId)) followedHere.set(p.userId, Math.max(followedHere.get(p.userId) ?? 0, p.createdAt));
    }
    const here = [...followedHere.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([userId]) => ({ userId, name: firstName(s.following.get(userId)?.name ?? "") || "Someone" }));
    const newCorner = thisWeek.some((p) => p.corner !== undefined && (earliest.get(cornerKey(p.hobbySlug, p.corner)) ?? 0) >= weekAgo);
    const value =
      w.rooms.followedLogged * (followedHere.size > 0 ? 1 : 0) +
      w.rooms.categoryAffinity * model.category(c.slug) +
      w.rooms.anyPublic * (thisWeek.length > 0 ? 1 : 0) +
      w.rooms.newCorner * (newCorner ? 1 : 0);
    const presence = presenceLine(here.map((h) => h.name), newCorner);
    return { slug: c.slug, name: c.name, value, here, presence, quiet: here.length === 0 && !newCorner, order };
  })
    .sort((a, b) => b.value - a.value || a.order - b.order)
    .map(({ order: _order, ...room }) => room);
}
