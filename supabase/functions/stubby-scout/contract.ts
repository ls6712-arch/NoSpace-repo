// Stubby agent (docs/briefs/stubby-agent.md): the request contract (C3), the explicit preference
// layer (B1, B2) and the decision trace (G4). Pure: no network, no database, no Deno.
//
// The contract is what Stubby understood this ask to need, field by field, each with where it
// came from (B3) and how strongly it binds:
//   hard      typed in the ask or tapped for it: "free", "tonight", "at home". No score outweighs it.
//   soft      from the profile: the monthly budget, usual free times. Ranked and disclosed, never a drop.
//   inferred  a default Stubby assumes (no bars unless asked). Never overrides what they typed.
//   unknown   not known. An unknown hard requirement blocks a claim; an unknown detail is disclosed.
//
// Never the text of the ask: every value in the trace is an enum, a code, a number, the rules'
// version, or a pick's title as the search found it (contract.test.ts walks every string). The trace saves the contract, where each candidate came from, why it
// was kept, and the rules' version, so the weekly review can see why a deck looked the way it did.

import { STUBBY_CONFIG, type Source } from "./config.ts";
import type { AskPick } from "./ask.ts";
import type { Intent, Setting, Who, Window } from "./intent.ts";
import type { Dropped, ReasonKey } from "./picks.ts";

export type Strength = "hard" | "soft" | "inferred" | "unknown";
/** Exclusion codes. Never words from the ask. */
export type Exclusion = "adult";

export interface Term<T> {
  value: T | null;
  from: Source | null;
  strength: Strength;
}

export interface RequestContract {
  version: string;
  /** A particular thing was named (pottery, a run), and the kinds of thing the words point to. */
  activity: Term<{ specific: boolean; vibes: Intent["vibes"] }>;
  company: Term<Who>;
  setting: Term<Setting>;
  timeWindow: Term<{ label: Window["label"]; startMs: number; endMs: number }>;
  budget: Term<{ max: number; free: boolean }>;
  /** Not read yet (PR 10): energy and travel are always unknown for now. */
  energy: Term<string>;
  travel: Term<string>;
  /** What's left out by default unless asked, as codes: "adult" is bars, breweries, tastings and 21+. */
  exclusions: Term<Exclusion[]>;
  /** Fields nobody knows, so no pick may claim them. */
  unknowns: string[];
}

const term = <T>(value: T | null, from: Source | null, strength: Strength): Term<T> => ({ value, from, strength: value === null ? "unknown" : strength });

/** Typed or tapped for this ask: hard. Remembered or from the profile: soft. A default: inferred. */
const strengthOf = (from: Source | null): Strength => (from === "ask" || from === "answer" ? "hard" : from === "session" || from === "profile" || from === "learned" ? "soft" : from === "default" ? "inferred" : "unknown");

/** The request contract for one ask: what it needs, field by field, and where each came from. */
export function buildContract(intent: Intent, window: Window): RequestContract {
  const timeFrom: Source = intent.from.when ?? "default";
  const contract: RequestContract = {
    version: STUBBY_CONFIG.version,
    activity: term({ specific: intent.specific, vibes: [...intent.vibes] }, "ask", intent.specific ? "hard" : "soft"),
    company: term(intent.who, intent.from.who, strengthOf(intent.from.who)),
    setting: term(intent.setting, intent.from.setting, strengthOf(intent.from.setting)),
    timeWindow: term({ label: window.label, startMs: window.startMs, endMs: window.endMs }, timeFrom, window.hard ? "hard" : "inferred"),
    budget: term(intent.budget ? { max: intent.budget.max, free: intent.budget.free } : null, intent.from.budget, strengthOf(intent.from.budget)),
    energy: term<string>(null, null, "unknown"),
    travel: term<string>(null, null, "unknown"),
    exclusions: intent.adults ? term<Exclusion[]>([], "ask", "hard") : term<Exclusion[]>(["adult"], "default", "inferred"),
    unknowns: [],
  };
  contract.unknowns = (["company", "setting", "budget", "energy", "travel"] as const).filter((k) => contract[k].strength === "unknown");
  return contract;
}

