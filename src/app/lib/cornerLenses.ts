import { MOODS, type MoodId } from "../data/moods";

/**
 * The extra rows on the Corners home, between the 18 groups: a different way
 * into the same Corners (this week, a mood, how long, where). Titles reuse
 * labels already in docs/glossary.md: the mood chips, "Up to 1 hour", "At
 * home", "Outdoors" and "Happening this week". Nothing here is ranked or
 * counted.
 */
export type LensId = "week" | `mood-${MoodId}` | "hour" | "home" | "outdoors";

export interface Lens {
  id: LensId;
  title: string;
}

const mood = (id: MoodId): Lens => ({ id: `mood-${id}`, title: MOODS.find((m) => m.id === id)!.label });

/** In the order they appear down the page. */
export const LENSES: readonly Lens[] = [
  { id: "week", title: "Happening this week" },
  mood("make"),
  { id: "hour", title: "Up to 1 hour" },
  mood("people"),
  mood("move"),
  { id: "home", title: "At home" },
  mood("learn"),
  mood("outside"),
  mood("alone"),
  { id: "outdoors", title: "Outdoors" },
  mood("play"),
  mood("haveIt"),
];

/** A lens row needs at least this many Corners, so a row is never a lonely one-card shelf. */
export const MIN_LENS_CORNERS = 3;
export const MAX_LENS_CORNERS = 20;

/** Every other lens row (the first, the third...) uses wide cards, so the page does not read as one repeated shape. */
export const isWideLens = (index: number) => index % 2 === 0;

/**
 * Weaves the lens rows in among the group rows: the first lens row leads, then
 * one more after every `every` group rows. Any left over once the groups run
 * out go on the end.
 */
export function interleaveRows<L, G>(lenses: readonly L[], groups: readonly G[], every = 2): (L | G)[] {
  const out: (L | G)[] = [];
  let l = 0;
  if (lenses.length > 0) out.push(lenses[l++]);
  groups.forEach((g, i) => {
    out.push(g);
    if ((i + 1) % every === 0 && l < lenses.length) out.push(lenses[l++]);
  });
  while (l < lenses.length) out.push(lenses[l++]);
  return out;
}
