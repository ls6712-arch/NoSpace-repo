import { describe, expect, it, vi } from "vitest";
import { checkPicks, cleanText, linkKey, msToNyLocal, nyLocalToMs, readPicksBlock, rowFor, SCOUT_MAX_PICKS, type CheckContext, type RawPick } from "./picks.ts";
import { runSearch, SearchError, systemPrompt, userPrompt } from "./search.ts";
import { handleScout, MESSAGES, readSettings, type ScoutDeps } from "./handler.ts";

// Sunday Nov 1, 2026, 10:00 in New York (the clocks went back at 2:00 this morning).
const NOW = Date.UTC(2026, 10, 1, 15, 0);
const PAGE = "https://www.nycgovparks.org/events/2026/11/07/pottery-in-the-park";
const ctx = (over: Partial<CheckContext> = {}): CheckContext => ({
  now: NOW,
  sourceLinks: new Set([linkKey(PAGE)!]),
  corners: new Map([["pottery", 7]]),
  existing: new Set(),
  ...over,
});
const pick = (over: Partial<RawPick> = {}): RawPick => ({
  title: "Pottery in the park",
  place: "Prospect Park, Brooklyn",
  starts: "2026-11-07T14:00",
  ends: "2026-11-07T16:00",
  price: "free",
  url: PAGE,
  corner: "Pottery",
  unsure: null,
  ...over,
});

describe("New York time", () => {
  it("reads wall clock time on both sides of the clock change", () => {
    expect(nyLocalToMs("2026-11-07T14:00")).toBe(Date.UTC(2026, 10, 7, 19, 0)); // EST, UTC-5
    expect(nyLocalToMs("2026-10-31T14:00")).toBe(Date.UTC(2026, 9, 31, 18, 0)); // EDT, UTC-4
    expect(msToNyLocal(NOW)).toBe("2026-11-01T10:00");
  });
  it("refuses anything that isn't a real local time", () => {
    for (const bad of ["2026-11-31T10:00", "2026-13-01T10:00", "Nov 7 at 2pm", "2026-11-07", "2026-11-07T25:00", 42, null]) {
      expect(Number.isNaN(nyLocalToMs(bad))).toBe(true);
    }
  });
});

describe("links and text", () => {
  it("compares links without the hash, trailing slash or host case", () => {
    expect(linkKey("https://Example.com/a/#top")).toBe(linkKey("https://example.com/a"));
    expect(linkKey("http://example.com/a")).toBeNull();
    expect(linkKey("javascript:alert(1)")).toBeNull();
    expect(linkKey("not a link")).toBeNull();
  });
  it("cleans text to one plain line with no long dashes or brackets", () => {
    expect(cleanText("  Wheel   night — beginners\n<b>only</b> ")).toBe("Wheel night - beginners bonly/b");
    expect(cleanText(12)).toBe("");
  });
});

describe("reading the answer", () => {
  it("finds the list between the picks tags, fenced or not", () => {
    expect(readPicksBlock('Notes first.\n<picks>[{"title":"A"}]</picks>')).toEqual([{ title: "A" }]);
    expect(readPicksBlock('<picks>\n```json\n[{"title":"B"}]\n```\n</picks>')).toEqual([{ title: "B" }]);
  });
  it("gives null when there is no readable list", () => {
    expect(readPicksBlock("no block")).toBeNull();
    expect(readPicksBlock("<picks>{not json}</picks>")).toBeNull();
    expect(readPicksBlock('<picks>{"title":"A"}</picks>')).toBeNull();
  });
});

