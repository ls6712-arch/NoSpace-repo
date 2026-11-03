import { nyParts } from "../intent.ts";
import { isListingPage } from "../ask.ts";
import { matchesTopic, cityKey } from "./request.ts";
import { assessEvidence, isSoosh } from "./evidence.ts";
import type { Candidate, Context } from "./types.ts";
const HOUR = 3600000;
/**
 * A page that rounds many things up (a "best of" list, a newsletter, a paged index): never any one
 * thing's own page. Unlike isListingPage, it doesn't catch a place's own page: a park, a walking
 * route or a museum's visiting page is a place, its own kind (Nov 3, 2026).
 */
export function isRoundup(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.hostname.toLowerCase().endsWith("substack.com")) return true;
    const path = `${u.pathname}${u.search}`;
    return /\/(best|top)-[a-z0-9-]*(things|events|activities|ideas|places)/i.test(path) || /\/(roundup|round-up|lists?)\//i.test(path) || /[?&](page|paged)=\d+/i.test(path);
  } catch { return true; }
}
export function feasible(c: Candidate, ctx: Context): { ok: false; reason: string } | { ok: true; verified: boolean; warnings: string[] } {
  const no = (reason: string) => ({ ok: false as const, reason });
  if (ctx.issues.length) return no("unclear_request");
  const evidence = assessEvidence(c, ctx.now);
  if (!evidence) return no("missing_or_stale_evidence");
  const soosh = isSoosh(c);
  if (c.kind === "event" && c.evidence.some(e => isListingPage(e.url))) return no("listing_page");
  if (c.kind !== "event" && !soosh && c.evidence.some(e => isRoundup(e.url))) return no("listing_page");
  if (c.status === "cancelled" || c.availability === "sold_out") return no("unavailable");
  if (!Number.isFinite(c.startsAt) || c.startsAt < Math.max(ctx.now, ctx.window.startMs) || c.startsAt >= ctx.window.endMs) return no("time");
  if (c.endsAt !== null && (!Number.isFinite(c.endsAt) || c.endsAt <= c.startsAt || c.endsAt > ctx.window.endMs || c.endsAt - c.startsAt > 12 * HOUR)) return no("end_time");
  if (ctx.hardBudget !== null && (!c.cost || c.cost.currency !== "USD" || c.cost.max > ctx.hardBudget)) return no("budget");
  if (ctx.setting && c.setting !== ctx.setting && !(ctx.setting === "indoor" && c.setting === "home")) return no("setting");
  if (ctx.awayFromHome && c.setting === "home") return no("setting");
  if (c.setting !== "home" && (!ctx.city || !c.city || cityKey(c.city) !== cityKey(ctx.city))) return no("location");
  if (ctx.travelMax !== null && (c.travelMinutes === null || c.travelMinutes > ctx.travelMax)) return no("travel");
  if (c.travelMinutes !== null && c.startsAt < ctx.now + c.travelMinutes * 60000) return no("travel_time");
  if (c.minAge !== null && c.minAge >= 21 && !ctx.adultsRequested) return no("age");
  if (c.minAge !== null && c.minAge > 0 && (ctx.family || !ctx.adult21 || c.minAge > 21)) return no("age");
  if (matchesTopic(`${c.title} ${c.place ?? ""} ${c.tags.join(" ")}`, "bars and drinks") && (!ctx.adult21 || !ctx.adultsRequested || ctx.family)) return no("age");
  // Self-reported or expired memberships never establish eligibility.
  const activity = `${c.title} ${c.tags.join(" ")}`;
  if (ctx.excludedTopics.some(t => matchesTopic(activity, t))) return no("excluded_activity");
  if (ctx.topicsHard && ctx.requestedTopics.length && !ctx.requestedTopics.some(t => matchesTopic(activity, t))) return no("activity");
  if (c.membership !== null) return no("unverified_eligibility");
  const owns = new Set(ctx.equipment.map(x => x.toLowerCase()));
  if (c.equipment.some(x => !owns.has(x.toLowerCase()))) return no("equipment");
  if (ctx.busy.some(b => c.startsAt < b.endsAt && (c.endsAt ?? c.startsAt + HOUR) > b.startsAt)) return no("calendar_conflict");
  if (ctx.family && nyParts(c.startsAt, ctx.timeZone).hour >= 20) return no("family_time");
  if (c.setting === "outdoor" && ctx.weather === "unsafe") return no("weather");
  const warnings = [...evidence.warnings];
  // Their own Pursuit or Corner: nothing to check outside. What it needs is said instead.
  if (soosh) return { ok: true, verified: true, warnings };
  // Unknown age policy and end time are disclosed, never a drop (the legacy engine kept these, Nov 2).
  if (c.minAge === null) warnings.push("Age restrictions could not be checked.");
  if (c.setting === "outdoor" && ctx.weather === "unknown") warnings.push("Weather could not be checked.");
  if (c.setting !== "home" && c.travelMinutes === null) warnings.push("Travel time is unknown.");
  return { ok: true, verified: evidence.verified && warnings.length === 0, warnings };
}
