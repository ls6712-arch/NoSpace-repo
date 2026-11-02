import { supabase } from "../../lib/supabase";

/**
 * Punch cards: the progress a Moment moves forward, shown on Log, Posted and the
 * Home card. Every number comes from public.log_progress() (migration
 * 20261107000000_log_punch_cards.sql), which reads with exactly the rules the Stub
 * triggers use, so the card never says 10 when the database counts 9:
 *
 *   Regular   logging in one Corner on 10 different New York days in a month.
 *             Only a photo or video Moment counts (private.moment_counts).
 *   Finisher  a Pursuit with a goal finishes on its own once it holds that many
 *             Moments (anyone's, pursuit_auto_finish); with no goal, you finish it
 *             yourself and keep the Stub if you logged on 3 different days.
 *
 * Nothing here awards anything. The database does that in the same transaction
 * as the Moment; this only shows the count before and after.
 */

export const REGULAR_DAYS = 10;
export const FINISH_DAYS = 3;

export interface CornerCard {
  /** "space/corner", lower case, as private.corner_key_of() builds it. */
  key: string;
  /** Distinct New York days this month with a photo or video Moment in this Corner. */
  days: number;
  /** A photo or video Moment in this Corner already counts for today. */
  today: boolean;
  /** This month's Regular for this Corner is already kept. */
  kept: boolean;
}

export interface PursuitCard {
  id: string;
  owner: boolean;
  /** The Moment goal (target_moments), or null for a Pursuit you finish yourself. */
  target: number | null;
  /** Every Moment in the Pursuit, anyone's. */
  moments: number;
  /** Your own distinct New York days in it. */
  days: number;
  today: boolean;
}

export interface LogProgress {
  month: string;
  today: string;
  corners: CornerCard[];
  pursuits: PursuitCard[];
}

/** The key private.corner_key_of() builds, or null without both halves. */
export function cornerKey(spaceSlug: string | null | undefined, corner: string | null | undefined): string | null {
  const s = (spaceSlug ?? "").trim();
  const c = (corner ?? "").trim();
  if (!s || !c) return null;
  return `${s.toLowerCase()}/${c.toLowerCase()}`;
}

/** A card's position: `done` of `total`, and whether this Moment adds a punch. */
export interface Punch {
  done: number;
  total: number;
  /** This Moment punches the next hole. */
  adds: boolean;
  /** What `done` becomes if it does. */
  after: number;
}

/**
 * The Regular card for a Corner, before this Moment. `hasMedia` is whether a photo
 * or video is attached: a text Moment is kept and shown, but never punches a day.
 * Null when there is nothing to show: no Corner, or this month's Regular is kept.
 */
export function regularPunch(progress: LogProgress | null, key: string | null, hasMedia: boolean): Punch | null {
  if (!key) return null;
  const card = progress?.corners.find((c) => c.key === key);
  if (card?.kept) return null;
  const done = Math.min(card?.days ?? 0, REGULAR_DAYS);
  const adds = hasMedia && !card?.today && done < REGULAR_DAYS;
  return { done, total: REGULAR_DAYS, adds, after: adds ? done + 1 : done };
}

/**
 * The Finisher card for a Pursuit, before this Moment. Any Moment counts toward a
 * Pursuit (photo or not), as it does in the database. With a goal it counts Moments;
 * without one it counts your days, and the card fills at 3.
 */
export function pursuitPunch(card: PursuitCard | undefined): Punch | null {
  if (!card) return null;
  if (card.target != null && card.target > 0) {
    const done = Math.min(card.moments, card.target);
    const adds = done < card.target;
    return { done, total: card.target, adds, after: adds ? done + 1 : done };
  }
  const done = Math.min(card.days, FINISH_DAYS);
  const adds = !card.today && done < FINISH_DAYS;
  return { done, total: FINISH_DAYS, adds, after: adds ? done + 1 : done };
}

/** A Pursuit with no goal that has its 3 days: Finish now keeps a Finisher. */
export function readyToFinish(card: PursuitCard | undefined): boolean {
  return !!card && (card.target == null || card.target <= 0) && card.days >= FINISH_DAYS;
}

/** The progress as it stands after one more Moment, for when the refetch has not come back. */
export function afterLog(
  progress: LogProgress,
  moment: { key: string | null; pursuitId?: string; hasMedia: boolean },
): LogProgress {
  const corners = progress.corners.map((c) => ({ ...c }));
  if (moment.key && moment.hasMedia) {
    const c = corners.find((x) => x.key === moment.key);
    if (c) {
      if (!c.today) c.days += 1;
      c.today = true;
    } else {
      corners.push({ key: moment.key, days: 1, today: true, kept: false });
    }
  }
  const pursuits = progress.pursuits.map((p) =>
    p.id === moment.pursuitId ? { ...p, moments: p.moments + 1, days: p.today ? p.days : p.days + 1, today: true } : p,
  );
  return { ...progress, corners, pursuits };
}

function isMissingFunction(error: { code?: string; message?: string } | null): boolean {
  return !!error && (error.code === "PGRST202" || error.code === "42883" || /log_progress/.test(error.message ?? ""));
}

/** Reads the signed-in person's cards. Null when signed out, offline, or before the migration. */
export async function fetchLogProgress(): Promise<LogProgress | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc("log_progress");
    if (error) {
      if (!isMissingFunction(error)) console.warn("log_progress", error.message);
      return null;
    }
    if (!data || typeof data !== "object") return null;
    const d = data as Partial<LogProgress>;
    return {
      month: String(d.month ?? ""),
      today: String(d.today ?? ""),
      corners: Array.isArray(d.corners) ? d.corners : [],
      pursuits: Array.isArray(d.pursuits) ? d.pursuits : [],
    };
  } catch {
    return null;
  }
}
