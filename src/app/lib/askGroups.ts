import { nyParts } from "./homeWeek";
import type { MyPick } from "./stubbyAsk";

/** The New York day of a moment, as a comparable key. */
const nyDay = (ms: number) => {
  const p = nyParts(ms);
  return `${p.y}-${p.m}-${p.d}`;
};

/** The latest ask among today's picks, or null. What shows as "this ask" when the page opens. */
export function latestAskToday(picks: readonly MyPick[], now: number): number | null {
  const today = nyDay(now);
  let latest: number | null = null;
  for (const p of picks) if (p.askId !== null && p.createdAt !== null && nyDay(p.createdAt) === today && (latest === null || p.askId > latest)) latest = p.askId;
  return latest;
}

/**
 * Stubby plan §7: only this ask's picks are shown; the rest of today's go under "Earlier today".
 * Picks saved before today aren't shown here. With no ask of today, everything of today is
 * "earlier". Order is kept (latest ask first, best fit first).
 */
export function groupPicks(picks: readonly MyPick[], currentAskId: number | null, now: number): { current: MyPick[]; earlier: MyPick[] } {
  const today = nyDay(now);
  const current: MyPick[] = [];
  const earlier: MyPick[] = [];
  for (const p of picks) {
    if (currentAskId !== null && p.askId === currentAskId) current.push(p);
    else if (p.createdAt !== null && nyDay(p.createdAt) === today) earlier.push(p);
  }
  return { current, earlier };
}
