import { expect, it, vi } from "vitest";
import { handleScout, EMPTY_PROFILE, type ScoutDeps, readSettings } from "../../supabase/functions/stubby-scout/handler.ts";
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
  expect(trace).toMatchObject({ version: "stubby-v3.3", outcome: "verified", sources: [{ rank: 0 }] });
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
it("missing/revoked memory is not sent to the model, including legacy onboarding", async () => {
  const d = deps(); d.db.capability = async () => { throw new Error("missing migration"); };
  await handleScout(ask({ answers: { skip: true } }), d);
  expect(d.db.profile).not.toHaveBeenCalled();
  expect(d.v3).toHaveBeenCalledWith(expect.objectContaining({ profile: EMPTY_PROFILE, learned: [] }));
});
it("streams the V3 outcome and distinguishes a persistence failure from a recommendation", async () => {
  const d = deps(); const res = await handleScout(ask({ stream: true }), d);
  const stream = await res.text(); expect(stream).toContain("event: done"); expect(stream).toContain('"intelligence"');
  d.server.insertPersonal = async () => false;
  const body = await (await handleScout(ask(), d)).json();
  expect(body.picks).toEqual([]); expect(body.intelligence.outcome).toBe("no_verified_match");
});
it("selects keys by server-side provider flag, keeping Anthropic as rollback", () => {
  const env: Record<string, string> = { STUBBY_ASK_ENGINE: "v3", STUBBY_V3_PROVIDER: "openai", OPENAI_API_KEY: "test" };
  expect(readSettings(k => env[k])).toMatchObject({ askEngine: "v3", askHasKey: true, hasKey: false });
  delete env.STUBBY_ASK_ENGINE;
  expect(readSettings(k => env[k])).toMatchObject({ askEngine: "legacy", askHasKey: false });
});
it("runs an authenticated V3 ask through Claude with the existing key and saves only private picks", async () => {
  const values: Record<string, string> = { STUBBY_ASK_ENGINE: "v3", STUBBY_SCOUT_ENABLED: "true", ANTHROPIC_API_KEY: "existing-test-key" };
  const env = (key: string) => values[key];
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(wireResponse(claudeResearch)).mockResolvedValueOnce(wireResponse(claudeStructured()));
  const d = deps(); d.settings = readSettings(env);
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
