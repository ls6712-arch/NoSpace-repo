import { cornerGuide } from "../data/cornerGuides";
import { cornerMoods, guideMoods } from "../data/curatedCorners";
import type { HomeCorner } from "../data/homeCorners";
import type { MoodId } from "../data/moods";

/**
 * How alike two Corners are, from facts about the activity itself (the guide
 * library's kind, whether it is solo or together, indoors or out, whether you
 * can start with what you have, and its moods), never from what people did.
 * 0 to 1. Used to fill a short row with Corners from elsewhere that someone
 * who likes the row would plausibly like too, so every row is full.
 */
const WEIGHTS = { moods: 0.45, kind: 0.2, together: 0.1, where: 0.1, haveIt: 0.05, setting: 0.05, time: 0.05 };

export interface CornerTraits {
  moods: ReadonlySet<MoodId>;
  kind?: string;
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
    WEIGHTS.together * same(a.together, b.together) +
    WEIGHTS.where * same(a.where, b.where) +
    WEIGHTS.haveIt * same(a.haveIt, b.haveIt) +
    WEIGHTS.setting * same(a.setting, b.setting) +
    WEIGHTS.time * time
  );
}

/** A row on the Corners home shows at least this many cards when there are enough Corners to fill it. Wide enough to run past the edge of a 1264px page. */
export const MIN_ROW_CARDS = 8;

const keyOf = (c: HomeCorner) => `${c.spaceSlug}/${c.slug}`;

/**
 * Pads `own` up to `min` cards with the Corners from `universe` that are most
 * like it (mean similarity to the row's own Corners). The row's own Corners
 * stay first and in order; fillers follow, best match first, ties curated
 * first then A to Z. Corners that are for adults only are never used as
 * fillers. A row that is already long enough is returned as it is.
 */
export function fillRow(own: readonly HomeCorner[], universe: readonly HomeCorner[], min = MIN_ROW_CARDS): HomeCorner[] {
  if (own.length >= min || own.length === 0) return [...own];
  const have = new Set(own.map(keyOf));
  const ownTraits = own.map(traitsOf);
  const scored = universe
    .filter((c) => !have.has(keyOf(c)))
    .map((c) => ({ c, t: traitsOf(c) }))
    .filter((x) => !x.t.adultsOnly)
    .map(({ c, t }) => ({ c, s: ownTraits.reduce((sum, o) => sum + similarity(o, t), 0) / ownTraits.length }))
    .sort((a, b) => b.s - a.s || Number(!!b.c.curated) - Number(!!a.c.curated) || a.c.name.localeCompare(b.c.name));
  return [...own, ...scored.slice(0, min - own.length).map((x) => x.c)];
}
