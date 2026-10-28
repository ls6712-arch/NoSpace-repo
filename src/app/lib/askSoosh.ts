/** Ask Soosh (behind `askSooshEnabled`): which searches read like a sentence, and what was understood. */

export type AskChip = "This week" | "Up to 2 hr" | "With people";

const TRIGGERS = /\b(with|under|this weekend)\b/i;

/** A query that reads like a sentence: 5 or more words, or one of "with", "under", "this weekend". */
export function looksLikeAsk(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  return q.split(/\s+/).length >= 5 || TRIGGERS.test(q);
}

/** The filter chips a sentence implies. */
export function understoodChips(query: string): AskChip[] {
  const q = query.toLowerCase();
  const out: AskChip[] = [];
  if (/\bthis (week|weekend)\b|\btonight\b|\btomorrow\b/.test(q)) out.push("This week");
  if (/\b(under|less than|within)\s+(1|2|an|two|one)\s*(hours?|hrs?)\b|\bquick\b/.test(q)) out.push("Up to 2 hr");
  if (/\bwith (a )?(friends?|people|someone|others|my)\b|\btogether\b/.test(q)) out.push("With people");
  return out;
}

export interface AskPlan {
  title: string;
  line: string;
  to: string;
}

/** Three plans from fixtures: the first three Corners the search matched, each as a plan to do with people. */
export function askPlans(corners: readonly { name: string; line: string; to: string }[]): AskPlan[] {
  return corners.slice(0, 3).map((c) => ({ title: `${c.name} with people`, line: c.line, to: c.to }));
}
