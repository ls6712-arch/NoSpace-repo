// The decision trace holds only normalised values (founder, Nov 3, 2026): enums, reason codes,
// numbers, booleans, the rules' version, and pick titles as the search found them. Never words
// typed in the ask: not for the activity, the company or the exclusions. This walks every key and
// every string in every trace the scenario set would save, plus asks written to leak.
import { describe, expect, it } from "vitest";
import { STUBBY_CONFIG } from "../config.ts";
import type { DecisionTrace } from "../contract.ts";
import { runScenario } from "./run.ts";
import { SCENARIOS, type Scenario } from "./scenarios.ts";

/** Every string value a trace may hold, outside pick titles and the version. */
const ENUMS = new Set<string>([
  // strengths and sources (config.ts precedence)
  "hard", "soft", "inferred", "unknown",
  ...STUBBY_CONFIG.precedence,
  // company, setting, time labels, kinds of thing (intent.ts)
  "solo", "partner", "friends", "family",
  "in", "out",
  "tonight", "today", "tomorrow", "weekend", "day", "week",
  "active", "make", "food", "chill", "learn",
  // exclusion codes, unknown fields, preference attributes (contract.ts)
  "adult",
  "company", "setting", "budget", "energy", "travel",
  "corners", "free_times", "passes", "neighborhood", "city",
  // pick fields and outcomes
  "event", "idea", "web", "soosh", "valid", "uncertain", "rank", "after_budget", "soonest_after",
  "found", "after", "nothing",
]);

/** Every object key a trace may use: its schema, and reason codes for the drop counts. */
const KEYS = new Set<string>([
  "version", "contract", "preferences", "rounds", "found", "outcome", "picks", "dropped",
  "activity", "company", "setting", "timeWindow", "budget", "energy", "travel", "exclusions", "unknowns",
  "value", "from", "strength", "specific", "vibes", "label", "startMs", "endMs", "max", "free",
  "title", "kind", "source", "eligibility", "selection", "rank", "why",
  // reason codes (picks.ts ReasonKey)
  "listing", "midnight", "time", "noprice", "adult", "nopage", "notime", "family", "other",
]);

/** Every string and key in a trace that isn't normalised, with where it is. */
function freeText(trace: DecisionTrace, titles: ReadonlySet<string>): string[] {
  const bad: string[] = [];
  const walk = (v: unknown, path: string) => {
    if (typeof v === "string") {
      const isTitle = /^picks\.\d+\.title$/.test(path) && titles.has(v);
      const isVersion = (path === "version" || path === "contract.version") && v === STUBBY_CONFIG.version;
      if (!isTitle && !isVersion && !ENUMS.has(v)) bad.push(`${path} = ${JSON.stringify(v)}`);
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}.${i}`));
    else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        if (!KEYS.has(k)) bad.push(`${path ? `${path}.` : ""}${k} (key)`);
        walk(x, path ? `${path}.${k}` : k);
      }
    } else if (!(v === null || typeof v === "number" || typeof v === "boolean")) bad.push(`${path} is a ${typeof v}`);
  };
  walk(trace, "");
  return bad;
}

const titlesOf = (s: Scenario) => new Set(s.candidates.map((c) => String(c.title)));

/** Asks written to leak: every typed word that could reach a trace, if a field carried text. */
const LEAKY: Scenario[] = [
  {
    id: "leak-activity-company-exclusions",
    group: "missing data",
    ask: "zorblax pottery tonight with my sister's coworkers, no alcohol, under $15, nothing near Quimby Street",
    candidates: [{ kind: "event", title: "Wheel night", place: "Brooklyn", starts: "2026-11-01T19:00", ends: "2026-11-01T21:00", price: "$10", url: "https://example.org/studio/wheel-night", corner: "Pottery", why: "A drop-in.", unsure: null }],
    expect: {},
  },
  {
    id: "leak-stay-in",
    group: "missing data",
    ask: "cozy at home with my partner, something with my grandmother's loom",
    sooshLinks: ["/start/crafts/pottery"],
    candidates: [{ kind: "idea", title: "Throw a pinch pot", place: null, starts: "2026-11-01T19:30", ends: null, price: null, url: "/start/crafts/pottery", corner: "Pottery", why: "No booking.", unsure: null }],
    expect: {},
  },
  {
    id: "leak-wine-asked",
    group: "missing data",
    ask: "a wine tasting with Priyanka from work this weekend",
    candidates: [{ kind: "event", title: "Beginner wine tasting", place: "Manhattan", starts: "2026-11-01T19:00", ends: "2026-11-01T21:00", price: "$25", url: "https://example.org/tastings/beginner", corner: null, why: "Asked for.", unsure: null }],
    expect: {},
  },
];

describe("the decision trace holds only normalised values", () => {
  for (const s of [...SCENARIOS, ...LEAKY]) {
    it(`${s.id}: no free text, and nothing typed`, async () => {
      const r = await runScenario(s);
      // A question is answered before any search: nothing is saved, so there's no trace.
      if (s.expect.question) return expect(r.trace).toBeUndefined();
      expect(r.trace, "a trace was saved").toBeDefined();
      expect(freeText(r.trace!, titlesOf(s))).toEqual([]);
      // No word they typed (4 letters or more, other than one of the enums) appears anywhere in it.
      const json = JSON.stringify(r.trace).toLowerCase();
      const titles = [...titlesOf(s)].join(" ").toLowerCase();
      for (const w of s.ask.toLowerCase().split(/[^a-z0-9$']+/)) {
        if (w.length < 4 || ENUMS.has(w) || KEYS.has(w) || titles.includes(w)) continue;
        expect(json, `"${w}" from the ask`).not.toContain(w);
      }
    });
  }

  it("the exclusions are codes, not words", async () => {
    const r = await runScenario(LEAKY[0]);
    expect(r.trace!.contract.exclusions).toEqual({ value: ["adult"], from: "default", strength: "inferred" });
    const asked = await runScenario(LEAKY[2]);
    expect(asked.trace!.contract.exclusions).toEqual({ value: [], from: "ask", strength: "hard" });
  });
});
