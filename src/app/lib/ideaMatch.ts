import { isBrowsableCorner } from "../data/hobbies";
import { CORNER_IDEAS, type CornerIdea, type IdeaSpend, type IdeaTime, type IdeaWho } from "../data/cornerIdeas";

/**
 * Which ideas fit the three Discover pills. Pure and local: changing a pill reshuffles
 * the row with no network call. Time and Spend are ceilings (see cornerIdeas.ts), Who is
 * an exact pill.
 */

export interface IdeaPills {
  time: IdeaTime;
  spend: IdeaSpend;
  who: IdeaWho;
}

export const TIME_ORDER: readonly IdeaTime[] = ["hour", "tonight", "weekend"];
export const SPEND_ORDER: readonly IdeaSpend[] = ["free", "under25", "treat"];

export interface MatchedIdea {
  /** "space-slug/corner-slug". */
  key: string;
  idea: CornerIdea;
}

export function fitsPills(idea: CornerIdea, pills: IdeaPills): boolean {
  return (
    TIME_ORDER.indexOf(idea.time) <= TIME_ORDER.indexOf(pills.time) &&
    SPEND_ORDER.indexOf(idea.spend) <= SPEND_ORDER.indexOf(pills.spend) &&
    idea.who.includes(pills.who)
  );
}

/**
 * The ideas that fit, the person's picks first, then by Corner affinity (0 to 1, higher
 * first), then by key so the order is steady. Adults-only ideas and Corners hidden from
 * browsing never appear. The row never holds more than `MAX_PER_CATEGORY` ideas from one
 * internal category (the old group in front of the slash in the key, never shown).
 */
export const MAX_PER_CATEGORY = 2;
export const ROW_SIZE = 6;

export function ideasFor(
  pills: IdeaPills,
  opts: { picks?: readonly string[]; affinity?: ReadonlyMap<string, number>; limit?: number } = {},
): MatchedIdea[] {
  const picks = new Set(opts.picks ?? []);
  const affinity = opts.affinity ?? new Map<string, number>();
  const matched = Object.entries(CORNER_IDEAS)
    .filter(([key, idea]) => {
      if (idea.adultsOnly) return false;
      const [space, corner] = key.split("/");
      return isBrowsableCorner(space, corner) && fitsPills(idea, pills);
    })
    .map(([key, idea]) => ({ key, idea }));
  matched.sort(
    (a, b) =>
      Number(picks.has(b.key)) - Number(picks.has(a.key)) ||
      (affinity.get(b.key) ?? 0) - (affinity.get(a.key) ?? 0) ||
      a.key.localeCompare(b.key),
  );
  const limit = opts.limit ?? ROW_SIZE;
  const perCategory = new Map<string, number>();
  const row: MatchedIdea[] = [];
  for (const m of matched) {
    if (row.length >= limit) break;
    const category = m.key.split("/")[0];
    const taken = perCategory.get(category) ?? 0;
    if (taken >= MAX_PER_CATEGORY) continue;
    perCategory.set(category, taken + 1);
    row.push(m);
  }
  return row;
}
