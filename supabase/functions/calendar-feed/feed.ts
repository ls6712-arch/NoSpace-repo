import { vcalendar, type IcsEvent } from "../_shared/ics.ts";

/**
 * The subscribe feed's calendar: the person's plans and Pursuit sessions, and
 * nothing else. Each event is its title, place, time and a link back to Soosh.
 * No blocks, no free time, no budget, no notes and no one else's name ever goes
 * in: this file is handed plain plans and has no way to ask for more.
 */
export const FEED_DAYS = 60;
/** A listing or session with no end blocks out this long, as the app does. */
export const DEFAULT_PLAN_MS = 2 * 3_600_000;
/** What calendars are asked to wait between refreshes. */
export const REFRESH_HOURS = 1;

export interface FeedPlan {
  /** "event-12" or "session-7": stable, so a calendar updates an event instead of duplicating it. */
  id: string;
  title: string;
  startsAt: number;
  endsAt?: number | null;
  place?: string | null;
  /** Where in Soosh to look at it. */
  url?: string | null;
}

export function buildFeed(plans: readonly FeedPlan[], now: number): string {
  const events: IcsEvent[] = plans
    .filter((p) => Number.isFinite(p.startsAt) && p.title.trim() !== "")
    .sort((a, b) => a.startsAt - b.startsAt || a.id.localeCompare(b.id))
    .map((p) => ({
      uid: `${p.id}@soosh`,
      startsAt: p.startsAt,
      endsAt: p.endsAt && p.endsAt > p.startsAt ? p.endsAt : p.startsAt + DEFAULT_PLAN_MS,
      title: p.title.trim().slice(0, 200),
      where: p.place?.trim().slice(0, 200) || undefined,
      note: p.url ? `Open in Soosh: ${p.url}` : undefined,
      url: p.url ?? undefined,
    }));
  return vcalendar(events, { prodid: "-//Soosh//Calendar feed//EN", now, name: "Soosh", refreshHours: REFRESH_HOURS });
}
