import type { Post } from "../../data/posts";
import { postCorner } from "../../data/posts";
import { displayLocation } from "../../data/participation";
import { cornerName } from "../../lib/discoverCorners";
import { cornerPath } from "../../lib/cornerPath";
import { formatDateTime, formatWhen } from "../../lib/dates";

/**
 * The words in a Moment's one meta line: `{Corner} · {place} · {when}`.
 * Pure, so every surface (feed, wall, detail, grid tile) reads the same line.
 * Never a group name: a Moment with no Corner has no first part.
 */

export interface MomentCornerLink {
  name: string;
  to: string;
}

/** The Moment's Corner, by its own name, and the Corner page it links to. */
export function momentCorner(post: Pick<Post, "hobbySlug" | "corner" | "subHobby">): MomentCornerLink | null {
  const slug = postCorner(post)?.trim();
  if (!slug) return null;
  return { name: cornerName(slug), to: cornerPath(post.hobbySlug, slug) };
}

/** Where it was made: the place the maker chose to show, else their city. */
export function momentPlace(post: Pick<Post, "locationName" | "locationPrivacy" | "city">): string | undefined {
  return displayLocation(post.locationName, post.locationPrivacy) || post.city?.trim() || undefined;
}

/** A session that has not happened yet. */
export function isUpcomingSession(post: Pick<Post, "startsAt">, now = Date.now()): boolean {
  return post.startsAt != null && post.startsAt > now;
}

/**
 * When: the short form from dates.ts, the same everywhere ("3h", "Sep 18").
 * A session that has not happened yet shows its own day and time.
 */
export function momentWhen(post: Pick<Post, "createdAt" | "startsAt">, now = Date.now()): string {
  if (isUpcomingSession(post, now)) return formatDateTime(post.startsAt!, { now });
  return formatWhen(post.createdAt, { now });
}

/** Whose Moment it is: yours when you posted it, and always for a private-log stand-in. */
export function isOwnMoment(post: Pick<Post, "userId" | "isPrivateLog">, viewerId: string | undefined | null): boolean {
  return !!post.isPrivateLog || (!!viewerId && post.userId === viewerId);
}

/** The link to one Moment (the app uses hash routes). */
export function momentLink(postId: number | string): string {
  const base = typeof window === "undefined" ? "" : `${window.location.origin}${window.location.pathname}`;
  return `${base}#/moment/${postId}`;
}
