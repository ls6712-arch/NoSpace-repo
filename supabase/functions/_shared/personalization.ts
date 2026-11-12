import { CORNER_ALIASES } from "./cornerHome.ts";
/** Shared private personalization and feasibility vocabulary. No network, browser or model dependency. */
export const MOTIVATIONS = ["make", "learn", "move", "company", "personal_time", "explore"] as const;
export type Motivation = typeof MOTIVATIONS[number];
export const RELATIONSHIPS = ["enjoy", "try", "returning", "unspecified"] as const;
export const EXPERIENCE = ["beginner", "practiced", "experienced", "unspecified"] as const;
export const RHYTHMS = ["small", "morning", "evening", "weekend", "variable"] as const;
export interface InterestPreference {
  key: string;
  relationship: typeof RELATIONSHIPS[number];
  experience: typeof EXPERIENCE[number];
}
export interface Personalization {
  version: 1;
  resourceMode?: "legacy" | "explicit";
  answerStates?: Partial<Record<"motivations" | "interests" | "rhythm" | "durationMax" | "equipment" | "windows", "answered" | "removed">>;
  motivations: Motivation[];
  interests: InterestPreference[];
  rhythm: (typeof RHYTHMS[number])[];
  durationMax: number | null;
  /** Server confirmation time for this explicitly saved record; null for legacy/unsaved data. */
  confirmedAt: string | null;
}
export const emptyPersonalization = (): Personalization => ({ version: 1, motivations: [], interests: [], rhythm: [], durationMax: null, confirmedAt: null });
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const keyValid = (v: unknown): v is string => typeof v === "string" && v.length <= 120 && /^[a-z0-9-]+\/[a-z0-9-]+$/.test(v);
function choices<T extends string>(v: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(v) || v.length > allowed.length || v.some(x => !allowed.includes(x))) throw new Error("Check your preference choices.");
  return [...new Set(v)] as T[];
}
export function parsePersonalization(value: unknown): Personalization {
  if (!obj(value) || value.version !== 1 || Object.keys(value).some(k => !["version", "motivations", "interests", "rhythm", "durationMax", "confirmedAt", "answerStates", "resourceMode"].includes(k))) throw new Error("These preferences cannot be read. Reload before editing.");
  if (!Array.isArray(value.interests) || value.interests.length > 50) throw new Error("Choose up to 50 interests.");
  const interests: InterestPreference[] = value.interests.map(i => {
    if (!obj(i) || Object.keys(i).some(k => !["key", "relationship", "experience"].includes(k)) || !keyValid(i.key) || !RELATIONSHIPS.includes(i.relationship as never) || !EXPERIENCE.includes(i.experience as never)) throw new Error("Check your interests.");
    return { key: i.key, relationship: i.relationship as InterestPreference["relationship"], experience: i.experience as InterestPreference["experience"] };
  });
  if (new Set(interests.map(i => i.key)).size !== interests.length) throw new Error("Choose each interest once.");
  if (value.durationMax !== null && (typeof value.durationMax !== "number" || !Number.isInteger(value.durationMax) || value.durationMax < 5 || value.durationMax > 480)) throw new Error("Choose a duration from 5 to 480 minutes.");
  if (value.confirmedAt !== null && (typeof value.confirmedAt !== "string" || !Number.isFinite(Date.parse(value.confirmedAt)))) throw new Error("Check the confirmation time.");
  if (value.resourceMode !== undefined && !["legacy","explicit"].includes(value.resourceMode as string)) throw new Error("Check your resource choices.");
  if (value.answerStates !== undefined && (!obj(value.answerStates) || Object.entries(value.answerStates).some(([k,v]) => !["motivations","interests","rhythm","durationMax","equipment","windows"].includes(k) || !["answered","removed"].includes(v as string)))) throw new Error("Check your answer states.");
  return { ...(value.answerStates ? { answerStates:value.answerStates as Personalization["answerStates"] } : {}), ...(value.resourceMode ? {resourceMode:value.resourceMode as Personalization["resourceMode"]} : {}), version: 1, motivations: choices(value.motivations, MOTIVATIONS), interests, rhythm: choices(value.rhythm, RHYTHMS), durationMax: value.durationMax as number | null, confirmedAt: value.confirmedAt as string | null };
}
export const interestKey=(key:string)=>CORNER_ALIASES[key] ?? key;
export interface ProfileInput {
  legacyMotivations?:readonly string[];
  picks: readonly string[];
  windows: readonly string[];
  monthlyBudget: number | null;
  passes: readonly { kind?: string; label: string; place?: string | null }[];
}
/** One adapter for existing answers: legacy relationships and confirmation dates remain unknown. */
export function normalizePersonalization(profile: ProfileInput, saved: Personalization = emptyPersonalization(), equipment: readonly string[] = [], perActivityBudget: number | null = null) {
  const picks = [...new Set(profile.picks.filter(keyValid).map(interestKey))];
  const interests = picks.map(key => {
    const existing=saved.interests.find(i=>interestKey(i.key)===key);
    return existing ? {...existing,key} : {key,relationship:"unspecified" as const,experience:"unspecified" as const};
  });
  const legacyMotivations=(profile.legacyMotivations ?? []).flatMap(k=>({make:["make"],learn:["learn"],move:["move"],people:["company"],alone:["personal_time"],outside:["explore"],play:["explore"],haveIt:["explore"]} as Record<string,Motivation[]>)[k] ?? []);
  const motivations=saved.motivations.length || saved.answerStates?.motivations ? saved.motivations : [...new Set(legacyMotivations)];
  const passEquipment = (saved.resourceMode === "explicit" ? [] : profile.passes).flatMap(p => p.kind === "bike" ? ["bicycle"] : p.kind === "gear" && resourceId(p.label) !== "gear" ? [resourceId(p.label)] : []);
  return { ...saved, motivations, interests, usualWindows: [...new Set(profile.windows)], monthlyBudget: profile.monthlyBudget,
    // Monthly money is a planning amount. The original zero choice explicitly meant Free only.
    activityBudget: perActivityBudget, freeOnly: profile.monthlyBudget === 0 && perActivityBudget === null,
    equipment: [...new Set([...equipment, ...passEquipment].map(resourceId).filter(Boolean))] };
}
export function resourceId(value: string): string {
  const v = value.trim().toLowerCase().replace(/\s+/g, " ");
  return ({ bike: "bicycle", paints: "painting supplies", "paint set": "painting supplies", "yoga mats": "yoga mat" } as Record<string, string>)[v] ?? v;
}
export interface ResourceRequirements { required: string[][]; optional: string[]; alternatives?: string[][] }
export function requirementsFit(resources: ResourceRequirements, owned: readonly string[]): boolean {
  const set = new Set(owned.map(resourceId));
  return hasResources(resources.required, owned) && (!resources.alternatives?.length || resources.alternatives.some(bundle => bundle.every(r => set.has(resourceId(r)))));
}
/** Every required group must have one owned alternative. Optional resources never block. */
export function hasResources(required: readonly (readonly string[])[], owned: readonly string[]): boolean {
  const set = new Set(owned.map(resourceId));
  return required.every(group => group.length > 0 && group.some(item => set.has(resourceId(item))));
}
export function costFits(cost: number | null, ceiling: number | null): boolean {
  return ceiling === null || (cost !== null && Number.isFinite(cost) && cost >= 0 && cost <= ceiling);
}
/** Conservative total from a host's price text; do not treat "free supplies with a $20 class" as zero. */
export function priceMaximum(text: string | null | undefined): number | null {
  if (!text) return null;
  if (/\+|\$[\d,.]+\s*[-–]\s*\d|[€£¥]|\b(?:EUR|GBP|INR|CAD|AUD|NZD|HKD|from|starting|plus|fees extra)\b/i.test(text)) return null;
  const amounts = [...text.matchAll(/\$\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/g)].map(m => Number(m[1].replace(/,/g, "")));
  if (amounts.length>1 && !/\$[\d,.]+\s*(?:to|[-–])\s*\$[\d,.]+/i.test(text)) return null;
  if (amounts.length) return Math.max(...amounts);
  return /^\s*(?:free|no cost|0)\s*[.!]?\s*$/i.test(text) ? 0 : null;
}
export interface ActivityTraits {
  motivations?: readonly Motivation[];
  social?: "solo" | "together" | "either" | "unknown";
  durationMinutes?: number | null;
  beginner?: boolean | null;
}
/** Soft relevance only; unknown traits do not become a claim that an activity meets a hard requirement. */
export function preferenceScore(p: Personalization, traits: ActivityTraits, interestKey?: string): number {
  let score = p.motivations.filter(m => traits.motivations?.includes(m)).length * 3;
  const interest = p.interests.find(i => i.key === interestKey);
  if (interest) score += interest.relationship === "try" ? 3 : interest.relationship === "returning" ? 4 : 2;
  if (interest?.experience === "beginner" && traits.beginner === true) score += 3;
  if (p.durationMax !== null && traits.durationMinutes !== null && traits.durationMinutes !== undefined && traits.durationMinutes <= p.durationMax) score += 4;
  if (p.rhythm.includes("small") && traits.durationMinutes !== null && traits.durationMinutes !== undefined && traits.durationMinutes <= 20) score += 3;
  return score;
}
