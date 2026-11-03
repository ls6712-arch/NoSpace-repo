// Their own Pursuits and Corners in V3 (Nov 3, 2026): Stay in never depends on a web search, what a
// pick needs is said plainly instead of "uncertain", and a deck isn't all one kind when good
// alternatives exist.
import { describe, expect, it, vi } from "vitest";
import { needsLine, sooshAdapter, sooshCandidates, cornerOf } from "../../supabase/functions/stubby-scout/v3/soosh.ts";
import { runV3 } from "../../supabase/functions/stubby-scout/v3/orchestrator.ts";
import { buildContext } from "../../supabase/functions/stubby-scout/v3/context.ts";
import { groupOf } from "../../supabase/functions/stubby-scout/v3/recommendation.ts";
import { handleScout, type ScoutDeps } from "../../supabase/functions/stubby-scout/handler.ts";
import { EMPTY_PROFILE } from "../../supabase/functions/stubby-scout/handler.ts";
import { candidate, input, NOW } from "./fixtures.ts";

const BAKING = "food-cooking/baking";
const own = (over: Partial<Parameters<typeof sooshAdapter>[0]> = {}) => sooshAdapter({ pursuits: [{ id: "p1", title: "Bake a loaf every week", corner: BAKING }], picks: [], ...over });

describe("what a pick needs", () => {
  it("says it plainly", () => {
    expect(needsLine(["Flour", "A loaf tin"])).toBe("You’ll need flour and a loaf tin.");
    expect(needsLine(["Flour", "Yeast", "A loaf tin", "An oven"])).toBe("You’ll need flour, yeast and a loaf tin.");
    expect(needsLine([])).toBeNull();
  });
  it("comes from the Corner's own needs", () => {
    expect(cornerOf(BAKING)?.needs.length).toBeGreaterThan(0);
    expect(cornerOf("old-space/baking")?.key).toBe(BAKING);
  });
});

describe("Stay in, from their own Pursuits and Corners", () => {
  it("answers Stay in with no web source at all, and nothing is marked uncertain", async () => {
    const r = await runV3(input({ text: "something at home tonight", profile: { ...input().profile, picks: ["art-creative/drawing"] } }),
      { discovery: [sooshAdapter({ pursuits: [{ id: "p1", title: "Bake a loaf every week", corner: BAKING }], picks: ["art-creative/drawing"] })] });
    // Drawing first: it's one of the Corners they picked (an interest match).
    expect(r.recommendations.map((x) => x.candidate.title)).toEqual(["Drawing at home", "Bake a loaf every week"]);
    expect(r.recommendations.every((x) => x.verification === "verified" && x.uncertainties.length === 0)).toBe(true);
    expect(r.outcome).toBe("verified");
  });
  it("a failed web source doesn't make their own ideas uncertain", async () => {
    const r = await runV3(input({ text: "something at home tonight" }), { discovery: [own(), { id: "web", discover: async () => { throw new Error("down"); } }] });
    expect(r.recommendations[0].verification).toBe("verified");
    expect(r.warnings).toContain("A source couldn’t be reached.");
  });
  it("only at-home Corners, never outdoors or with other people", () => {
    const ctx = buildContext(input({ text: "something at home tonight" }));
    const rows = sooshCandidates({ pursuits: [], picks: ["sports-fitness/running", "art-creative/drawing"] }, ctx);
    expect(rows.map((c) => c.title)).toEqual(["Drawing at home"]);
  });
});

describe("a deck that isn't all one kind", () => {
  const pursuits = [1, 2, 3, 4].map((n) => ({ id: `p${n}`, title: `Pursuit ${n}`, corner: BAKING }));
  it("mixes in a good alternative when one exists", async () => {
    const web = [candidate({ id: "w1", title: "Pottery class" }), candidate({ id: "w2", title: "Drawing club", tags: ["drawing"] })];
    const r = await runV3(input({ text: "something tonight" }), { discovery: [own({ pursuits }), { id: "web", discover: async () => web }] });
    const groups = r.recommendations.map((x) => groupOf(x.candidate));
    expect(new Set(groups).size).toBeGreaterThan(1);
    expect(groups.filter((g) => g === "pursuit").length).toBeLessThanOrEqual(1);
  });
  it("is all Pursuits only when nothing else fits", async () => {
    const r = await runV3(input({ text: "something at home tonight" }), { discovery: [own({ pursuits })] });
    expect(r.recommendations.map((x) => groupOf(x.candidate))).toEqual(["pursuit", "pursuit", "pursuit"]);
  });
});

describe("in the ask", () => {
  it("saves their own pick as an idea on its own page, with what it needs as the note and no price", async () => {
    const insertPersonal = vi.fn(async () => true);
    const d = {
      settings: { enabled: true, hasKey: true, askHasKey: true, askEngine: "v3", runsPerDay: 3, maxSearches: 3, restockSearches: 3, asksPerPerson: 6, asksPerDay: 200 },
      now: () => NOW, userId: async () => "alice", whoIs: async () => ({ guest: false, member: true }), ipHash: async () => null,
      db: { runsSince: async () => 0, startRun: async () => "forbidden", finishRun: async () => {}, corners: async () => [], existingKeys: async () => new Set(), insertPick: async () => false,
        profile: async () => ({ ...EMPTY_PROFILE, city: "New York", pursuits: [{ id: "p1", title: "Bake a loaf every week", corner: BAKING }] }), capability: async () => input().capability, signals: async () => [] },
      server: { claimSource: async () => null, claimAsk: async () => ({ askId: 7 }), claimFreeFollowUp: async () => false, finishRun: async () => {}, finishAsk: async () => {}, asksSince: async () => 1, trustedHosts: async () => [], corners: async () => [], existingKeys: async () => new Set(), insertPick: async () => true, insertPersonal },
      search: async () => { throw new Error("legacy must not run"); },
      v3: (req) => runV3(req, { discovery: [sooshAdapter({ pursuits: req.profile.pursuits, picks: req.profile.picks })] }),
      careModel: async () => "none",
    } as ScoutDeps;
    const res = await handleScout(new Request("https://x/scout", { method: "POST", body: JSON.stringify({ mode: "ask", ask: "baking at home tonight" }) }), d);
    expect(res.status).toBe(200);
    expect(insertPersonal).toHaveBeenCalledWith(expect.objectContaining({ kind: "idea", url: "/pursuit/p1", price: null, note: expect.stringMatching(/^You’ll need /) }));
  });
});
