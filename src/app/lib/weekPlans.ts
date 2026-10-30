import { supabase } from "../../lib/supabase";
import { cornerColor, type CatColor } from "./categoryStyle";
import type { WeekPlan } from "./homeWeek";
import type { WeekGoing, WeekPlanDetail } from "./weekView";

const DAY = 86_400_000;
/** At most this many connections are looked up to be named on a plan. */
const NAMED_MAX = 3;

type Row = Record<string, any>;

const rows = (res: { data: unknown; error: unknown }, what: string): Row[] => {
  if (res.error) throw new Error(`week: ${what}`);
  return (res.data ?? []) as Row[];
};

/**
 * What the person has already said yes to between `from` and `to`: events
 * they are going to, and the sessions of a Pursuit they own or have joined,
 * with what a ticket shows (place, price, Corner colour, "session 4 of 5") and
 * who is going. Their own rows, and of the people going only those the viewer
 * is connected to are named. Throws when the person's own plans cannot be read,
 * so the screen can offer a retry; the extras (prices, places, names) are best
 * effort and just come back empty.
 */
export async function fetchWeekDetail(userId: string, from: number, to: number): Promise<WeekPlanDetail[]> {
  if (!supabase) return [];
  const client = supabase;
  const iso = (ms: number) => new Date(ms).toISOString();
  const plans: WeekPlanDetail[] = [];

  // Events: the viewer's RSVPs.
  const rsvps = rows(await client.from("event_rsvps").select("event_id").eq("user_id", userId), "rsvps");
  const eventIds = rsvps.map((r) => r.event_id as number);
  if (eventIds.length > 0) {
    const events = rows(
      await client.from("space_events").select("id, title, starts_at, ends_at, status, space_id, neighborhood, city").in("id", eventIds).gte("starts_at", iso(from)).lt("starts_at", iso(to)),
      "events",
    ).filter((e) => e.status !== "cancelled");
    const ids = events.map((e) => e.id as number);
    const spaceIds = [...new Set(events.map((e) => e.space_id as string))];
    const [prices, spaceNames, corners, going] = await Promise.all([
      eventPrices(ids),
      spaceNameById(spaceIds),
      primaryCornerBySpace(spaceIds),
      eventGoing(userId, ids),
    ]);
    for (const e of events) {
      const corner = corners.get(e.space_id as string);
      const place = [spaceNames.get(e.space_id as string), (e.neighborhood as string | null) ?? undefined].filter(Boolean).join(", ");
      plans.push({
        id: `event-${e.id}`,
        kind: "event",
        title: e.title as string,
        startsAt: Date.parse(e.starts_at as string),
        endsAt: e.ends_at ? Date.parse(e.ends_at as string) : null,
        place: place || undefined,
        price: prices.get(e.id as number) ?? null,
        cornerKey: corner?.key,
        color: corner?.color ?? "orange",
        going: going.get(e.id as number) ?? alone(),
      });
    }
  }

  // Pursuits: the ones they own or have joined, and their sessions in range.
  const [joined, owned] = await Promise.all([
    client.from("pursuit_members").select("pursuit_id").eq("user_id", userId).eq("status", "joined"),
    client.from("pursuits").select("id").eq("user_id", userId).is("finished_at", null).is("let_go_at", null),
  ]);
  const pursuitIds = [
    ...new Set([...rows(joined, "joined").map((r) => r.pursuit_id as string), ...rows(owned, "owned").map((r) => r.id as string)]),
  ];
  if (pursuitIds.length > 0) {
    const [sessions, allSessions, pursuits] = await Promise.all([
      client.from("pursuit_sessions").select("id, pursuit_id, starts_at, place").in("pursuit_id", pursuitIds).gte("starts_at", iso(from)).lt("starts_at", iso(to)),
      client.from("pursuit_sessions").select("id, pursuit_id, starts_at").in("pursuit_id", pursuitIds).order("starts_at", { ascending: true }),
      client.from("pursuits").select("id, title, user_id, hobby_slug, sub_hobby, measure").in("id", pursuitIds),
    ]);
    const inRange = rows(sessions, "sessions");
    const byPursuit = new Map<string, number[]>();
    for (const s of rows(allSessions, "all sessions")) byPursuit.set(s.pursuit_id, [...(byPursuit.get(s.pursuit_id) ?? []), s.id as number]);
    const info = new Map(rows(pursuits, "pursuits").map((p) => [p.id as string, p]));
    const going = await sessionGoing(userId, inRange.map((s) => s.id as number));
    for (const s of inRange) {
      const p = info.get(s.pursuit_id as string);
      if (!p) continue;
      const all = byPursuit.get(s.pursuit_id as string) ?? [];
      const target = Number(p.measure?.target);
      const total = Math.max(all.length, Number.isFinite(target) && target > 0 ? target : 0);
      const n = all.indexOf(s.id as number) + 1;
      const space = (p.hobby_slug as string | null) ?? undefined;
      const slug = (p.sub_hobby as string | null) ?? undefined;
      plans.push({
        id: `session-${s.id}`,
        kind: "session",
        title: p.title as string,
        startsAt: Date.parse(s.starts_at as string),
        place: (s.place as string | null) ?? undefined,
        cornerKey: space && slug ? `${space}/${slug}` : undefined,
        color: space && slug ? cornerColor(space, slug) : "orange",
        session: n > 0 ? { n, total } : undefined,
        pursuitId: s.pursuit_id as string,
        mine: p.user_id === userId,
        going: going.get(s.id as number) ?? alone(),
      });
    }
  }

  return plans.filter((p) => Number.isFinite(p.startsAt)).sort((a, b) => a.startsAt - b.startsAt);
}

