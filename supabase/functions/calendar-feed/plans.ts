import type { FeedPlan } from "./feed.ts";

/** The slice of the database client this needs, so a test can stand in for it. */
export interface Db {
  from: (table: string) => any;
}

type Row = Record<string, any>;

const rows = (res: { data: unknown; error: unknown }, what: string): Row[] => {
  if (res.error) throw new Error(`calendar feed: ${what}`);
  return (res.data ?? []) as Row[];
};

/** The New York date of a moment, "2026-11-03", for the link back. */
export function nyDate(ms: number): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * What the person has said yes to between `fromMs` and `toMs`, as the Week view
 * reads it: events they are going to, and the sessions of Pursuits they own or
 * have joined (a one-off plan is one of these). Only titles, places and times
 * are read: no member lists, no prices, no notes. Each links to that day on the
 * person's calendar. Throws when a read fails, so a calendar keeps what it has.
 */
export async function loadPlans(db: Db, userId: string, fromMs: number, toMs: number, siteUrl?: string): Promise<FeedPlan[]> {
  const iso = (ms: number) => new Date(ms).toISOString();
  const link = (ms: number) => (siteUrl ? `${siteUrl.replace(/\/$/, "")}/#/calendar?view=day&date=${nyDate(ms)}` : null);
  const plans: FeedPlan[] = [];

  const going = rows(await db.from("event_rsvps").select("event_id").eq("user_id", userId), "rsvps").map((r) => r.event_id as number);
  if (going.length > 0) {
    const events = rows(
      await db.from("space_events").select("id, title, starts_at, ends_at, status, space_id, neighborhood").in("id", going).gte("starts_at", iso(fromMs)).lt("starts_at", iso(toMs)),
      "events",
    ).filter((e) => e.status !== "cancelled");
    const spaceIds = [...new Set(events.map((e) => e.space_id as string))];
    const spaces = spaceIds.length > 0 ? rows(await db.from("spaces").select("id, name").in("id", spaceIds), "spaces") : [];
    const nameOf = new Map(spaces.map((s) => [s.id as string, s.name as string]));
    for (const e of events) {
      const startsAt = Date.parse(e.starts_at as string);
      plans.push({
        id: `event-${e.id}`,
        title: e.title as string,
        startsAt,
        endsAt: e.ends_at ? Date.parse(e.ends_at as string) : null,
        place: [nameOf.get(e.space_id as string), e.neighborhood as string | null].filter(Boolean).join(", ") || null,
        url: link(startsAt),
      });
    }
  }

  const [joined, owned] = await Promise.all([
    db.from("pursuit_members").select("pursuit_id").eq("user_id", userId).eq("status", "joined"),
    db.from("pursuits").select("id").eq("user_id", userId).is("finished_at", null).is("let_go_at", null),
  ]);
  const pursuitIds = [...new Set([...rows(joined, "joined").map((r) => r.pursuit_id as string), ...rows(owned, "owned").map((r) => r.id as string)])];
  if (pursuitIds.length > 0) {
    const [sessions, pursuits] = await Promise.all([
      db.from("pursuit_sessions").select("id, pursuit_id, starts_at, place").in("pursuit_id", pursuitIds).gte("starts_at", iso(fromMs)).lt("starts_at", iso(toMs)),
      db.from("pursuits").select("id, title").in("id", pursuitIds),
    ]);
    const titleOf = new Map(rows(pursuits, "pursuits").map((p) => [p.id as string, p.title as string]));
    for (const s of rows(sessions, "sessions")) {
      const title = titleOf.get(s.pursuit_id as string);
      if (!title) continue;
      const startsAt = Date.parse(s.starts_at as string);
      plans.push({ id: `session-${s.id}`, title, startsAt, place: (s.place as string | null) ?? null, url: link(startsAt) });
    }
  }
  return plans.filter((p) => Number.isFinite(p.startsAt));
}
