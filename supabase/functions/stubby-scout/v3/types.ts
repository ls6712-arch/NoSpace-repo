import type { CapabilityProfile, LearnedPreference } from "../../_shared/capabilityProfile.ts";
import type { PersonProfile } from "../handler.ts";
import type { Answers, Window } from "../intent.ts";
export const V3_VERSION = "stubby-v3.3";
export interface Evidence {
  url: string;
  checkedAt: number;
  level: "provider" | "search";
  /** An ingestion adapter, never the model, assigns verification level. */
  source: string;
}
export interface Candidate {
  id: string;
  title: string;
  kind: "event" | "idea";
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
}
export interface Context {
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
  topicCatalog: string[];
  goals: string[];
  preferences: string[];
  learned: LearnedPreference[];
  memberships: CapabilityProfile["memberships"];
  usualWindows: string[];
  busy: { startsAt: number; endsAt: number }[];
  weather: "safe" | "unsafe" | "unknown";
}
export interface Recommendation {
  candidate: Candidate;
  verification: "verified" | "partial";
  uncertainties: string[];
  explanation: string;
  score: number;
}
export interface V3Report {
  version: string;
  outcome: "verified" | "partial" | "no_verified_match";
  recommendations: Recommendation[];
  fallback: string | null;
  warnings: string[];
  dropped: { id: string; reason: string }[];
  usage: { input: number; output: number; calls: number };
}
/** Retained on the existing owner-only ask trace. No ask, profile values or feedback text. */
export interface V3DecisionTrace {
  version: string;
  outcome: V3Report["outcome"];
  found: number;
  added: number;
  usage: V3Report["usage"];
  rejected: Record<string, number>;
  sources: { rank: number; evidence: Evidence[]; verification: Recommendation["verification"] }[];
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
