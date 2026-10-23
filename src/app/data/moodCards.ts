import { hobbies } from "./hobbies";
import { quickGuides, type CornerGuide } from "./cornerGuides";
import { categoryOfCorner } from "./cornerCategories";
import { MOODS, cornersForMood, type MoodId } from "./moods";
import { spreadByKey } from "../lib/spreadByKey";

/**
 * The cards under "What are you in the mood for?" (spec v1.1). The first chip,
 * "15 minutes", is the old Got 15 minutes? row (quickGuides); every other chip
 * is a mood from moods.ts.
 *
 * A card shows its step in 3 lines without cutting it off, so only steps of
 * MAX_STEP characters or fewer are used (every chip still has at least 5).
 * Never two cards of the same category side by side, and at most MAX cards.
 */
export type MoodChipId = "quick" | MoodId;

export const MAX_CARDS = 10;
/** About what fits in 3 lines of the card (checked in the browser at 390 and 1440). */
export const MAX_STEP = 60;

export interface MoodCard {
  spaceSlug: string;
  cornerSlug: string;
  guide: CornerGuide;
  /** The Corner's name, as the old Space lists it. */
  label: string;
}

/** Every Corner behind a chip whose first step fits a card, unordered. The ranking orders them (lib/ranking). */
export function moodCandidates(id: MoodChipId): MoodCard[] {
  const source = id === "quick" ? quickGuides() : cornersForMood(id);
  return source
    .map((c) => {
      const hobby = hobbies.find((h) => h.slug === c.spaceSlug);
      const label = hobby?.subItems.find((s) => s.slug === c.cornerSlug)?.label;
      return hobby && !hobby.hidden && label && c.guide.step.length <= MAX_STEP ? { ...c, label } : null;
    })
    .filter((c): c is MoodCard => c !== null);
}

export function moodCards(id: MoodChipId): MoodCard[] {
  const cards = moodCandidates(id);
  // One card from each category in turn, so a chip full of one category (food, running)
  // still shows a mix; spreadByKey then fixes any repeat where two rounds meet.
  const keyOf = (c: MoodCard) => categoryOfCorner(c.spaceSlug, c.cornerSlug)?.slug ?? c.spaceSlug;
  const groups = new Map<string, MoodCard[]>();
  for (const c of cards) groups.set(keyOf(c), [...(groups.get(keyOf(c)) ?? []), c]);
  const rounds: MoodCard[] = [];
  for (let r = 0; rounds.length < cards.length; r++) {
    for (const g of groups.values()) if (g[r]) rounds.push(g[r]);
  }
  return spreadByKey(rounds, keyOf).slice(0, MAX_CARDS);
}

/** The chips, in order. Labels are in docs/glossary.md under "Moods". */
export const MOOD_CHIPS: { id: MoodChipId; label: string }[] = [
  { id: "quick", label: "15 minutes" },
  ...MOODS.map((m) => ({ id: m.id as MoodChipId, label: m.label })),
];
