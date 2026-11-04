import { lastingFeedback } from "../../_shared/feedback.ts";
import type { Answers } from "../intent.ts";
import { parseRequest, topicChoices, safeTopics } from "./request.ts";
import { emptyPersonalization, normalizePersonalization } from "../../_shared/personalization.ts";
import { passCapabilityKind } from "../../_shared/onboardingCapability.ts";
import { validTimeZone, type CapabilityProfile } from "../../_shared/capabilityProfile.ts";
import { cleanCity } from "../taste.ts";
import { V3_VERSION, type Context, type RequestInput } from "./types.ts";
/**
 * What V3 knows about the person for this ask (Nov 3, 2026): the onboarding answers (Corners, free
 * windows, budget, city, passes) and anything they saved in What Stubby knows are used by default, with
 * no opt-in. Learning from feedback is the only opt-in (consent.feedback). Server clock wins; timezone
 * and city are what they gave, never guessed from a device or address. With no city at all: New York,
 * where Soosh runs, said so in the trace (cityFrom "default").
 */
export function learnsFromFeedback(c: CapabilityProfile): boolean {
  return c.consent.feedback === true;
}
export function buildContext(input: RequestInput): Context {
  const { capability: c, profile: p, text, now } = input;
  if (!Number.isFinite(now)) throw new Error("Invalid clock");
  const timeZone = validTimeZone(c.timeZone) ? c.timeZone : "America/New_York";
  const parsed = parseRequest(text, now, timeZone, input.answers, input.knownTopics);
  const intent = parsed.intent;
  const normalized = normalizePersonalization(p, p.personalization ?? emptyPersonalization(), c.equipment, c.perActivityBudget);
  const soft = normalized.activityBudget;
  const travel = /\b(?:within|under|max(?:imum)?)\s*(\d{1,3})\s*(?:minutes?|mins?)\b/i.exec(text);
  const window = parsed.window;
  if (input.notBefore !== undefined && Number.isFinite(input.notBefore)) window.startMs = Math.max(window.startMs, input.notBefore);
  const requestedTopics = parsed.topics.positive;
  const storedExclusions = c.preferences.flatMap(p => topicChoices(p).negative).filter(t => !requestedTopics.includes(t));
  const equipment = [...new Set([...normalized.equipment, ...parsed.resources.add])].filter(x => !parsed.resources.remove.includes(x.toLowerCase()));
  const asked = parsed.city === null ? null : parsed.city ? cleanCity(parsed.city) : null;
  const session = cleanCity(input.sessionCity);
  const saved = cleanCity(p.city);
  const city = parsed.city === null ? null : asked ?? session ?? saved ?? "New York";
  const cityFrom: Context["cityFrom"] = parsed.city === null ? null : asked ? "ask" : session ? "session" : saved ? "profile" : "default";
  return {
    version: V3_VERSION, now, timeZone, city, cityFrom,
    ownedOnly: /\b(?:use what I (?:already )?have|only what I (?:already )?have|no new (?:gear|equipment))\b/i.test(text),
    durationMax: (() => { const m = /\b(?:I have|I[’']ve got|for)\s+(\d{1,3})\s*(?:minutes?|mins?)\b/i.exec(text); return m ? Number(m[1]) : null; })(),
    window,
    hardBudget: input.budgetOverride ?? (intent.budget?.from === "ask" ? intent.budget.max : normalized.activityBudget ?? (normalized.freeOnly ? 0 : null)),
    softBudget: soft,
    setting: parsed.setting, awayFromHome: parsed.awayFromHome,
    excludedTopics: [...new Set([...parsed.topics.negative, ...storedExclusions])],
    issues: parsed.issues,
    travelMax: input.travelOverride ?? (travel ? Number(travel[1]) : null),
    adult21: input.adult21, adultsRequested: intent.adults, family: intent.who === "family",
    requestedTopics, topicsHard: !/\bor (something|anything)\b/i.test(text), topicCatalog: safeTopics(input.knownTopics ?? []), equipment, interests: normalized.interests.map(i=>i.key),
    goals: c.goals, preferences: c.preferences,
    learned: learnsFromFeedback(c) ? lastingFeedback(input.learned) : [],
    memberships: [...c.memberships, ...p.passes.filter(m => passCapabilityKind(m.kind ?? "other") !== "equipment").map(m => ({ name: m.place ? `${m.label} (${m.place})` : m.label, expiresOn: null, status: "self_reported" as const }))].slice(0, 20),
    usualWindows: normalized.usualWindows, personalization: normalized,
    busy: [], weather: "unknown", gentle: input.gentle === true,
  };
}

/** One parser for the chips, clarification and deterministic constraints. */
export function currentIntent(text: string, now: number, timeZone: string, answers: Answers | null, knownTopics: readonly string[] = []) {
  return parseRequest(text, now, timeZone, answers, knownTopics).intent;
}
