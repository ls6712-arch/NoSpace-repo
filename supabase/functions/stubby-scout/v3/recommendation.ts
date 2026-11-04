import { preferenceScore } from "../../_shared/personalization.ts";
import { matchesTopic, topicChoices } from "./request.ts";
import { nyParts } from "../intent.ts";
import { feasible } from "./feasibility.ts";
import { isSoosh } from "./evidence.ts";
import { sameThing } from "../ask.ts";
import type { Candidate, Context, Recommendation } from "./types.ts";

export const DECK_SIZE = 3;
/** A pick this close to the best counts as a good alternative, so the deck may vary in kind (Nov 3, 2026). */
export const GOOD_ALTERNATIVE = 25;

/** What kind of pick this is, for a deck that isn't all one kind: their own Pursuit, a Corner at home, a place, an event or an idea. */
export function groupOf(c: Candidate): "pursuit" | "corner" | "place" | "event" | "idea" {
  if (isSoosh(c)) return c.evidence[0].url.startsWith("/pursuit/") ? "pursuit" : "corner";
  return c.kind;
}

const topicOf = (c: Candidate) => c.tags[0]?.toLowerCase() ?? c.kind;

/** Calm, low-key things, for gentle picks when someone is feeling low. Never a diagnosis. */
const GENTLE = /\b(walk|walking|stroll|park|garden|library|read|reading|book|museum|gallery|cook|cooking|bake|baking|tea|coffee|yoga|stretch|draw|drawing|paint|painting|knit|knitting|music|film|movie|home|pursuit|corner)\b/i;
const LOUD = /\b(party|parties|club|nightclub|rave|crowd|bar crawl|competition|race|marathon|bootcamp)\b/i;

function explain(c: Candidate, matches: number): string {
  if (isSoosh(c)) return groupOf(c) === "pursuit" ? "Time on your own Pursuit." : "One of your Corners, at home.";
  return matches ? "Fits your interests and the constraints checked for this ask." : "Fits the constraints checked for this ask.";
}

