import { canonicalCorner } from "../data/hobbies";
import { cornerWorld } from "../world/cornerWorlds";
import { clipTitle } from "./cornerWalls";

/**
 * The names of a Corner's two walls. What is stored never changes: a Moment is on the finished wall when its
 * Pursuit is finished (pursuits.finished_at) and on the in-progress wall otherwise. Only the words differ, and
 * only for a Corner that has a room. Every other Corner says "Still making" and "Made it".
 *
 * All of these are in docs/glossary.md under "Corner rooms: wall labels".
 */
export interface WallLabels {
  /** The in-progress wall. */
  making: string;
  /** The finished wall. */
  made: string;
}

export const DEFAULT_WALL_LABELS: WallLabels = { making: "Still making", made: "Made it" };

/** Keyed by `space-slug/corner-slug`. A Corner here uses its labels once it has a room (cornerWorlds.ts). */
const ROOM_WALL_LABELS: Readonly<Record<string, WallLabels>> = {
  "crafts-making/pottery": { making: "Still making", made: "Made it" },
  "home-garden/gardening": { making: "Still growing", made: "Made it" },
  "books-writing/reading": { making: "Still reading", made: "Read it" },
  "gaming-tabletop/board-games": { making: "Still learning", made: "Played it" },
};

/** The Corners with labels of their own, for tests and docs. */
export const ROOM_WALL_LABEL_KEYS = Object.keys(ROOM_WALL_LABELS);

/** The labels a Corner would use as a room, whether or not the room exists yet. */
export function roomWallLabels(key: string): WallLabels | undefined {
  return ROOM_WALL_LABELS[key];
}

/** The wall names this Corner shows. A Corner merged into another uses the kept Corner's. */
export function wallLabels(spaceSlug: string, slug: string): WallLabels {
  if (!cornerWorld(spaceSlug, slug)) return DEFAULT_WALL_LABELS;
  const k = canonicalCorner(spaceSlug, slug);
  return ROOM_WALL_LABELS[`${k.spaceSlug}/${k.slug}`] ?? DEFAULT_WALL_LABELS;
}

/** Whether Log a Moment asks "in progress or finished" for this Corner: only a Corner with a room. */
export function asksWallQuestion(spaceSlug: string, slug: string): boolean {
  return !!spaceSlug && !!slug && !!cornerWorld(spaceSlug, slug);
}

/** The accessible name of the composer's two-way choice. */
export const WALL_QUESTION_LABEL = "How far along";

/**
 * The title of the Pursuit made when someone answers "finished" on a Moment that counts toward no Pursuit:
 * the first line of what they wrote, cut at a word boundary, or the Corner's name when they wrote nothing.
 */
export function finishedPursuitTitle(caption: string, cornerName: string): string {
  const first = caption.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0);
  return first ? clipTitle(first, 60) : cornerName;
}
