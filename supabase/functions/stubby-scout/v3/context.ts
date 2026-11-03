import type { Answers } from "../intent.ts";
import { parseRequest, topicChoices, safeTopics } from "./request.ts";
import { passCapabilityKind } from "../../_shared/onboardingCapability.ts";
import { validTimeZone } from "../../_shared/capabilityProfile.ts";
import { cleanCity } from "../taste.ts";
import { V3_VERSION, type Context, type RequestInput } from "./types.ts";
/** Server clock wins. Timezone/city are explicit preferences, never guessed from a device IP. */
export function buildContext(input: RequestInput): Context {
  const { capability: c, profile: p, text, now } = input;
  if (!Number.isFinite(now)) throw new Error("Invalid clock");
  const remember = c.consent.memory;
  const onboard = remember && c.consent.onboarding;
  const timeZone = remember && validTimeZone(c.timeZone) ? c.timeZone : "America/New_York";
  const parsed = parseRequest(text, now, timeZone, input.answers, input.knownTopics);
  const intent = parsed.intent;
  const soft = remember ? c.perActivityBudget ?? (onboard && p.monthlyBudget !== null ? Math.floor(p.monthlyBudget / 4) : null) : null;
  const travel = /\b(?:within|under|max(?:imum)?)\s*(\d{1,3})\s*(?:minutes?|mins?)\b/i.exec(text);
  const window = parsed.window;
  if (input.notBefore !== undefined && Number.isFinite(input.notBefore)) window.startMs = Math.max(window.startMs, input.notBefore);
  const requestedTopics = parsed.topics.positive;
  const storedExclusions = remember ? c.preferences.flatMap(p => topicChoices(p).negative).filter(t => !requestedTopics.includes(t)) : [];
  const equipment = [...new Set([...(remember ? c.equipment : []), ...parsed.resources.add])].filter(x => !parsed.resources.remove.includes(x.toLowerCase()));
  return {
    version: V3_VERSION, now, timeZone, city: parsed.city === null ? null : cleanCity(parsed.city) ?? cleanCity(input.sessionCity) ?? (onboard ? cleanCity(p.city) : null),
    window,
    hardBudget: input.budgetOverride ?? (intent.budget?.from === "ask" ? intent.budget.max : null),
    softBudget: soft,
    setting: parsed.setting, awayFromHome: parsed.awayFromHome,
    excludedTopics: [...new Set([...parsed.topics.negative, ...storedExclusions])],
    issues: parsed.issues,
    travelMax: input.travelOverride ?? (travel ? Number(travel[1]) : null),
    adult21: input.adult21, adultsRequested: intent.adults, family: intent.who === "family",
    requestedTopics, topicCatalog: safeTopics(input.knownTopics ?? []), equipment, interests: onboard ? p.picks : [],
    goals: remember ? c.goals : [], preferences: remember ? c.preferences : [],
    learned: remember && c.consent.feedback ? input.learned : [],
    memberships: remember ? [...c.memberships, ...(onboard ? p.passes.filter(m => passCapabilityKind(m.kind ?? "other") !== "equipment").map(m => ({ name: m.place ? `${m.label} (${m.place})` : m.label, expiresOn: null, status: "self_reported" as const })) : [])].slice(0, 20) : [], usualWindows: onboard ? p.windows : [],
    busy: [], weather: "unknown",
  };
}

/** One parser for the chips, clarification and deterministic constraints. */
export function currentIntent(text: string, now: number, timeZone: string, answers: Answers | null, knownTopics: readonly string[] = []) {
  return parseRequest(text, now, timeZone, answers, knownTopics).intent;
}
