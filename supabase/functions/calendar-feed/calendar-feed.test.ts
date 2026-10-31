import { readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { buildFeed, DEFAULT_PLAN_MS, FEED_DAYS, type FeedPlan } from "./feed.ts";
import { handleFeed, sha256Hex, TOKEN_RE, type FeedDeps } from "./handler.ts";
import { loadPlans, nyDate, type Db } from "./plans.ts";

const NOW = Date.UTC(2026, 10, 1, 15, 0, 0);
const TOKEN = "A".repeat(43);
const plan = (over: Partial<FeedPlan> = {}): FeedPlan => ({ id: "event-1", title: "Bouldering night", startsAt: Date.UTC(2026, 10, 3, 0, 0, 0), endsAt: Date.UTC(2026, 10, 3, 2, 0, 0), place: "Brooklyn Boulders, Gowanus", url: "https://soosh.example/#/calendar?view=day&date=2026-11-02", ...over });

describe("buildFeed", () => {
  it("is a calendar of events, each with its title, place, time and a link back", () => {
    const ics = buildFeed([plan()], NOW);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("X-WR-CALNAME:Soosh");
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT1H");
    expect(ics).toContain("UID:event-1@soosh");
    expect(ics).toContain("DTSTART:20261103T000000Z");
    expect(ics).toContain("DTEND:20261103T020000Z");
    expect(ics).toContain("SUMMARY:Bouldering night");
    expect(ics).toContain("LOCATION:Brooklyn Boulders\\, Gowanus");
    expect(ics).toContain("URL:https://soosh.example/#/calendar?view=day&date=2026-11-02");
    expect(ics).not.toContain("VALARM");
  });

  it("blocks out 2 hours for a plan with no end, like the app", () => {
    const ics = buildFeed([plan({ endsAt: null, startsAt: Date.UTC(2026, 10, 3, 0) })], NOW);
    expect(DEFAULT_PLAN_MS).toBe(2 * 3_600_000);
    expect(ics).toContain("DTEND:20261103T020000Z");
  });

  it("keeps an event's UID the same from one fetch to the next, so a calendar updates it", () => {
    const a = buildFeed([plan({ title: "Old" })], NOW);
    const b = buildFeed([plan({ title: "New" })], NOW + 3_600_000);
    expect(a.match(/UID:.*/)?.[0]).toBe(b.match(/UID:.*/)?.[0]);
  });

  it("lists the soonest first, leaves out a plan with no title, and is an empty calendar when there is nothing", () => {
    const ics = buildFeed([plan({ id: "event-2", title: "Later", startsAt: Date.UTC(2026, 10, 5) }), plan({ id: "event-3", title: "  " }), plan({ id: "session-1", title: "Sooner", startsAt: Date.UTC(2026, 10, 2) })], NOW);
    expect(ics.indexOf("Sooner")).toBeLessThan(ics.indexOf("Later"));
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(buildFeed([], NOW)).not.toContain("BEGIN:VEVENT");
  });

  it("escapes and folds, so no line is over 75 characters", () => {
    const ics = buildFeed([plan({ title: `A; B, C ${"x".repeat(150)}\nnext` })], NOW);
    expect(ics).toContain("SUMMARY:A\\; B\\, C");
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
  });
});

const deps = (over: Partial<FeedDeps> = {}): FeedDeps & { hashes: string[]; windows: [number, number][] } => {
  const hashes: string[] = [];
  const windows: [number, number][] = [];
  return {
    hashes,
    windows,
    now: () => NOW,
    userForTokenHash: async (h) => (hashes.push(h), h === createHash("sha256").update(TOKEN).digest("hex") ? "u1" : null),
    plansFor: async (_u, from, to) => (windows.push([from, to]), [plan()]),
    ...over,
  };
};
const get = (token: string | null, method = "GET") => new Request(`https://x.supabase.co/functions/v1/calendar-feed${token === null ? "" : `?token=${token}`}`, { method });

describe("handleFeed", () => {
  it("serves the calendar for a good token, for the next 60 days", async () => {
    const d = deps();
    const res = await handleFeed(get(TOKEN), d);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("private, max-age=300");
    expect(await res.text()).toContain("SUMMARY:Bouldering night");
    expect(d.windows).toEqual([[NOW, NOW + FEED_DAYS * 86_400_000]]);
    expect(FEED_DAYS).toBe(60);
  });

  it("looks the token up by its hash, never by the token itself", async () => {
    const d = deps();
    await handleFeed(get(TOKEN), d);
    expect(d.hashes).toEqual([await sha256Hex(TOKEN)]);
    expect(d.hashes[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(d.hashes[0]).not.toContain(TOKEN);
  });

  it("answers a missing, malformed, unknown or reset token the same plain way", async () => {
    const bodies: string[] = [];
    for (const t of [null, "", "short", `${"A".repeat(42)}!`, "B".repeat(43), `${"A".repeat(43)}A`]) {
      const res = await handleFeed(get(t), deps());
      expect(res.status).toBe(404);
      expect(res.headers.get("content-type")).toContain("text/plain");
      bodies.push(await res.text());
    }
    expect(new Set(bodies)).toEqual(new Set(["Not found"]));
  });

  it("does not read any plans for a token it does not know", async () => {
    const plansFor = vi.fn(async () => []);
    await handleFeed(get("B".repeat(43)), deps({ plansFor }));
    expect(plansFor).not.toHaveBeenCalled();
  });

  it("does not even look a malformed token up", async () => {
    const userForTokenHash = vi.fn(async () => "u1");
    await handleFeed(get("nope"), deps({ userForTokenHash }));
    expect(userForTokenHash).not.toHaveBeenCalled();
  });

  it("allows only GET and HEAD, and HEAD has no body", async () => {
    expect((await handleFeed(get(TOKEN, "POST"), deps())).status).toBe(405);
    expect((await handleFeed(get(TOKEN, "DELETE"), deps())).status).toBe(405);
    const head = await handleFeed(get(TOKEN, "HEAD"), deps());
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
  });

  it("says something went wrong, and nothing more, when the database fails", async () => {
    const res = await handleFeed(get(TOKEN), deps({ plansFor: async () => { throw new Error("password authentication failed for user svc"); } }));
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).toBe("Something went wrong. Try again.");
    expect(body).not.toMatch(/password|svc/);
    expect((await handleFeed(get(TOKEN), deps({ userForTokenHash: async () => { throw new Error("db down"); } }))).status).toBe(500);
  });

  it("only treats 43 URL safe characters as a token", () => {
    expect(TOKEN_RE.test(TOKEN)).toBe(true);
    expect(TOKEN_RE.test("a-b_".repeat(10) + "abc")).toBe(true);
    expect(TOKEN_RE.test("a+b/".repeat(10) + "abc")).toBe(false);
  });
});

type R = Record<string, unknown>;
/** A tiny stand-in for the query builder: eq, in, is, gte and lt, awaited to { data, error }. */
function fakeDb(tables: Record<string, R[]>): Db & { reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    from: (table: string) => {
      reads.push(table);
      let rows = [...(tables[table] ?? [])];
      const b: Record<string, unknown> = {
        select: () => b,
        eq: (c: string, v: unknown) => ((rows = rows.filter((r) => r[c] === v)), b),
        is: (c: string, v: unknown) => ((rows = rows.filter((r) => (r[c] ?? null) === v)), b),
        in: (c: string, v: unknown[]) => ((rows = rows.filter((r) => v.includes(r[c]))), b),
        gte: (c: string, v: string) => ((rows = rows.filter((r) => String(r[c]) >= v)), b),
        lt: (c: string, v: string) => ((rows = rows.filter((r) => String(r[c]) < v)), b),
        then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(ok),
      };
      return b;
    },
  };
}
const iso = (ms: number) => new Date(ms).toISOString();
const day = (n: number) => NOW + n * 86_400_000;

describe("loadPlans", () => {
  const tables = (): Record<string, R[]> => ({
    event_rsvps: [{ event_id: 1, user_id: "me" }, { event_id: 2, user_id: "me" }, { event_id: 3, user_id: "me" }, { event_id: 4, user_id: "me" }, { event_id: 1, user_id: "friend" }],
    space_events: [
      { id: 1, title: "Bouldering night", starts_at: iso(day(2)), ends_at: iso(day(2) + 2 * 3_600_000), status: "scheduled", space_id: "s1", neighborhood: "Gowanus" },
      { id: 2, title: "Cancelled thing", starts_at: iso(day(2)), ends_at: null, status: "cancelled", space_id: "s1", neighborhood: null },
      { id: 3, title: "Too far ahead", starts_at: iso(day(90)), ends_at: null, status: "scheduled", space_id: "s1", neighborhood: null },
      { id: 4, title: "Already over", starts_at: iso(day(-3)), ends_at: null, status: "scheduled", space_id: "s1", neighborhood: null },
    ],
    spaces: [{ id: "s1", name: "Brooklyn Boulders" }],
    pursuit_members: [{ pursuit_id: "p-joined", user_id: "me", status: "joined" }, { pursuit_id: "p-invited", user_id: "me", status: "invited" }],
    pursuits: [
      { id: "p-own", user_id: "me", title: "Pottery", finished_at: null, let_go_at: null },
      { id: "p-done", user_id: "me", title: "Old one", finished_at: iso(day(-1)), let_go_at: null },
      { id: "p-joined", user_id: "other", title: "Pasta from scratch", finished_at: null, let_go_at: null },
      { id: "p-invited", user_id: "other", title: "Not yet", finished_at: null, let_go_at: null },
    ],
    pursuit_sessions: [
      { id: 7, pursuit_id: "p-own", starts_at: iso(day(1)), place: null },
      { id: 8, pursuit_id: "p-joined", starts_at: iso(day(4)), place: "Priya's kitchen" },
      { id: 9, pursuit_id: "p-done", starts_at: iso(day(1)), place: null },
      { id: 10, pursuit_id: "p-invited", starts_at: iso(day(1)), place: null },
      { id: 11, pursuit_id: "p-own", starts_at: iso(day(80)), place: null },
    ],
  });
  const load = (site?: string) => loadPlans(fakeDb(tables()), "me", NOW, day(60), site);

  it("has the events the person is going to, and the sessions of Pursuits they own or joined, and nothing else", async () => {
    const got = await load();
    expect(got.map((p) => p.id).sort()).toEqual(["event-1", "session-7", "session-8"]);
    expect(got.find((p) => p.id === "event-1")).toMatchObject({ title: "Bouldering night", place: "Brooklyn Boulders, Gowanus" });
    expect(got.find((p) => p.id === "session-7")).toMatchObject({ title: "Pottery", place: null });
    expect(got.find((p) => p.id === "session-8")).toMatchObject({ title: "Pasta from scratch", place: "Priya's kitchen" });
  });

  it("leaves out a cancelled event, one past 60 days, one already over, a finished Pursuit and one only invited to", async () => {
    const ids = (await load()).map((p) => p.id);
    for (const gone of ["event-2", "event-3", "event-4", "session-9", "session-10", "session-11"]) expect(ids).not.toContain(gone);
  });

  it("links each to that day on the person's calendar in New York, or leaves the link out with no site", async () => {
    const withSite = await load("https://soosh.example/");
    expect(withSite[0].url).toBe(`https://soosh.example/#/calendar?view=day&date=${nyDate(withSite[0].startsAt)}`);
    expect((await load()).every((p) => p.url === null)).toBe(true);
    expect(nyDate(Date.UTC(2026, 10, 3, 3, 0))).toBe("2026-11-02");
  });

  it("never reads a table that could hold a block, a budget, a name or a note", async () => {
    const db = fakeDb(tables());
    await loadPlans(db, "me", NOW, day(60));
    expect(new Set(db.reads)).toEqual(new Set(["event_rsvps", "space_events", "spaces", "pursuit_members", "pursuits", "pursuit_sessions"]));
  });

  it("throws when a read fails, so a calendar keeps what it already has", async () => {
    const db: Db = { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: null, error: { message: "boom" } }) }) }) };
    await expect(loadPlans(db, "me", NOW, day(60))).rejects.toThrow();
  });
});

describe("what the feed can never contain", () => {
  // The code, not the comments that say what it leaves out.
  const read = (f: string) => readFileSync(path.resolve(__dirname, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  it.each(["feed.ts", "plans.ts"])("%s names no private table or column", (file) => {
    expect(read(file)).not.toMatch(/calendar_entries|profile_private|monthly_budget|budget|free_windows|display_name|username|\bprofiles\b|calendar_busy/i);
  });
});
