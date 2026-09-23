import { Post } from "../data/posts";
import type { PrivateLog } from "./privateLogsRemote";
import { Project, pursuitStatus } from "./journal";

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

/**
 * "Started today" / "Started yesterday" / "Started Sep 14" / "Started Sep
 * 14, 2025" — the ONE way a Pursuit's start date is worded, used by its own
 * page, the My Space rail and the All your Pursuits list alike. They used to
 * disagree ("Started today" on the page, "STARTED IN SEPTEMBER" in the
 * list), which read as two different Pursuits.
 */
export function startedLabel(startedAt: number, now = Date.now()): string {
  const d = new Date(startedAt);
  const today = new Date(now);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(today) - startOfDay(d)) / DAY_MS);
  if (dayDiff <= 0) return "Started today";
  if (dayDiff === 1) return "Started yesterday";
  const sameYear = d.getFullYear() === today.getFullYear();
  const date = d.toLocaleDateString(undefined, sameYear
    ? { month: "short", day: "numeric" }
    : { month: "short", day: "numeric", year: "numeric" });
  return `Started ${date}`;
}

/** Kept for any caller still expecting the uppercase kicker form — now just
 * startedLabel, uppercased, so the two can never disagree again. */
export function startedText(startedAt: number): string {
  return startedLabel(startedAt).toUpperCase();
}

/**
 * One Moment on a Pursuit, whichever table it lives in: a shared post
 * (`posts`) or an "Only you" entry (`private_logs`). The owner's own
 * timeline and first-vs-latest view read both; anyone else only ever gets
 * posts (private logs are never fetched for them).
 */
export interface PursuitMoment {
  key: string;
  createdAt: number;
  /** A real image to show, if there is one. */
  image?: string;
  text: string;
  private: boolean;
  post?: Post;
  log?: PrivateLog;
}

export function collectPursuitMoments(
  pursuitId: string,
  posts: Post[],
  entryProject: Record<string, string>,
  logs: PrivateLog[] = [],
): PursuitMoment[] {
  const fromPosts: PursuitMoment[] = posts
    .filter((p) => p.pursuitId === pursuitId || entryProject[String(p.id)] === pursuitId)
    .map((p) => ({
      key: `post-${p.id}`,
      createdAt: p.createdAt,
      image: p.type === "photo" ? (p.mediaUrls?.[0] ?? p.media) : undefined,
      text: p.caption ?? "",
      private: false,
      post: p,
    }));
  const fromLogs: PursuitMoment[] = logs
    .filter((l) => l.projectId === pursuitId)
    .map((l) => ({
      key: `log-${l.id}`,
      createdAt: l.createdAt,
      // blob: URLs die with the tab that made them — never show one as if
      // it were a kept photo (see docs/private-media-plan.md).
      image: l.media && l.mediaType !== "video" && !l.media.startsWith("blob:") ? l.media : undefined,
      text: l.note,
      private: true,
      log: l,
    }));
  return [...fromPosts, ...fromLogs].sort((a, b) => a.createdAt - b.createdAt);
}

/** Groups Moments (oldest→newest in) by calendar month, newest month first,
 * newest Moment first within each — the pursuit page's timeline. */
export function groupByMonth(moments: PursuitMoment[]): { key: string; label: string; moments: PursuitMoment[] }[] {
  const groups = new Map<string, PursuitMoment[]>();
  for (const m of moments) {
    const d = new Date(m.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  const thisYear = new Date().getFullYear();
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, list]) => {
      const d = new Date(list[0].createdAt);
      const label = d.toLocaleDateString(undefined, d.getFullYear() === thisYear ? { month: "long" } : { month: "long", year: "numeric" });
      return { key, label, moments: [...list].sort((a, b) => b.createdAt - a.createdAt) };
    });
}

/** The first and latest Moments that have a photo — the before-and-after.
 * Undefined `latest` means there's only one photo so far. */
export function firstAndLatestPhoto(moments: PursuitMoment[]) {
  const withImage = moments.filter((m) => m.image);
  if (withImage.length === 0) return undefined;
  const first = withImage[0];
  const latest = withImage.length > 1 ? withImage[withImage.length - 1] : undefined;
  return { first, latest };
}

/** When a Pursuit last moved: its latest Moment, or its start if none yet. */
export function lastActivityAt(p: Project, moments: { createdAt: number }[]): number {
  const last = moments.length ? Math.max(...moments.map((m) => m.createdAt)) : 0;
  return Math.max(last, p.startedAt);
}

/**
 * The Pursuits My Space shows as moving: every ACTIVE one, including a
 * brand-new Pursuit with no Moments yet — it used to be dropped because
 * "still moving" only looked at the last Moment, and a Pursuit with none
 * had no date to look at. Resting and complete ones live in All your
 * Pursuits instead. Most recently touched first.
 */
export function activePursuits(
  projects: Project[],
  momentsFor: (p: Project) => { createdAt: number }[],
): Project[] {
  return projects
    .filter((p) => pursuitStatus(p) === "active")
    .sort((a, b) => lastActivityAt(b, momentsFor(b)) - lastActivityAt(a, momentsFor(a)));
}