// ── the explicit preference layer (B1, B2): only what the person set themselves ──────────

export interface Preference {
  attribute: "corners" | "budget" | "free_times" | "passes" | "neighborhood" | "city";
  value: unknown;
  source: "explicit";
  confidence: 1;
  context: "any";
  scope: "durable";
}

/** Their profile as explicit preferences: what they chose to share, nothing inferred. Empty fields are left out. */
export function explicitPreferences(p: { corners: string[]; monthlyBudget: number | null; freeTimes: string[]; passes: string[]; neighborhood: string | null; city: string | null }): Preference[] {
  const out: Preference[] = [];
  const add = (attribute: Preference["attribute"], value: unknown) => out.push({ attribute, value, source: "explicit", confidence: 1, context: "any", scope: "durable" });
  if (p.corners.length) add("corners", p.corners);
  if (p.monthlyBudget !== null) add("budget", { monthly: p.monthlyBudget });
  if (p.freeTimes.length) add("free_times", p.freeTimes);
  if (p.passes.length) add("passes", p.passes);
  if (p.neighborhood) add("neighborhood", p.neighborhood);
  if (p.city) add("city", p.city);
  return out;
}

// ── the decision trace (G4) ─────────────────────────────────────────────────────────

export interface TracePick {
  /** The title as found (80 at most): the weekly review needs to know which card this was. */
  title: string;
  kind: AskPick["kind"];
  /** Where the candidate came from: a page from the web search, or a Soosh page Stubby offered. */
  source: "web" | "soosh";
  /** Valid, or uncertain when something optional couldn't be checked (no price listed, say). */
  eligibility: "valid" | "uncertain";
  /** Why it's in the deck, and where. */
  selection: "rank" | "after_budget" | "soonest_after";
  rank: number;
  /** What the why line may draw on: here, only that the model wrote one. Checked properly in PR 10. */
  why: boolean;
}

export interface DecisionTrace {
  version: string;
  contract: RequestContract;
  /** The person's own preferences that were used, by attribute only (never their values). */
  preferences: Preference["attribute"][];
  /** How many search rounds ran (a second runs when fewer than 3 fit). */
  rounds: number;
  found: number;
  outcome: "found" | "after" | "nothing";
  picks: TracePick[];
  /** How many were dropped for each kind of reason. */
  dropped: Partial<Record<ReasonKey, number>>;
}

const isSooshPath = (url: string) => url.startsWith("/");

/** The decision trace for one ask. Never the ask's text. */
export function decisionTrace(r: {
  contract: RequestContract;
  preferences: readonly Preference[];
  rounds: number;
  found: number;
  outcome: DecisionTrace["outcome"];
  kept: readonly AskPick[];
  dropped: readonly Dropped[];
}): DecisionTrace {
  const dropped: Partial<Record<ReasonKey, number>> = {};
  for (const d of r.dropped) {
    const k = d.key ?? "other";
    dropped[k] = (dropped[k] ?? 0) + 1;
  }
  return {
    version: STUBBY_CONFIG.version,
    contract: r.contract,
    preferences: r.preferences.map((p) => p.attribute),
    rounds: r.rounds,
    found: r.found,
    outcome: r.outcome,
    picks: r.kept.slice(0, STUBBY_CONFIG.saved.tracePicksMost).map((p, rank) => ({
      title: p.title.slice(0, 80),
      kind: p.kind,
      source: isSooshPath(p.url) ? "soosh" : "web",
      eligibility: p.note ? "uncertain" : "valid",
      selection: p.after ? "soonest_after" : p.budgetMiss ? "after_budget" : "rank",
      rank,
      why: !!p.why,
    })),
    dropped,
  };
}
