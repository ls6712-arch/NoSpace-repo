import { expect, it, vi } from "vitest";
import { handleScout, engineFor, type ScoutDeps, readSettings } from "../../supabase/functions/stubby-scout/handler.ts";
import type { V3DecisionTrace } from "../../supabase/functions/stubby-scout/v3/types.ts";
import { runV3 } from "../../supabase/functions/stubby-scout/v3/orchestrator.ts";
import { candidate, input, NOW } from "./fixtures.ts";
import { createV3Provider } from "../../supabase/functions/stubby-scout/v3/provider.ts";
import { claudeResearch, claudeStructured, wireResponse } from "./provider-fixtures.ts";
function deps() {
  const d: ScoutDeps = {
    settings: { enabled: true, hasKey: false, askHasKey: true, askEngine: "v3", runsPerDay: 3, maxSearches: 3, restockSearches: 3, asksPerPerson: 6, asksPerDay: 200 },
    now: () => NOW, userId: async () => "alice", whoIs: async () => ({ guest: false, member: true }), ipHash: async () => null,
    guestReady: async () => true,
    db: { runsSince: async () => 0, startRun: async () => "forbidden", finishRun: async () => {}, corners: async () => [], existingKeys: async () => new Set(), insertPick: async () => false,
      profile: vi.fn(async () => input().profile), capability: vi.fn(async () => input().capability), signals: vi.fn(async () => []) },
    server: { claimSource: async () => null, claimAsk: vi.fn(async () => ({ askId: 7 })), claimFreeFollowUp: async () => false,
      finishRun: async () => {}, finishAsk: vi.fn(async () => {}), asksSince: async () => 1, trustedHosts: async () => [], corners: async () => [], existingKeys: async () => new Set(), insertPick: vi.fn(async () => true), insertPersonal: vi.fn(async () => true) },
    search: vi.fn(async () => { throw new Error("Legacy must not run"); }),
    v3: vi.fn(async req => runV3(req, { discovery: [{ id: "fixture", discover: async () => [candidate()] }] })),
  };
  return d;
}
const ask = (extra = {}) => new Request("https://example.org/scout", { method: "POST", body: JSON.stringify({ mode: "ask", ask: input().text, ...extra }) });
it("reuses verified identity, atomic quota, and private persistence without public sharing", async () => {
  const d = deps(); const res = await handleScout(ask(), d); const body = await res.json();
  expect(res.status).toBe(200); expect(body.picks).toHaveLength(1); expect(body.intelligence.outcome).toBe("verified");
  expect(d.server.insertPersonal).toHaveBeenCalledWith(expect.objectContaining({ user_id: "alice", ask_id: 7 }));
  expect(d.server.insertPick).not.toHaveBeenCalled(); expect(d.search).not.toHaveBeenCalled();
  const trace = vi.mocked(d.server.finishAsk).mock.calls[0][1].trace;
  expect(trace).toMatchObject({ version: "stubby-v3.4", engine: "v3", outcome: "verified", sources: [{ rank: 0 }], deck: [{ rank: 0, source: "web", kind: "event" }] });
  // The request contract (PR 7) is saved with every V3 ask too.
  expect(trace!.contract).toMatchObject({ budget: { strength: "hard", from: "ask" } });
  expect(JSON.stringify(trace)).not.toContain(input().text);
});
it("cross-user forged fields are refused before tools execute", async () => {
  const d = deps(); expect((await handleScout(ask({ user_id: "bob" }), d)).status).toBe(400); expect(d.v3).not.toHaveBeenCalled();
});
it("requires verified authentication and never runs V3 on quota denial", async () => {
  const d = deps(); d.userId = async () => null;
  expect((await handleScout(ask(), d)).status).toBe(401); expect(d.v3).not.toHaveBeenCalled();
  d.userId = async () => "alice"; d.server.claimAsk = async () => ({ askId: null, code: "USER_LIMIT_REACHED", resetsAt: null });
  expect((await handleScout(ask(), d)).status).toBe(429); expect(d.v3).not.toHaveBeenCalled();
});
it("guest limits and free-follow-up rules still apply with V3", async () => {
  const d = deps(); d.whoIs = async () => ({ guest: true, member: false });
  expect((await handleScout(ask({ followUp: { of: 7, kind: "more", titles: [] } }), d)).status).toBe(403);
  expect(d.v3).not.toHaveBeenCalled();
});
it.each([false, true])("preserves the birthday notice on V3 responses (stream=%s)", async stream => {
  const d = deps();
  const response = await handleScout(ask({ ask: "cocktails tonight", stream }), d);
  const body = stream
    ? JSON.parse((await response.text()).split("event: done\ndata: ")[1].split("\n\n")[0])
    : await response.json();
  expect(body.adultsLeftOut).toBe(true);
  expect(d.v3).toHaveBeenCalledWith(expect.objectContaining({ adult21: false }));
});
it.each([
  { guest: true, member: false, adult21: false },
  { guest: false, member: true, adult21: true },
])("does not offer an account birthday notice for %j", async who => {
  const d = deps(); d.whoIs = async () => who;
  const body = await (await handleScout(ask({ ask: "cocktails tonight" }), d)).json();
  expect(body.adultsLeftOut).toBeUndefined();
});
it("cheaper halves the explicit ceiling without rewriting the user's words", async () => {
  const d = deps(); await handleScout(ask({ followUp: { of: 7, kind: "cheaper", titles: [] } }), d);
  expect(d.v3).toHaveBeenCalledWith(expect.objectContaining({ text: input().text, budgetOverride: 10 }));
});
it("a later follow-up after midnight cannot fall back to an earlier time", async () => {
  const d = deps(); d.now = () => Date.parse("2026-11-04T04:00:00Z");
  await handleScout(ask({ followUp: { of: 7, kind: "later", titles: [] } }), d);
  expect(d.v3).toHaveBeenCalledWith(expect.objectContaining({ notBefore: Date.parse("2026-11-04T06:00:00Z") }));
});
it("preserves cents when making a cheaper follow-up", async () => {
  const d = deps(); await handleScout(ask({ ask: "pottery tonight under $15.50", followUp: { of: 7, kind: "cheaper", titles: [] } }), d);
  expect(d.v3).toHaveBeenCalledWith(expect.objectContaining({ budgetOverride: 7.75 }));
});
it("does not truncate a late hard constraint in a valid 500-character request", async () => {
  const d = deps(); const text = "pottery tonight " + "please ".repeat(30) + "under $12.50";
  await handleScout(ask({ ask: text }), d);
  expect(d.v3).toHaveBeenCalledWith(expect.objectContaining({ text }));
});
it("uses the onboarding answers with nothing saved, and feedback only with its opt-in (Nov 3, 2026)", async () => {
  const d = deps(); d.db.capability = async () => { throw new Error("missing migration"); };
  vi.mocked(d.db.signals!).mockResolvedValue([{ signal: "up", title: "Wheel night", kind: "event" }]);
  await handleScout(ask({ answers: { skip: true } }), d);
  expect(d.db.profile).toHaveBeenCalled();
  expect(d.v3).toHaveBeenCalledWith(expect.objectContaining({ profile: input().profile, learned: [] }));
  d.db.capability = vi.fn(async () => ({ ...input().capability, consent: { memory: true, onboarding: true, feedback: true } }));
  await handleScout(ask({ answers: { skip: true } }), d);
  expect(vi.mocked(d.v3!).mock.calls[1][0].learned).toEqual([{ source: "feedback", signal: "up", title: "Wheel night", kind: "event" }]);
});
it("streams the V3 outcome and distinguishes a persistence failure from a recommendation", async () => {
  const d = deps(); const res = await handleScout(ask({ stream: true }), d);
  const stream = await res.text(); expect(stream).toContain("event: done"); expect(stream).toContain('"intelligence"');
  d.server.insertPersonal = async () => false;
  const body = await (await handleScout(ask(), d)).json();
  expect(body.picks).toEqual([]); expect(body.intelligence.outcome).toBe("no_verified_match");
});
it("V3 is per account: STUBBY_V3_TESTERS only, everyone else stays on legacy, guests never test", () => {
  const id = "0b6e7f6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
  const read = readSettings((k) => ({ STUBBY_V3_TESTERS: ` ${id.toUpperCase()}, not-an-id ,`, ANTHROPIC_API_KEY: "k" })[k]);
  expect(read).toMatchObject({ askEngine: "legacy", askHasKey: true, v3Testers: [id] });
  expect(engineFor(read, id, { guest: false, member: true })).toBe("shadow");
  expect(engineFor(read, "someone-else", { guest: false, member: true })).toBe("legacy");
  expect(engineFor(read, id, { guest: true, member: false })).toBe("legacy");
  expect(engineFor(readSettings((k) => ({ STUBBY_ASK_ENGINE: "v3" })[k]), "anyone", { guest: true, member: false })).toBe("v3");
  expect(readSettings(() => undefined)).toMatchObject({ askEngine: "legacy", v3Testers: [] });
});
it("V3 for everyone: testers still get legacy alongside (shadow), everyone else gets V3, guests never test", () => {
  const id = "0b6e7f6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
  const on = readSettings((k) => ({ STUBBY_ASK_ENGINE: "v3", STUBBY_V3_TESTERS: id, ANTHROPIC_API_KEY: "k" })[k]);
  expect(engineFor(on, id, { guest: false, member: true })).toBe("shadow");
  expect(engineFor(on, "someone-else", { guest: false, member: true })).toBe("v3");
  expect(engineFor(on, id, { guest: true, member: false })).toBe("v3");
  // Rollback: STUBBY_ASK_ENGINE=legacy puts everyone but testers back on legacy.
  const back = readSettings((k) => ({ STUBBY_ASK_ENGINE: "legacy", STUBBY_V3_TESTERS: id, ANTHROPIC_API_KEY: "k" })[k]);
  expect(engineFor(back, "someone-else", { guest: false, member: true })).toBe("legacy");
  expect(engineFor(back, id, { guest: false, member: true })).toBe("shadow");
});
it("shadow compare: a tester sees the V3 deck, and both decks are saved in the trace, never the ask", async () => {
  const d = deps(); d.settings = { ...d.settings, askEngine: "legacy", v3Testers: ["alice"] };
  const legacyPick = { kind: "event", title: "Legacy wheel night", place: "Brooklyn", starts: "2026-11-03T19:30", ends: "2026-11-03T21:00", price: "$15", url: "https://example.org/studio/legacy", corner: null, why: "Good.", unsure: null };
  d.search = vi.fn(async () => ({ text: `<picks>${JSON.stringify([legacyPick])}</picks>`, sourceLinks: new Set(["example.org/studio/legacy"]), searches: 1 }));
  // Not the fixture's "indoors": legacy reads that as Stay in and keeps no events (V3 reads indoor).
  const text = "pottery tonight under $20";
  const body = await (await handleScout(ask({ ask: text }), d)).json();
  expect(body.picks.map((p: { title: string }) => p.title)).toEqual(["Indoor pottery"]);
  expect(d.server.insertPersonal).toHaveBeenCalledTimes(1);
  expect(d.server.insertPick).not.toHaveBeenCalled();
  const trace = vi.mocked(d.server.finishAsk).mock.calls[0][1].trace as V3DecisionTrace;
  expect(trace.deck.map(p => p.title)).toEqual(["Indoor pottery"]);
  expect(trace.legacy).toMatchObject({ outcome: "found", deck: [{ title: "Legacy wheel night", source: "web" }] });
  expect(JSON.stringify(trace)).not.toContain(text);
  expect(new TextEncoder().encode(JSON.stringify(trace)).length).toBeLessThan(16384);
  // A legacy failure never costs the tester their V3 deck.
  d.search = vi.fn(async () => { throw new Error("down"); });
  const again = await (await handleScout(ask({ ask: text }), d)).json();
  expect(again.picks).toHaveLength(1);
  expect((vi.mocked(d.server.finishAsk).mock.calls[1][1].trace as V3DecisionTrace).legacy).toEqual({ failed: true });
});
it("runs an authenticated V3 ask through Claude with the existing key and saves only private picks", async () => {
  const values: Record<string, string> = { STUBBY_V3_TESTERS: "0b6e7f6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b", STUBBY_SCOUT_ENABLED: "true", ANTHROPIC_API_KEY: "existing-test-key" };
  const env = (key: string) => values[key];
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(wireResponse(claudeResearch)).mockResolvedValueOnce(wireResponse(claudeStructured()));
  const d = deps(); d.settings = { ...readSettings(env), askEngine: "v3" };
  d.v3 = async request => {
    const selected = createV3Provider(env, { fetchImpl, maxSearches: request.searchLimit });
    return runV3(request, { discovery: [selected.adapter], usage: selected.usage });
  };
  const response = await handleScout(ask(), d); const body = await response.json();
  expect(response.status).toBe(200); expect(body.picks).toHaveLength(1); expect(body.intelligence.outcome).toBe("partial");
  expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual(["https://api.anthropic.com/v1/messages", "https://api.anthropic.com/v1/messages"]);
  expect(d.search).not.toHaveBeenCalled(); expect(d.server.insertPick).not.toHaveBeenCalled();
  expect(d.server.insertPersonal).toHaveBeenCalledWith(expect.objectContaining({ user_id: "alice", ask_id: 7 }));
  expect(vi.mocked(d.server.finishAsk).mock.calls[0][1].trace).toMatchObject({ usage: { calls: 2 }, sources: [{ evidence: [{ source: "anthropic-web-v1" }] }] });
});

it.each([[20,null,10],[null,0,0]])("Cheaper tightens a saved activity ceiling without relaxing free-only",async(activityBudget,monthlyBudget,expected)=>{
 const d=deps();
 d.db.capability=async()=>({...input().capability,perActivityBudget:activityBudget});
 d.db.profile=async()=>({...input().profile,monthlyBudget});
 const result=await handleScout(ask({ask:"pottery tonight",followUp:{of:7,kind:"cheaper",titles:[]}}),d);
 expect(result.status).toBe(200);
 expect(d.v3).toHaveBeenCalledWith(expect.objectContaining({budgetOverride:expected}));
});
