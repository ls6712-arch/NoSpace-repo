import { Post } from "../data/posts";

/**
 * "Still moving" and the trail dots both key off this one number — kept
 * here so it's never duplicated (docs/my-space-spec.md section 4.2).
 */
export const STILL_MOVING_DAYS = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A Pursuit is still moving if it had a Moment within STILL_MOVING_DAYS. */
export function isStillMoving(lastMomentAt: number | undefined): boolean {
  if (lastMomentAt == null) return false;
  return Date.now() - lastMomentAt <= STILL_MOVING_DAYS * DAY_MS;
}

export interface TrailMoment {
  id: number | string;
  createdAt: number;
  visibility: Post["visibility"];
  caption: string;
}

/**
 * A Pursuit's Moments, oldest to newest — the shape PursuitTrack draws its
 * trail from. Reads only data already loaded client-side (ContentContext's
 * `posts`/`myPosts` plus journal's `entryProject` map): My Space is always
 * the owner's own view, and Pursuits are local-first (lib/journal.ts), so
 * there's no separate Supabase round-trip here — filtering already-fetched
 * posts is the same "no N+1" property a single query would give, without
 * adding a network request this app's existing pattern doesn't make either.
 *
 * Matches by pursuitId (mirrored to the database, sql/pursuit-updates.sql)
 * OR entryProject (older, local-only attachments) — same dual check
 * projectProgress() in lib/journal.ts already uses, for the same reason.
 */
export function pursuitMoments(
  posts: Post[],
  pursuitId: string,
  entryProject: Record<string, string>,
): TrailMoment[] {
  return posts
    .filter((p) => p.pursuitId === pursuitId || entryProject[String(p.id)] === pursuitId)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((p) => ({ id: p.id, createdAt: p.createdAt, visibility: p.visibility, caption: p.caption ?? "" }));
}

/** "Last Moment 3 days ago" — neutral wording only, no matter how long. */
export function lastMomentText(lastMomentAt: number | undefined): string {
  if (lastMomentAt == null) return "No Moments yet.";
  const days = Math.floor((Date.now() - lastMomentAt) / DAY_MS);
  if (days <= 0) return "Last Moment today.";
  if (days === 1) return "Last Moment yesterday.";
  return `Last Moment ${days} days ago.`;
}

/** "STARTED IN {MONTH}" (+ year if it's not the current one). */
export function startedText(startedAt: number): string {
  const d = new Date(startedAt);
  const now = new Date();
  const month = d.toLocaleDateString(undefined, { month: "long" }).toUpperCase();
  if (d.getFullYear() === now.getFullYear()) return `STARTED IN ${month}`;
  return `STARTED IN ${month} ${d.getFullYear()}`;
}