/**
 * What Home's "Your week" card reads: the title and start of each plan in the
 * next 7 days. Best effort: a failure is an empty list, and the card then
 * just shows the person's free time.
 */
export async function fetchWeekPlans(userId: string, now = Date.now()): Promise<WeekPlan[]> {
  try {
    return (await fetchWeekDetail(userId, now, now + 7 * DAY)).filter((p) => p.startsAt > now).map((p) => ({ title: p.title, startsAt: p.startsAt }));
  } catch {
    return [];
  }
}

// ── the extras, each best effort ──────────────────────────────────────────

const alone = (): WeekGoing => ({ friends: [], total: 1 });

/** Listed prices, by event id. The column only exists after migration 20261106000000; before it this is empty. */
export async function eventPrices(ids: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (!supabase || ids.length === 0) return out;
  try {
    const { data, error } = await supabase.from("space_events").select("id, price").in("id", ids);
    if (error || !Array.isArray(data)) return out;
    for (const r of data as { id: number; price: string | null }[]) if (r.price) out.set(r.id, r.price);
  } catch {
    // No prices known: the budget line then counts every listing as unpriced.
  }
  return out;
}

async function spaceNameById(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!supabase || ids.length === 0) return out;
  try {
    const { data } = await supabase.from("spaces").select("id, name").in("id", ids);
    for (const r of (data ?? []) as { id: string; name: string }[]) out.set(r.id, r.name);
  } catch {
    // The ticket then has no place name.
  }
  return out;
}

/** A Space's main Corner, as a key and its colour. Without one the ticket takes the default colour. */
async function primaryCornerBySpace(ids: string[]): Promise<Map<string, { key: string; color: CatColor }>> {
  const out = new Map<string, { key: string; color: CatColor }>();
  if (!supabase || ids.length === 0) return out;
  try {
    const { data: links } = await supabase.from("space_corners").select("space_id, corner_id").in("space_id", ids).eq("is_primary", true);
    const cornerIds = [...new Set(((links ?? []) as { corner_id: number }[]).map((l) => l.corner_id))];
    if (cornerIds.length === 0) return out;
    const { data: corners } = await supabase.from("corners").select("id, space_slug, slug").in("id", cornerIds);
    const byId = new Map(((corners ?? []) as { id: number; space_slug: string; slug: string }[]).map((c) => [c.id, c]));
    for (const l of (links ?? []) as { space_id: string; corner_id: number }[]) {
      const c = byId.get(l.corner_id);
      if (c) out.set(l.space_id, { key: `${c.space_slug}/${c.slug}`, color: cornerColor(c.space_slug, c.slug) });
    }
  } catch {
    // Colours fall back to the default.
  }
  return out;
}

