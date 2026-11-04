/** Same catalog facts and soft preferences in the browser and Edge Function. */
import { CORNER_HOME } from "./cornerHome.ts";
import { preferenceScore, requirementsFit, type Motivation, type Personalization } from "./personalization.ts";
export function activityFor(key: string) {
  const resolved = CORNER_HOME[key] ? key : Object.keys(CORNER_HOME).find(k => k.split("/")[1] === key.split("/").at(-1));
  return resolved ? { key: resolved, ...CORNER_HOME[resolved] } : null;
}
export function activityScore(key: string, preferences: Personalization): number {
  const activity = activityFor(key);
  if (!activity) return 0;
  const f=activity.facts;
  return preferenceScore(preferences, { ...f, motivations: f.motivations as Motivation[], social: f.social as "solo"|"together"|"either" }, key);
}
export function activityCost(key: string, equipment: readonly string[]): number | null {
  const facts=activityFor(key)?.facts;
  return facts?.costMode === "free" || (facts?.costMode === "owned_resources" && requirementsFit(facts.resources,equipment)) ? 0 : null;
}