describe("checking picks", () => {
  it("keeps a good pick with its Corner and no note", () => {
    const { kept, dropped } = checkPicks([pick()], ctx());
    expect(dropped).toEqual([]);
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ title: "Pottery in the park", cornerId: 7, price: "free", note: null, startsAt: Date.UTC(2026, 10, 7, 19, 0) });
  });

  it("drops a pick whose link the search never returned", () => {
    const { kept, dropped } = checkPicks([pick({ url: "https://made-up.example.com/event" })], ctx());
    expect(kept).toEqual([]);
    expect(dropped[0].reason).toMatch(/wasn't one of the pages/);
  });

  it("drops past, too soon, too far and timeless picks", () => {
    const { kept, dropped } = checkPicks(
      [pick({ starts: "2026-10-31T19:00" }), pick({ starts: "2026-11-01T10:30" }), pick({ starts: "2026-11-20T10:00" }), pick({ starts: "this weekend" })],
      ctx(),
    );
    expect(kept).toEqual([]);
    expect(dropped.map((d) => d.reason)).toEqual([
      "Already started, or starts within the hour.",
      "Already started, or starts within the hour.",
      "More than 14 days away.",
      "No clear start time.",
    ]);
  });

  it("drops one already saved and a repeat within the run", () => {
    const existing = new Set(["pottery in the park|" + Date.UTC(2026, 10, 7, 19, 0)]);
    expect(checkPicks([pick()], ctx({ existing })).dropped[0].reason).toBe("Already a City pick.");
    const twice = checkPicks([pick(), pick({ title: "POTTERY in the park" })], ctx());
    expect(twice.kept).toHaveLength(1);
    expect(twice.dropped[0].reason).toBe("Found twice in this run.");
  });

  it("never turns a missing price into free, and notes what to check", () => {
    const { kept } = checkPicks([pick({ price: null, ends: "2026-11-07T13:00", unsure: "Might need to sign up" })], ctx());
    expect(kept[0].price).toBeNull();
    expect(kept[0].endsAt).toBeNull();
    expect(kept[0].note).toBe("End time unclear. Price not listed. Might need to sign up");
  });

  it("ignores a Corner that isn't on the list", () => {
    expect(checkPicks([pick({ corner: "Underwater basket weaving" })], ctx()).kept[0].cornerId).toBeNull();
  });

  it(`keeps at most ${SCOUT_MAX_PICKS}, soonest first`, () => {
    const raw = Array.from({ length: 15 }, (_, i) => pick({ title: `Event ${String(i).padStart(2, "0")}`, starts: `2026-11-${String(14 - (i % 10)).padStart(2, "0")}T18:00` }));
    const { kept, dropped } = checkPicks(raw, ctx());
    expect(kept).toHaveLength(SCOUT_MAX_PICKS);
    expect(kept[0].startsAt).toBeLessThanOrEqual(kept[11].startsAt);
    expect(dropped.filter((d) => d.reason.startsWith("Over the"))).toHaveLength(3);
  });

  it("puts a clean pick live, and records who asked", () => {
    const [p] = checkPicks([pick()], ctx()).kept;
    expect(rowFor(p, 9, "new-york", NOW, "u1")).toMatchObject({
      published: true,
      requested_by: "u1",
      found_by: "scout",
      source_url: PAGE,
      url: PAGE,
      checked_at: new Date(NOW).toISOString(),
      color: "orange",
      corner_id: 7,
    });
  });

  it("keeps a pick with anything to double check as a draft", () => {
    const [p] = checkPicks([pick({ price: null })], ctx()).kept;
    expect(rowFor(p, 0, "new-york", NOW)).toMatchObject({ published: false, requested_by: null, scout_note: "Price not listed" });
  });
});