export function rankCandidates(candidates: Candidate[], ctx: Context, exclude: string[]) {
  const dropped: { id: string; reason: string }[] = [];
  const shown = new Set(exclude.map(sameThing));
  const seen = new Set<string>();
  const eligible: Recommendation[] = [];
  // Normalize onboarding's Corner slugs once; sources use ordinary activity words.
  const interestTopics = ctx.interests.map(i => {
    const label = (i.split("/").at(-1) ?? i).replace(/[-_]/g, " ");
    const topics = topicChoices(label, ctx.topicCatalog).positive;
    return topics.length ? topics : [label];
  });
  // Resolve duplicates after validity checks, preferring independent structured evidence.
  const ordered = [...candidates].sort((a, b) => Number(b.evidence.every(e => e.level === "provider")) - Number(a.evidence.every(e => e.level === "provider")));
  for (const c of ordered.slice(0, 300)) {
    const key = sameThing(c.title);
    if (shown.has(key) || seen.has(`${key}|${c.startsAt}`)) { dropped.push({ id: c.id, reason: "duplicate" }); continue; }
    const check = feasible(c, ctx);
    if (!check.ok) { dropped.push({ id: c.id, reason: check.reason }); continue; }
    seen.add(`${key}|${c.startsAt}`);
    const soosh = isSoosh(c);
    const tags = c.tags.join(" ").toLowerCase();
    const matches = interestTopics.filter(topics => topics.some(t => matchesTopic(tags, t))).length;
    const learned = ctx.learned.filter(s => sameThing(s.title) === key || topicChoices(s.title).positive.some(t => matchesTopic(`${c.title} ${tags}`, t)));
    // What they ask for now outranks past feedback. Feedback remains a soft signal.
    const explicit = ctx.requestedTopics.some(t => matchesTopic(`${c.title} ${tags}`, t));
    const affinity = explicit ? 0 : Math.max(-25, Math.min(15, learned.reduce((n, s) => n + (s.signal === "down" ? -15 : s.signal === "save" ? 8 : 6), 0)));
    const when = nyParts(c.startsAt, ctx.timeZone);
    const day = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][when.dow];
    const usual = ctx.usualWindows.includes(`${day}-${when.hour < 18 ? "day" : "eve"}`);
    const goalMatch = [...ctx.goals, ...ctx.preferences].some(x => topicChoices(x).positive.some(t => matchesTopic(tags, t)));
    // Soosh's own ideas are checked by definition, so they get a smaller bonus than a verified source:
    // otherwise every deck would be the person's own Pursuits.
    const quality = soosh ? 8 : check.verified ? 20 : 0;
    const gentle = ctx.gentle ? (GENTLE.test(`${c.title} ${tags} ${c.setting}`) ? 8 : 0) - (LOUD.test(`${c.title} ${tags}`) ? 20 : 0) : 0;
    const personal = c.traits ? preferenceScore(ctx.personalization,c.traits,ctx.personalization.interests.find(i => c.tags.some(t => matchesTopic(t,i.key.split("/").at(-1)!.replace(/-/g," "))))?.key) : 0;
    const rhythm = ctx.personalization.rhythm;
    const rhythmFit = (rhythm.includes("morning") && when.hour < 12) || (rhythm.includes("evening") && when.hour >= 18) || (rhythm.includes("weekend") && (when.dow === 0 || when.dow === 6));
    const score = 40 + personal + (rhythmFit ? 3 : 0) + (usual ? 4 : 0) + (goalMatch ? 3 : 0) + quality + Math.min(matches, 3) * 5
      + (explicit ? 6 : 0)
      + (ctx.softBudget !== null && c.cost && c.cost.max <= ctx.softBudget ? 10 : 0)
      + (c.equipment.length ? 5 : 0) + affinity + gentle
      + (learned.length === 0 ? 3 : 0);
    eligible.push({ candidate: c, verification: check.verified ? "verified" : "partial", uncertainties: check.warnings,
      explanation: explain(c, matches), score });
  }
  eligible.sort((a, b) => b.score - a.score || a.candidate.startsAt - b.candidate.startsAt || a.candidate.id.localeCompare(b.candidate.id));
  return { recommendations: assembleDeck(eligible), dropped };
}

/**
 * The deck (C9): the best first, then the best of a kind not yet in the deck while it is a good
 * alternative (within GOOD_ALTERNATIVE of the best), so a deck isn't all Pursuits, or all events,
 * when something else good exists. Then the next best of any kind, but never all one kind while a
 * good alternative is left over. Verified sources first: quality is never traded for variety.
 */
export function assembleDeck(eligible: Recommendation[], size = DECK_SIZE): Recommendation[] {
  if (eligible.length === 0) return [];
  const pool = [...eligible.filter(r => r.verification === "verified"), ...eligible.filter(r => r.verification !== "verified")];
  const best = Math.max(...pool.map(r => r.score));
  const good = (r: Recommendation) => r.score >= best - GOOD_ALTERNATIVE;
  const selected: Recommendation[] = [pool[0]];
  const groups = () => new Set(selected.map(r => groupOf(r.candidate)));
  while (selected.length < size) {
    const left = pool.filter(r => !selected.includes(r));
    if (left.length === 0) break;
    const used = groups();
    const fresh = left.find(r => !used.has(groupOf(r.candidate)) && good(r));
    if (fresh) { selected.push(fresh); continue; }
    // Then a topic not yet in the deck (three pottery classes is one idea three times).
    const topics = new Set(selected.map(r => topicOf(r.candidate)));
    const freshTopic = left.find(r => !topics.has(topicOf(r.candidate)) && good(r) && r.verification === left[0].verification);
    if (freshTopic) { selected.push(freshTopic); continue; }
    // Last place: if the deck would be all one kind, take a good one of another kind instead.
    const next = left[0];
    if (selected.length === size - 1 && used.size === 1 && used.has(groupOf(next.candidate))) {
      const other = left.find(r => !used.has(groupOf(r.candidate)) && good(r));
      if (other) { selected.push(other); continue; }
    }
    selected.push(next);
  }
  return selected;
}
