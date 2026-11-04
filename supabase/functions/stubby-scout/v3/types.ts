import type { CapabilityProfile, LearnedPreference } from "../../_shared/capabilityProfile.ts";
import type { PersonProfile } from "../handler.ts";
import type { Answers, Window } from "../intent.ts";
export const V3_VERSION = "stubby-v3.4";
export interface Evidence {
  url: string;
  checkedAt: number;
  level: "provider" | "search";
  /** An ingestion adapter, never the model, assigns verification level. "soosh-db": the person's own Pursuits and Corners. */
  source: string;
}
export interface Candidate {
  id: string;
  title: string;
  /**
   * event: a dated thing with its own page. place: somewhere to go any time (a park, a walking route,
   * a museum's hours page), never judged as an event listing. idea: something to do, no booking.
   */
  kind: "event" | "idea" | "place";
  startsAt: number;
  endsAt: number | null;
  city: string | null;
  place: string | null;
  setting: "home" | "indoor" | "outdoor" | "unknown";
  cost: { max: number; currency: "USD" } | null;
  status: "scheduled" | "cancelled" | "unknown";
  availability: "available" | "sold_out" | "unknown";
  equipment: string[];
  membership: string | null;
  minAge: number | null;
  travelMinutes: number | null;
  tags: string[];
  evidence: Evidence[];
  /** What it needs, in plain words, when known (a Corner's "What you'll need"). Shown instead of an uncertainty. */
  needs?: string[];
}
export interface RequestInput {
  text: string;
  now: number;
  profile: PersonProfile;
  capability: CapabilityProfile;
  learned: LearnedPreference[];
  adult21: boolean;
  answers: Answers | null;
  exclude: string[];
  notBefore?: number;
  budgetOverride?: number;
  travelOverride?: number;
  sessionCity?: string | null;
  searchLimit?: number;
  knownTopics?: string[];
  /** Ordinary sadness in the ask (care.ts): gentle picks. */
  gentle?: boolean;
}
export interface Context {
  personalization: import("../../_shared/personalization.ts").Personalization;
  version: string;
  now: number;
  timeZone: string;
  city: string | null;
  window: Window;
  hardBudget: number | null;
  softBudget: number | null;
  setting: "home" | "indoor" | "outdoor" | null;
  travelMax: number | null;
  awayFromHome: boolean;
  excludedTopics: string[];
  issues: string[];
  adult21: boolean;
  adultsRequested: boolean;
  family: boolean;
  equipment: string[];
  interests: string[];
  requestedTopics: string[];
  /** False when the ask leaves room ("a walk or something chill"): requested topics rank, they don't filter. */
  topicsHard: boolean;
  topicCatalog: string[];
  goals: string[];
  preferences: string[];
  learned: LearnedPreference[];
  memberships: CapabilityProfile["memberships"];
  usualWindows: string[];
  busy: { startsAt: number; endsAt: number }[];
  weather: "safe" | "unsafe" | "unknown";
  /** Where the city came from. "default": nothing known, so New York, where Soosh runs. */
  cityFrom: "ask" | "session" | "profile" | "default" | null;
  /** Ordinary sadness ("feeling low"): gentle picks, never a crisis card (care.ts). */
  gentle: boolean;
}
export interface Recommendation {
  candidate: Candidate;
  verification: "verified" | "partial";
  uncertainties: string[];
  explanation: string;
  score: number;
  /** Nothing fit the time asked for: one of the soonest after it. */
  after?: boolean;
}
export interface V3Report {
  version: string;
  outcome: "verified" | "partial" | "no_verified_match";
  /** Nothing fit the time asked for, so these are the soonest after it. */
  after?: boolean;
  /** Where the city came from, for the trace. */
  cityFrom?: Context["cityFrom"];
  recommendations: Recommendation[];
  fallback: string | null;
  warnings: string[];
  dropped: { id: string; reason: string }[];
  usage: { input: number; output: number; calls: number };
}
/** One pick in a saved deck: normalised values only, never the ask. */
export interface TraceDeckPick {
  title: string;
  kind: "event" | "idea" | "place";
  source: "web" | "soosh";
  verification: "verified" | "partial";
  rank: number;
  after: boolean;
}
/** Retained on the existing owner-only ask trace. No ask, profile values or feedback text. */
export interface V3DecisionTrace {
  version: string;
  engine: "v3";
  /** The request contract (PR 7): what the ask needed, field by field, and where each came from. */
  contract: import("../contract.ts").RequestContract;
  /** The person's own preferences that were used, by attribute only. */
  preferences: string[];
  cityFrom: Context["cityFrom"];
  gentle: boolean;
  outcome: V3Report["outcome"];
  found: number;
  added: number;
  usage: V3Report["usage"];
  rejected: Record<string, number>;
  deck: TraceDeckPick[];
  sources: { rank: number; evidence: Evidence[]; verification: Recommendation["verification"] }[];
  /** Testers only: the legacy engine on the same ask, not shown (shadow compare). */
  legacy?: { version: string; outcome: string; found: number; rounds: number; deck: TraceDeckPick[]; dropped: Record<string, number> } | { failed: true };
}
/** Adapters return normalized facts, not executable instructions. No purchase or messaging port exists. */
export interface DiscoveryAdapter {
  id: string;
  discover(context: Context, query: string, signal: AbortSignal): Promise<Candidate[]>;
}
export interface ContextAdapter {
  weather?(context: Context, signal: AbortSignal): Promise<Context["weather"]>;
  calendar?(context: Context, signal: AbortSignal): Promise<Context["busy"]>;
}
