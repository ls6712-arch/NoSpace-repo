import type { Post } from "../data/posts";
import { postCorner } from "../data/posts";
import { fetchWall, type WallCard } from "./cornerWalls";
import { fetchCornersLive, thisWeek } from "./cornersLive";
import { fetchEventsThisWeek } from "./homeEmpty";

/**
 * Home v3 (Nov 8, 2026): Home is "your Corners, right now". These helpers pick
 * the Corners Home reads from, and load their Still making cards and this
 * week's events. Each load is best effort: a failure is an empty list, and the
 * section that reads it is simply not shown.
 */

export interface HomeCorner {
  spaceSlug: string;
  slug: string;
  name: string;
}

/** How many Corners Home reads walls and events from. */
export const HOME_CORNER_LIMIT = 4;
/** Still making cards on Home. */
export const HOME_WALL_CARDS = 4;
/** Event tickets on Home. */
export const HOME_EVENTS = 6;

/**
 * The Corners you follow (`<space-slug>:<corner-slug>` keys from cornerFollowKey, or bare
 * Corner slugs from older follows), resolved against the known Corners. A follow of a whole
 * Space (the literal key `space:<space-slug>`) is not a Corner and is left out. With none, the Corners of the newest
 * public Moments on Soosh, so Home is never empty for someone who has not
 * followed anything yet. `fallback` says which one it is.
 */
export function yourCorners(
  followed: readonly string[],
  known: readonly HomeCorner[],
  feed: readonly Pick<Post, "hobbySlug" | "subHobby" | "corner" | "createdAt">[],
  limit = HOME_CORNER_LIMIT,
): { corners: HomeCorner[]; fallback: boolean } {
  const out: HomeCorner[] = [];
  const seen = new Set<string>();
  const add = (c: HomeCorner | undefined) => {
    if (!c || seen.has(c.slug) || out.length >= limit) return;
    seen.add(c.slug);
    out.push(c);
  };
  for (const key of followed) {
    // "space:<slug>" is a follow of a whole Space (BePart), not of a Corner, and an empty key is nothing.
    if (!key || key.startsWith("space:")) continue;
    const [a, b] = key.includes(":") ? key.split(":") : [undefined, key];
    add(known.find((c) => c.slug === b && (!a || c.spaceSlug === a)) ?? (a && b ? { spaceSlug: a, slug: b, name: b } : undefined));
  }
  if (out.length > 0) return { corners: out, fallback: false };
  for (const post of [...feed].sort((x, y) => y.createdAt - x.createdAt)) {
    const slug = postCorner(post);
    if (!slug || !post.hobbySlug) continue;
    add(known.find((c) => c.slug === slug) ?? { spaceSlug: post.hobbySlug, slug, name: slug });
  }
  return { corners: out, fallback: true };
}

export interface HomeWallCard {
  card: WallCard;
  corner: HomeCorner;
}

/** The newest Still making cards across the Corners, newest first, never your own, each Moment once. */
export async function fetchStillMaking(corners: readonly HomeCorner[], limit = HOME_WALL_CARDS): Promise<HomeWallCard[]> {
  const walls = await Promise.all(
    corners.map((corner) =>
      fetchWall(`${corner.spaceSlug}/${corner.slug}`, "making", { limit })
        .then((cards) => cards.map((card) => ({ card, corner })))
        .catch(() => [] as HomeWallCard[]),
    ),
  );
  return mergeWalls(walls.flat(), limit);
}

export function mergeWalls(cards: readonly HomeWallCard[], limit = HOME_WALL_CARDS): HomeWallCard[] {
  const seen = new Set<number>();
  return [...cards]
    .filter((c) => !c.card.mine)
    .sort((a, b) => b.card.postedAt - a.card.postedAt)
    .filter((c) => (seen.has(c.card.postId) ? false : (seen.add(c.card.postId), true)))
    .slice(0, limit);
}

export interface HomeEvent {
  id: number;
  title: string;
  startsAt: number;
  timezone?: string;
  spaceName: string;
  spaceSlug: string;
}

/**
 * Events in the next 7 days in your Corners' Spaces, soonest first. With none
 * there, the open Spaces' events this week (the list Home showed before).
 */
export async function fetchHomeEvents(corners: readonly HomeCorner[], limit = HOME_EVENTS): Promise<HomeEvent[]> {
  const out: HomeEvent[] = [];
  try {
    const live = await fetchCornersLive({ targets: corners.map(({ spaceSlug, slug }) => ({ spaceSlug, slug })) });
    const seen = new Set<number>();
    for (const { spaces, events } of live.values()) {
      const byId = new Map(spaces.map((s) => [s.id, s]));
      for (const e of thisWeek(events)) {
        const space = byId.get(e.spaceId);
        if (!space || seen.has(e.id)) continue;
        seen.add(e.id);
        out.push({ id: e.id, title: e.title, startsAt: new Date(e.startsAt).getTime(), timezone: e.timezone, spaceName: space.name, spaceSlug: space.slug });
      }
    }
  } catch {
    // Best effort, as above.
  }
  if (out.length === 0) {
    const nearby = await fetchEventsThisWeek(limit).catch(() => []);
    return nearby.map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt, spaceName: e.spaceName, spaceSlug: e.spaceSlug }));
  }
  return out.sort((a, b) => a.startsAt - b.startsAt).slice(0, limit);
}
