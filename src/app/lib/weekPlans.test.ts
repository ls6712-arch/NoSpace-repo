import { beforeEach, describe, expect, it, vi } from "vitest";
import { nyTimeToMs } from "./homeWeek";

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]> }));

/** A tiny stand-in for the query builder: filters by eq, in, is, gte, lt and awaits to { data, error }. */
vi.mock("../../lib/supabase", () => {
  const builder = (table: string) => {
    let rows = [...(db.tables[table] ?? [])];
    const b: Record<string, unknown> = {
      select: () => b,
      eq: (c: string, v: unknown) => ((rows = rows.filter((r) => r[c] === v)), b),
      is: (c: string, v: unknown) => ((rows = rows.filter((r) => (r[c] ?? null) === v)), b),
      in: (c: string, v: unknown[]) => ((rows = rows.filter((r) => v.includes(r[c]))), b),
      gte: (c: string, v: string) => ((rows = rows.filter((r) => String(r[c]) >= v)), b),
      lt: (c: string, v: string) => ((rows = rows.filter((r) => String(r[c]) < v)), b),
      order: () => b,
      then: (ok: (v: { data: Row[]; error: null }) => unknown) => Promise.resolve({ data: rows, error: null }).then(ok),
    };
    return b;
  };
  return { supabase: { from: builder } };
});

import { fetchWeekDetail } from "./weekPlans";

const ny = (m: number, d: number, h: number) => nyTimeToMs(2026, m, d, h);
const iso = (ms: number) => new Date(ms).toISOString();
const FROM = ny(10, 30, 12);
const TO = ny(11, 6, 0);

beforeEach(() => {
  db.tables = {
    event_rsvps: [
      { event_id: 1, user_id: "me" },
      { event_id: 1, user_id: "friend" },
      { event_id: 1, user_id: "follower" },
      { event_id: 1, user_id: "oneway" },
      { event_id: 1, user_id: "buddy" },
      { event_id: 1, user_id: "stranger1" },
      { event_id: 1, user_id: "stranger2" },
      { event_id: 2, user_id: "me" },
    ],
    space_events: [
      { id: 1, title: "Bouldering night", starts_at: iso(ny(10, 31, 19)), ends_at: null, status: "scheduled", space_id: "s1", neighborhood: "Gowanus", city: "New York", price: "$25" },
      { id: 2, title: "Cancelled thing", starts_at: iso(ny(10, 31, 20)), ends_at: null, status: "cancelled", space_id: "s1", neighborhood: null, city: null, price: null },
    ],
    spaces: [{ id: "s1", name: "Brooklyn Boulders" }],
    space_corners: [{ space_id: "s1", corner_id: 7, is_primary: true }],
    corners: [{ id: 7, space_slug: "sports-martial-arts", slug: "climbing" }],
    profile_follows: [
      // Mutual: both agreed.
      { follower_id: "me", followed_id: "friend", status: "accepted" },
      { follower_id: "friend", followed_id: "me", status: "accepted" },
      { follower_id: "me", followed_id: "buddy", status: "accepted" },
      { follower_id: "buddy", followed_id: "me", status: "accepted" },
      // One way only: never named.
      { follower_id: "me", followed_id: "follower", status: "accepted" },
      { follower_id: "oneway", followed_id: "me", status: "accepted" },
      { follower_id: "me", followed_id: "stranger1", status: "pending" },
      { follower_id: "stranger2", followed_id: "me", status: "declined" },
    ],
    profiles: [
      { id: "friend", display_name: "Priya Shah", avatar_url: null },
      { id: "buddy", display_name: "Sam Lee", avatar_url: null },
      { id: "follower", display_name: "Followed By Me Only", avatar_url: null },
      { id: "oneway", display_name: "Follows Me Only", avatar_url: null },
      { id: "stranger1", display_name: "Nope One", avatar_url: null },
      { id: "stranger2", display_name: "Nope Two", avatar_url: null },
    ],
    pursuit_members: [],
    pursuits: [{ id: "p1", title: "Pottery", user_id: "me", hobby_slug: "crafts-diy", sub_hobby: "pottery", measure: { target: 5 }, finished_at: null, let_go_at: null }],
    pursuit_sessions: [
      { id: 10, pursuit_id: "p1", starts_at: iso(ny(10, 28, 18)), place: "Studio" },
      { id: 11, pursuit_id: "p1", starts_at: iso(ny(10, 31, 11)), place: "Studio" },
      { id: 12, pursuit_id: "p1", starts_at: iso(ny(11, 7, 11)), place: "Studio" },
    ],
    pursuit_session_rsvps: [{ session_id: 11, user_id: "me" }],
  };
});

describe("fetchWeekDetail", () => {
  it("returns the plans in range with place, price and Corner colour, soonest first, leaving out a cancelled event", async () => {
    const plans = await fetchWeekDetail("me", FROM, TO);
    expect(plans.map((p) => p.id)).toEqual(["session-11", "event-1"]);
    const event = plans[1];
    expect(event.place).toBe("Brooklyn Boulders, Gowanus");
    expect(event.price).toBe("$25");
    expect(event.cornerKey).toBe("sports-martial-arts/climbing");
    expect(event.color).toBeTruthy();
  });

  it("names only mutual connections and counts everyone", async () => {
    const [, event] = await fetchWeekDetail("me", FROM, TO);
    expect(event.going.friends.map((f) => f.name).sort()).toEqual(["Priya Shah", "Sam Lee"]);
    expect(event.going.total).toBe(7);
    expect(JSON.stringify(event)).not.toContain("Nope");
  });

  it("never names a one-way follow, in either direction", async () => {
    const [, event] = await fetchWeekDetail("me", FROM, TO);
    const text = JSON.stringify(event);
    expect(text).not.toContain("Followed By Me Only");
    expect(text).not.toContain("Follows Me Only");
    expect(event.going.friends.map((f) => f.id)).not.toContain("follower");
    expect(event.going.friends.map((f) => f.id)).not.toContain("oneway");
  });

  it("numbers a Pursuit's sessions among all of them, not just the ones in range", async () => {
    const [session] = await fetchWeekDetail("me", FROM, TO);
    expect(session.session).toEqual({ n: 2, total: 5 });
    expect(session.mine).toBe(true);
    expect(session.pursuitId).toBe("p1");
    expect(session.going).toEqual({ friends: [], total: 1 });
  });

  it("takes the range as a parameter", async () => {
    const month = await fetchWeekDetail("me", ny(10, 1, 0), ny(11, 1, 0));
    expect(month.map((p) => p.id)).toEqual(["session-10", "session-11", "event-1"]);
    const none = await fetchWeekDetail("me", ny(12, 1, 0), ny(12, 8, 0));
    expect(none).toEqual([]);
  });
});