/**
 * Ids the viewer is connected to, among `ids`: an accepted follow in both
 * directions ("both of you agreed", the same rule as the Log screen's
 * Connections). A one-way follow, in either direction, is never enough.
 */
async function connectedAmong(userId: string, ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!supabase || ids.length === 0) return out;
  try {
    const [mine, theirs] = await Promise.all([
      supabase.from("profile_follows").select("followed_id").eq("follower_id", userId).eq("status", "accepted").in("followed_id", ids),
      supabase.from("profile_follows").select("follower_id").eq("followed_id", userId).eq("status", "accepted").in("follower_id", ids),
    ]);
    const iFollow = new Set(((mine.data ?? []) as { followed_id: string }[]).map((r) => r.followed_id));
    for (const r of (theirs.data ?? []) as { follower_id: string }[]) if (iFollow.has(r.follower_id)) out.add(r.follower_id);
  } catch {
    // Nobody is named.
  }
  return out;
}

/** Who is going to each thing: the viewer's connections among them (named, at most 3) and the total the viewer can see. */
async function goingFor(userId: string, pairs: { key: number; userId: string }[]): Promise<Map<number, WeekGoing>> {
  const out = new Map<number, WeekGoing>();
  if (!supabase || pairs.length === 0) return out;
  const others = [...new Set(pairs.map((p) => p.userId).filter((id) => id !== userId))];
  const connected = await connectedAmong(userId, others);
  const named = [...connected];
  const profiles = new Map<string, { name: string; avatarUrl?: string }>();
  if (named.length > 0) {
    try {
      const { data } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", named);
      for (const p of (data ?? []) as { id: string; display_name: string | null; avatar_url: string | null }[]) {
        profiles.set(p.id, { name: p.display_name?.trim() || "Someone", avatarUrl: p.avatar_url ?? undefined });
      }
    } catch {
      // Without names nobody is shown.
    }
  }
  const keys = [...new Set(pairs.map((p) => p.key))];
  for (const key of keys) {
    const people = new Set(pairs.filter((p) => p.key === key).map((p) => p.userId));
    people.add(userId);
    const friends = [...people]
      .filter((id) => id !== userId && connected.has(id) && profiles.has(id))
      .slice(0, NAMED_MAX)
      .map((id) => ({ id, ...profiles.get(id)! }));
    out.set(key, { friends, total: people.size });
  }
  return out;
}

async function eventGoing(userId: string, eventIds: number[]): Promise<Map<number, WeekGoing>> {
  if (!supabase || eventIds.length === 0) return new Map();
  try {
    const { data } = await supabase.from("event_rsvps").select("event_id, user_id").in("event_id", eventIds);
    return goingFor(userId, ((data ?? []) as { event_id: number; user_id: string }[]).map((r) => ({ key: r.event_id, userId: r.user_id })));
  } catch {
    return new Map();
  }
}

async function sessionGoing(userId: string, sessionIds: number[]): Promise<Map<number, WeekGoing>> {
  if (!supabase || sessionIds.length === 0) return new Map();
  try {
    const { data } = await supabase.from("pursuit_session_rsvps").select("session_id, user_id").in("session_id", sessionIds);
    return goingFor(userId, ((data ?? []) as { session_id: number; user_id: string }[]).map((r) => ({ key: r.session_id, userId: r.user_id })));
  } catch {
    return new Map();
  }
}