describe("the search call", () => {
  const reply = (content: unknown[], stop_reason = "end_turn") => new Response(JSON.stringify({ content, stop_reason }), { status: 200 });
  const opts = { apiKey: "test-key", model: "test-model", maxSearches: 5, focus: "pottery", cornerNames: ["Pottery"], now: NOW };

  it("collects the pages it found, counts searches, and keeps the key in a header only", async () => {
    const fetchImpl = vi.fn(async () =>
      reply([
        { type: "server_tool_use", name: "web_search", input: { query: "pottery nyc" } },
        { type: "web_search_tool_result", content: [{ url: PAGE }, { url: "http://insecure.example.com" }] },
        { type: "text", text: "<picks>[]</picks>", citations: [{ url: "https://cited.example.com/x/" }] },
      ]),
    );
    const r = await runSearch({ ...opts, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.searches).toBe(1);
    expect([...r.sourceLinks].sort()).toEqual([linkKey("https://cited.example.com/x")!, linkKey(PAGE)!].sort());
    expect(r.text).toBe("<picks>[]</picks>");
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("test-key");
    expect(String(init.body)).not.toContain("test-key");
  });

  it("carries on after a pause, and stops at the search limit", async () => {
    const search = { type: "server_tool_use", name: "web_search", input: {} };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(reply([search, search], "pause_turn"))
      .mockResolvedValueOnce(reply([search, { type: "text", text: "<picks>[]</picks>" }]));
    const r = await runSearch({ ...opts, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(r.searches).toBe(3);
    const second = JSON.parse(String((fetchImpl.mock.calls[1] as [string, RequestInit])[1].body));
    expect(second.tools[0].max_uses).toBe(3);
    expect(second.messages).toHaveLength(2);
  });

  it("turns a provider error into a plain message without echoing its body", async () => {
    const fetchImpl = vi.fn(async () => new Response("secret echo test-key", { status: 401 }));
    await expect(runSearch({ ...opts, fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toThrow("The search service said no (401).");
  });

  it("tells the model pages are data and never to guess", () => {
    expect(systemPrompt()).toMatch(/ignore them/);
    expect(systemPrompt()).toMatch(/Never guess a date/);
    expect(userPrompt(null, [], NOW)).toContain("It is now 2026-11-01T10:00 in New York.");
  });
});

describe("the request", () => {
  const goodText = `<picks>${JSON.stringify([pick(), pick({ title: "No price class", price: null }), pick({ url: "https://invented.example.com" })])}</picks>`;
  const settings = { enabled: true, hasKey: true, runsPerDay: 3, memberPerDay: 3, dailyLimit: 40, maxSearches: 8, sweepSearches: 5, memberSearches: 4 };
  function deps(over: Partial<ScoutDeps> = {}, dbOver: Partial<ScoutDeps["db"]> = {}, authOver: Partial<ScoutDeps["auth"]> = {}) {
    const saved: Record<string, unknown>[] = [];
    const runs: Record<string, unknown>[] = [];
    const finished: unknown[] = [];
    const marked: number[] = [];
    const search = vi.fn(async (_f: string | null, _c: string[], _n: number) => ({ text: goodText, sourceLinks: new Set([linkKey(PAGE)!]), searches: 3 }));
    const d: ScoutDeps = {
      settings,
      now: () => NOW,
      auth: { sweepTokenOk: async (t) => t === "good-token", caller: async () => ({ id: "admin-1", isAdmin: true }), ...authOver },
      db: {
        runsSince: async () => 0,
        startRun: async (r) => (runs.push(r), 41),
        finishRun: async (id, r) => void finished.push({ id, ...r }),
        nextWatch: async () => ({ id: 5, query: "NYU events" }),
        markWatch: async (id) => void marked.push(id),
        corners: async () => [{ id: 7, name: "Pottery" }],
        existingKeys: async () => new Set(),
        insertPick: async (row) => (saved.push(row), true),
        ...dbOver,
      },
      search,
      ...over,
    };
    return { d, saved, runs, finished, marked, search };
  }
  const post = (body: unknown = {}, headers: Record<string, string> = { authorization: "Bearer x" }) =>
    new Request("https://fn.example.com/stubby-scout", { method: "POST", headers, body: JSON.stringify(body) });

  it("admin: saves clean finds live and noted ones as drafts, and reports what it dropped", async () => {
    const { d, saved, runs, finished, search } = deps();
    const res = await handleScout(post({ focus: "pottery" }), d);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ added: 2, live: 1, found: 3, searches: 3 });
    expect(body.dropped).toHaveLength(1);
    expect(saved.map((r) => [r.title, r.published, r.requested_by])).toEqual([
      ["No price class", false, null],
      ["Pottery in the park", true, null],
    ]);
    expect(runs[0]).toEqual({ kind: "admin", focus: "pottery", startedBy: "admin-1", watchId: null });
    expect(search.mock.calls[0][2]).toBe(8);
    expect(finished).toEqual([{ id: 41, searches: 3, found: 3, added: 2, error: null }]);
  });

  it("admin: refuses someone who isn't one, before searching", async () => {
    const { d, search } = deps({}, {}, { caller: async () => ({ id: "m1", isAdmin: false }) });
    expect((await handleScout(post({ focus: "x" }), d)).status).toBe(403);
    expect(search).not.toHaveBeenCalled();
  });

  it("member: needs a focus, saves finds as theirs, and says how many asks are left", async () => {
    const { d, saved, runs, search } = deps({}, { runsSince: async (_ms, f) => (f?.userId === "m1" ? 1 : 0) }, { caller: async () => ({ id: "m1", isAdmin: false }) });
    expect((await (await handleScout(post({ mode: "member" }), d)).json()).error).toBe(MESSAGES.noFocus);
    const res = await handleScout(post({ mode: "member", focus: "dog friendly things saturday" }), d);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.asksLeft).toBe(1);
    expect(body.picks.map((p: { title: string; live: boolean }) => [p.title, p.live])).toEqual([["No price class", false], ["Pottery in the park", true]]);
    expect(saved.every((r) => r.requested_by === "m1")).toBe(true);
    expect(runs[0]).toMatchObject({ kind: "member", startedBy: "m1" });
    expect(search.mock.calls[0][2]).toBe(4);
  });

  it("member: stops at 3 asks a day, before anything is paid for", async () => {
    const { d, search } = deps({}, { runsSince: async (_ms, f) => (f?.userId === "m1" ? 3 : 0) }, { caller: async () => ({ id: "m1", isAdmin: false }) });
    const res = await handleScout(post({ mode: "member", focus: "pottery" }), d);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe(MESSAGES.memberCap(3));
    expect(search).not.toHaveBeenCalled();
  });

  it("everyone stops at the app's daily limit", async () => {
    const { d, search } = deps({}, { runsSince: async (_ms, f) => (f ? 0 : 40) });
    const res = await handleScout(post({ focus: "x" }), d);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe(MESSAGES.dailyCap);
    expect(search).not.toHaveBeenCalled();
  });

  it("sweep: with the token, searches the next watch, marks it first, and saves for everyone", async () => {
    const { d, saved, runs, marked, search } = deps({}, {}, { caller: async () => { throw new Error("a sweep never asks who is signed in"); } });
    const res = await handleScout(post({ mode: "sweep" }, { "x-scout-sweep": "good-token" }), d);
    expect(res.status).toBe(200);
    expect(marked).toEqual([5]);
    expect(runs[0]).toEqual({ kind: "sweep", focus: "NYU events", startedBy: null, watchId: 5 });
    expect(search.mock.calls[0][0]).toBe("NYU events");
    expect(search.mock.calls[0][2]).toBe(5);
    expect(saved.every((r) => r.requested_by === null)).toBe(true);
  });

  it("sweep: a wrong token is refused, and nothing waiting means no search", async () => {
    expect((await handleScout(post({}, { "x-scout-sweep": "bad" }), deps().d)).status).toBe(401);
    const { d, search } = deps({}, { nextWatch: async () => null });
    const body = await (await handleScout(post({}, { "x-scout-sweep": "good-token" }), d)).json();
    expect(body.idle).toBe(true);
    expect(search).not.toHaveBeenCalled();
  });

  it("is off unless switched on with a key, needs a sign-in, and POST", async () => {
    expect((await handleScout(post(), deps({ settings: { ...settings, enabled: false } }).d)).status).toBe(503);
    expect((await handleScout(post(), deps({ settings: { ...settings, hasKey: false } }).d)).status).toBe(503);
    expect((await handleScout(post({}, {}), deps().d)).status).toBe(401);
    expect((await handleScout(post(), deps({}, {}, { caller: async () => null }).d)).status).toBe(401);
    expect((await handleScout(new Request("https://fn.example.com", { method: "GET", headers: { authorization: "x" } }), deps().d)).status).toBe(405);
  });

  it("saves nothing when the answer can't be read, and logs why", async () => {
    const { d, saved, finished } = deps({ search: async () => ({ text: "sorry", sourceLinks: new Set(), searches: 2 }) });
    const res = await handleScout(post(), d);
    expect(res.status).toBe(502);
    expect(saved).toEqual([]);
    expect(finished[0]).toMatchObject({ searches: 2, added: 0, error: MESSAGES.unreadable });
  });

  it("counts a pick another run saved first as dropped, not added", async () => {
    const { d } = deps({}, { insertPick: async () => false });
    const body = await (await handleScout(post(), d)).json();
    expect(body.added).toBe(0);
    expect(body.dropped.map((x: { reason: string }) => x.reason)).toContain("Already a City pick.");
  });

  it("clamps its settings", () => {
    const s = readSettings((k) => ({ STUBBY_SCOUT_ENABLED: "true", ANTHROPIC_API_KEY: "k", STUBBY_SCOUT_RUNS_PER_DAY: "999", STUBBY_SCOUT_MAX_SEARCHES: "abc", STUBBY_SCOUT_MEMBER_PER_DAY: "50" })[k]);
    expect(s).toEqual({ enabled: true, hasKey: true, runsPerDay: 20, memberPerDay: 10, dailyLimit: 40, maxSearches: 8, sweepSearches: 5, memberSearches: 4 });
    expect(readSettings(() => undefined).enabled).toBe(false);
  });
});

it("never catches a SearchError as an unknown failure", () => {
  expect(new SearchError("x", 504).status).toBe(504);
});
