import { matchesTopic, topicChoices } from "./request.ts";
import { nyParts } from "../intent.ts";
import { feasible } from "./feasibility.ts";
import { sameThing } from "../ask.ts";
import type { Candidate, Context, Recommendation } from "./types.ts";
export function rankCandidates(candidates: Candidate[], ctx: Context, exclude: string[]) {
  const dropped: { id: string; reason: string }[] = [];
  const shown = new Set(exclude.map(sameThing));
  const seen = new Set<string>();
  const eligible: Recommendation[] = [];
  // Resolve duplicates after validity checks, preferring independent structured evidence.
  const ordered = [...candidates].sort((a, b) => Number(b.evidence.every(e => e.level === "provider")) - Number(a.evidence.every(e => e.level === "provider")));
  for (const c of ordered.slice(0, 300)) {
    const key = sameThing(c.title);
    if (shown.has(key) || seen.has(`${key}|${c.startsAt}`)) { dropped.push({ id: c.id, reason: "duplicate" }); continue; }
    const check = feasible(c, ctx);
    if (!check.ok) { dropped.push({ id: c.id, reason: check.reason }); continue; }
    seen.add(`${key}|${c.startsAt}`);
    const tags = c.tags.join(" ").toLowerCase();
    const matches = ctx.interests.filter(i => tags.includes(i.split("/").at(-1) ?? i)).length;
    const learned = ctx.learned.filter(s => sameThing(s.title) === key || topicChoices(s.title).positive.some(t => matchesTopic(`${c.title} ${tags}`, t)));
    // What they ask for now outranks past feedback. Feedback remains a soft signal.
    const explicit = ctx.requestedTopics.some(t => matchesTopic(`${c.title} ${tags}`, t));
    const affinity = explicit ? 0 : Math.max(-25, Math.min(15, learned.reduce((n, s) => n + (s.signal === "down" ? -15 : s.signal === "save" ? 8 : 6), 0)));
    const when = nyParts(c.startsAt, ctx.timeZone);
    const day = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][when.dow];
    const usual = ctx.usualWindows.includes(`${day}-${when.hour < 17 ? "day" : "eve"}`);
    const goalMatch = [...ctx.goals, ...ctx.preferences].some(x => topicChoices(x).positive.some(t => matchesTopic(tags, t)));
    const score = 40 + (usual ? 4 : 0) + (goalMatch ? 3 : 0) + (check.verified ? 20 : 0) + Math.min(matches, 3) * 5
      + (ctx.softBudget !== null && c.cost && c.cost.max <= ctx.softBudget ? 10 : 0)
      + (c.equipment.length ? 5 : 0) + affinity
      + (learned.length === 0 ? 3 : 0);
    eligible.push({ candidate: c, verification: check.verified ? "verified" : "partial", uncertainties: check.warnings,
      explanation: matches ? "Fits your interests and the constraints checked for this ask." : "Fits the constraints checked for this ask.", score });
  }
  eligible.sort((a, b) => b.score - a.score || a.candidate.startsAt - b.candidate.startsAt || a.candidate.id.localeCompare(b.candidate.id));
  // Verification quality is never traded away for novelty.
  // First pass diversifies the leading topic; second pass fills remaining places.
  const selected: Recommendation[] = [];
  const topics = new Set<string>();
  for (const quality of ["verified", "partial"] as const) {
    const group = eligible.filter(r => r.verification === quality);
    for (const r of group) {
      const topic = r.candidate.tags[0]?.toLowerCase() ?? r.candidate.kind;
      if (topics.has(topic)) continue;
      if (selected.length === 3) break;
      topics.add(topic); selected.push(r);
    }
    for (const r of group) if (selected.length < 3 && !selected.includes(r)) selected.push(r);
  }
  return { recommendations: selected, dropped };
}
