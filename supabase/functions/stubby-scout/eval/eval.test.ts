// Stubby's scenario set (stubby-agent G1 and G2): every scenario through the real handler, every
// hard rule checked on each, results by group. A hard rule failing, or a group passing fewer than
// it did, fails the PR (founder, Nov 3, 2026, from PR 7 on).
import { describe, expect, it } from "vitest";
import { STUBBY_CONFIG, byPrecedence } from "../config.ts";
import { buildContract, explicitPreferences } from "../contract.ts";
import { readIntent, searchWindow } from "../intent.ts";
import { nyLocalToMs } from "../picks.ts";
import { runAll, runScenario } from "./run.ts";
import { SCENARIOS } from "./scenarios.ts";

/** How many in each group passed when the set was written. A group may only go up. */
const BASELINE: Record<string, number> = {
  "cold start": 2,
  questions: 4,
  budget: 4,
  precedence: 3,
  "missing data": 1,
  company: 1,
  time: 1,
  "real failures": 3,
};

describe("the scenario set", () => {
  it("has the 20 first scenarios (19 here, plus the privacy one below) and the V3 ones, with unique ids", () => {
    expect(SCENARIOS.filter((x) => !x.engines)).toHaveLength(19);
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
  });

  for (const s of SCENARIOS.filter((x) => !x.engines || x.engines.includes("legacy"))) {
    it(`${s.group}: ${s.id}`, async () => {
      const r = await runScenario(s);
      expect(r.hard, "hard rules").toEqual([]);
      expect(r.expectations, "expectations").toEqual([]);
    });
  }

  it("no group passes fewer than its baseline, and no hard rule fails anywhere", async () => {
    const { groups, table } = await runAll();
    // The table every PR reports.
    console.log(`Scenario set (rules ${STUBBY_CONFIG.version}):\n${table}`);
    for (const [group, g] of groups) {
      expect(g.hard, group).toBe(0);
      expect(g.passed, group).toBeGreaterThanOrEqual(BASELINE[group] ?? 0);
    }
  });
});

/**
 * V3 on the same set, plus its own scenarios (Nov 3, 2026): no hard rule may fail, and no group may
 * pass fewer than the legacy engine does. Nothing the current engine does well may get worse.
 */
describe("the scenario set, V3", () => {
  for (const s of SCENARIOS.filter((x) => !x.engines || x.engines.includes("v3"))) {
    it(`${s.group}: ${s.id}`, async () => {
      const r = await runScenario(s, "v3");
      expect(r.hard, "hard rules").toEqual([]);
      expect(r.expectations, "expectations").toEqual([]);
    });
  }

  it("no group passes fewer than legacy does, and no hard rule fails anywhere (results by group)", async () => {
    const legacy = await runAll(SCENARIOS, "legacy");
    const v3 = await runAll(SCENARIOS, "v3");
    console.log(`Scenario set, legacy (rules ${STUBBY_CONFIG.version}):\n${legacy.table}\n\nScenario set, V3:\n${v3.table}`);
    for (const [group, g] of v3.groups) {
      expect(g.hard, group).toBe(0);
      expect(g.passed, group).toBeGreaterThanOrEqual(legacy.groups.get(group)?.passed ?? 0);
    }
    for (const [group, g] of legacy.groups) expect(v3.groups.get(group)?.passed ?? 0, group).toBeGreaterThanOrEqual(g.passed);
  });
});

describe("privacy", () => {
  it("never saves what was typed: not in the drop reasons, the trace, or the picks (scenario 20)", async () => {
    const ask = "something quiet near my ex's place tonight";
    const r = await runScenario({
      id: "privacy-no-ask-text",
      group: "missing data",
      ask,
      answers: { setting: "out", who: "solo" },
      candidates: [{ kind: "event", title: "Quiet reading room", place: "Library", starts: "2026-11-01T19:00", ends: "2026-11-01T21:00", price: "Free", url: "https://example.org/library/reading-room", corner: null, why: "Calm and free.", unsure: null }],
      expect: { kept: ["Quiet reading room"] },
    });
    expect(r.hard).toEqual([]);
    expect(r.expectations).toEqual([]);
  });
});

describe("precedence and the contract", () => {
  const NOW = nyLocalToMs("2026-11-01T17:00");

  it("the highest source wins, in the configured order", () => {
    expect(STUBBY_CONFIG.precedence).toEqual(["ask", "answer", "session", "profile", "learned", "default"]);
    expect(byPrecedence({ profile: "x", session: "y" })).toEqual({ value: "y", from: "session" });
    expect(byPrecedence({ default: 1 })).toEqual({ value: 1, from: "default" });
    expect(byPrecedence({})).toBeNull();
  });

  it("marks what's unknown, and never claims it", () => {
    const intent = readIntent("pottery tonight", { now: NOW });
    const c = buildContract(intent, searchWindow(intent, NOW));
    expect(c.version).toBe(STUBBY_CONFIG.version);
    expect(c.unknowns).toEqual(["company", "setting", "budget", "energy", "travel"]);
    expect(c.timeWindow).toMatchObject({ from: "ask", strength: "hard", value: { label: "tonight" } });
    expect(c.exclusions).toMatchObject({ from: "default", strength: "inferred" });
  });

  it("a monthly amount stays separate from an explicit activity ceiling", () => {
    const soft = readIntent("pottery tonight", { now: NOW, monthlyBudget: 50 });
    expect(buildContract(soft, searchWindow(soft, NOW)).budget).toEqual({ value:null,from:null,strength:"unknown" });
    const hard = readIntent("pottery tonight under $20", { now: NOW, monthlyBudget: 50 });
    expect(buildContract(hard, searchWindow(hard, NOW)).budget).toEqual({ value: { max: 20, free: false }, from: "ask", strength: "hard" });
  });

  it("the explicit layer is only what they set, by attribute, never inferred", () => {
    const prefs = explicitPreferences({ corners: ["Pottery"], monthlyBudget: 0, freeTimes: [], passes: [], neighborhood: "Greenpoint", city: null });
    expect(prefs.map((p) => p.attribute)).toEqual(["corners", "budget", "neighborhood"]);
    expect(prefs.every((p) => p.source === "explicit" && p.scope === "durable" && p.confidence === 1)).toBe(true);
  });
});
