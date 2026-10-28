import { cornerGuide } from "../data/cornerGuides";
import { categoryOfCorner } from "../data/cornerCategories";
import { cornerMoods, guideMoods } from "../data/curatedCorners";
import type { HomeCorner } from "../data/homeCorners";
import type { MoodId } from "../data/moods";

/**
 * How alike two Corners are, from facts about the activity itself (the guide
 * library's kind, whether it is solo or together, indoors or out, whether you
 * can start with what you have, its moods, and which of the 18 groups it is in), never from what people did.
 * 0 to 1. Used to score how much a Corner resembles the ones a person leans toward (recommend.ts).
 */
const WEIGHTS = { moods: 0.35, kind: 0.15, category: 0.25, together: 0.08, where: 0.07, haveIt: 0.03, setting: 0.03, time: 0.04 };

export interface CornerTraits {
  moods: ReadonlySet<MoodId>;
  kind?: string;
  category?: string;
  together?: string;
  where?: string;
  haveIt?: boolean;
  setting?: string;
  minutes?: number;
  adultsOnly: boolean;
}

export function traitsOf(c: HomeCorner): CornerTraits {
  const g = cornerGuide(c.spaceSlug, c.slug);
  const moods = c.curated ? cornerMoods(c.curated) : guideMoods(c.spaceSlug, c.slug);
  return {
    moods: new Set(moods),
    kind: g?.kind,
    category: categoryOfCorner(c.spaceSlug, c.slug)?.slug,
    together: g?.together,
    where: g?.where,
    haveIt: g?.haveIt,
    setting: c.curated?.setting,
    minutes: c.curated?.durationMinutes,
    adultsOnly: !!g?.adultsOnly,
  };
}

function jaccard(a: ReadonlySet<MoodId>, b: ReadonlySet<MoodId>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let both = 0;
  for (const x of a) if (b.has(x)) both++;
  return both / (a.size + b.size - both);
}

const same = <T,>(a: T | undefined, b: T | undefined) => (a !== undefined && a === b ? 1 : 0);

export function similarity(a: CornerTraits, b: CornerTraits): number {
  const time = a.minutes && b.minutes ? Math.min(a.minutes, b.minutes) / Math.max(a.minutes, b.minutes) : 0;
  return (
    WEIGHTS.moods * jaccard(a.moods, b.moods) +
    WEIGHTS.kind * same(a.kind, b.kind) +
    WEIGHTS.category * same(a.category, b.category) +
    WEIGHTS.together * same(a.together, b.together) +
    WEIGHTS.where * same(a.where, b.where) +
    WEIGHTS.haveIt * same(a.haveIt, b.haveIt) +
    WEIGHTS.setting * same(a.setting, b.setting) +
    WEIGHTS.time * time
  );
}
