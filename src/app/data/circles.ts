export interface Circle {
  id: number;
  hobbySlug: string;
  name: string;
  /** Undefined = global circle. Set = a geographic sub-layer within the hobby. */
  location?: string;
  description: string;
  memberCount: number;
  /** Who this Circle is for, in one line — shown before anyone joins. */
  purpose: string;
  /** How busy it actually is, so "3,402 members" isn't the only signal. */
  activity: "Quiet" | "Steady" | "Busy";
  /** The open prompt right now. Circles are for doing, so there is always one. */
  prompt: string;
  /** Plain-language house rules. Three is enough for anyone to actually read them. */
  rules: string[];
  moderators: string[];
  /** Whether non-members can read it, stated up front rather than discovered. */
  visibility: "Open to read" | "Members only";
  /** Set only for a real, Supabase-backed Circle (see CirclesContext.tsx) —
   * a seed Circle above has no account behind it to own. */
  ownerId?: string;
}

/** The board's four ways to take part — same ids CategoryFeed's own tab
 * list and CircleBoard's thread filter both key off of. */
export type CircleTabId = "updates" | "pursuits" | "questions" | "events";

/**
 * The demo Circles that used to ship inside the app (ids 1, 2, 5-10: "NYC
 * Pottery Beginners", "Home Barista Club" and so on) have been removed. They
 * were invented, had no database row and no real members, so they made every
 * Circle list look busier than it was.
 *
 * Everything that reads this list (Discover, My Space, search, the Circles
 * page) copes with it being empty, and only real, database-backed Circles
 * remain (see CirclesContext.tsx, which numbers those from 1,000,000 so they
 * can never collide with a demo id). The old entries are in git history if
 * they're ever wanted back. The exported type and helpers stay because real
 * Circles are shaped by them.
 */
export const circles: Circle[] = [];

export function circlesByHobby(slug: string) {
  return circles.filter((c) => c.hobbySlug === slug);
}

export function getCircle(id: number) {
  return circles.find((c) => c.id === id);
}
