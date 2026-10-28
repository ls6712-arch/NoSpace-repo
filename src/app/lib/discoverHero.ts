import { moodCards, type MoodCard, type MoodChipId } from "../data/moodCards";
import type { MoodId } from "../data/moods";

/**
 * The Corners Discover's hero is picked from: each mood the person chose
 * contributes its cards in turn (first of each mood, then the second of each),
 * a Corner once however many moods it fits. With no moods chosen, the
 * fallback mood's cards stand in. The page then prefers one with an event.
 */
export function heroCandidates(moods: readonly MoodId[], fallback: MoodChipId, limit = 12): MoodCard[] {
  const lists = (moods.length > 0 ? [...moods] : [fallback]).map((m) => moodCards(m));
  const seen = new Set<string>();
  const out: MoodCard[] = [];
  for (let round = 0; out.length < limit; round++) {
    let any = false;
    for (const list of lists) {
      if (out.length >= limit) break;
      const card = list[round];
      if (!card) continue;
      any = true;
      const key = `${card.spaceSlug}/${card.cornerSlug}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(card);
    }
    if (!any) break;
  }
  return out;
}
