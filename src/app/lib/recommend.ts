import { supabase } from "../../lib/supabase";
import type { HomeCorner } from "../data/homeCorners";
import { cornerKey } from "../data/homeCorners";
import { similarity, traitsOf, type CornerTraits } from "./cornerSimilarity";

/**
 * What to show first on the Corners home, for one person. A small version of
 * how a streaming service picks and orders rows (docs/recommendations.md):
 *
 *   1. Signals: what the person did, from my_corner_affinity() in the database
 *      (their own Moments, private included, Pursuits, likes and saves,
 *      follows, Spaces joined, events they are going to; decayed with age),
 *      plus what people like them post and what is trending.
 *   2. A taste profile: the Corners they lean toward most.
 *   3. Candidate scoring for every Corner, a blend of: their own activity in
 *      that Corner and in its old Space, how much it resembles their taste
 *      profile (the guide library's traits, cornerSimilarity.ts), what people
 *      like them do, what is trending, and a small lift for curated Corners.
 *   4. Rows are ordered by how well their best Corners score, so a group they
 *      never touch sinks. Cards in a row are ordered by score, with a small
 *      penalty for being a near copy of one already placed (diversity), and a
 *      small daily shuffle (exploration) so the page is not frozen.
 *
 * With no signal at all (a new person, or the database function not applied
 * yet) there is no personal ranking and the page keeps its default order.
 * Nothing here is shown to anyone: no scores, counts or reasons.
 */
export interface AffinityRow {
  hobby_slug: string;
  corner: string;
  mine: number;
  peers: number;
  trending: number;
}

export interface Affinity {
  corners: Map<string, { mine: number; peers: number; trending: number }>;
  hobbies: Map<string, number>;
}

export const WEIGHTS = { mine: 0.3, hobby: 0.08, content: 0.3, peers: 0.14, trending: 0.1, curated: 0.03 };
/** How many of the person's strongest Corners make up the taste profile. */
export const PROFILE_SIZE = 6;
/** The size of the daily shuffle, against a score that spans about 0 to 1. */
export const EXPLORATION = 0.04;
/** Penalty per unit of similarity to a card already placed in the row. */
export const DIVERSITY = 0.2;
/** A row's relevance is the mean of its best this-many scores. */
export const ROW_TOP = 4;

export function toAffinity(rows: readonly AffinityRow[]): Affinity {
  const corners = new Map<string, { mine: number; peers: number; trending: number }>();
  const hobbies = new Map<string, number>();
  for (const r of rows) {
    if (r.corner === "") hobbies.set(r.hobby_slug, r.mine);
    else corners.set(`${r.hobby_slug}/${r.corner}`, { mine: r.mine, peers: r.peers, trending: r.trending });
  }
  return { corners, hobbies };
}

export async function fetchAffinity(): Promise<Affinity | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc("my_corner_affinity");
    if (error || !Array.isArray(data)) return null;
    return toAffinity(data as AffinityRow[]);
  } catch {
    return null;
  }
}

/** A cheap stable hash to [0, 1), for the daily shuffle. */
export function unit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

export interface Ranker {
  /** False when there is no personal signal: keep the default order. */
  personal: boolean;
  score: (c: HomeCorner) => number;
  /** Cards in best-first order with near copies spread apart. */
  order: (cards: readonly HomeCorner[]) => HomeCorner[];
  /** How well a set of Corners fits this person: the mean of its best ROW_TOP scores. */
  relevance: (cards: readonly HomeCorner[]) => number;
}

const NOT_PERSONAL: Ranker = {
  personal: false,
  score: () => 0,
  order: (cards) => [...cards],
  relevance: () => 0,
};

export function makeRanker(
  aff: Affinity | null,
  universe: readonly HomeCorner[],
  opts: { userId?: string; day?: string } = {},
): Ranker {
  if (!aff) return NOT_PERSONAL;
  const byKey = new Map(universe.map((c) => [cornerKey(c), c]));
  // Taste profile: the strongest corners, weighted by how strong.
  const profile: { traits: CornerTraits; w: number }[] = [...aff.corners]
    .filter(([, v]) => v.mine > 0.05)
    .sort((a, b) => b[1].mine - a[1].mine)
    .slice(0, PROFILE_SIZE)
    .flatMap(([k, v]) => {
      const c = byKey.get(k);
      return c ? [{ traits: traitsOf(c), w: v.mine }] : [];
    });
  const strongHobby = [...aff.hobbies.values()].some((v) => v > 0.05);
  if (profile.length === 0 && !strongHobby) return NOT_PERSONAL;

  const day = opts.day ?? new Date().toISOString().slice(0, 10);
  const weightSum = profile.reduce((s, p) => s + p.w, 0);
  const traitCache = new Map<string, CornerTraits>();
  const traits = (c: HomeCorner) => {
    const k = cornerKey(c);
    let t = traitCache.get(k);
    if (!t) traitCache.set(k, (t = traitsOf(c)));
    return t;
  };

  const score = (c: HomeCorner): number => {
    const k = cornerKey(c);
    const a = aff.corners.get(k);
    const content = weightSum > 0 ? Math.min(1, (profile.reduce((s, p) => s + p.w * similarity(p.traits, traits(c)), 0) / weightSum) * 1.5) : 0;
    const jitter = unit(`${opts.userId ?? ""}|${day}|${k}`) * EXPLORATION;
    return (
      WEIGHTS.mine * (a?.mine ?? 0) +
      WEIGHTS.hobby * (aff.hobbies.get(c.spaceSlug) ?? 0) +
      WEIGHTS.content * content +
      WEIGHTS.peers * (a?.peers ?? 0) +
      WEIGHTS.trending * (a?.trending ?? 0) +
      WEIGHTS.curated * (c.curated ? 1 : 0) +
      jitter
    );
  };

  const order = (cards: readonly HomeCorner[]): HomeCorner[] => {
    const left = cards.map((c) => ({ c, s: score(c) }));
    const out: HomeCorner[] = [];
    while (left.length > 0) {
      let best = 0;
      let bestV = -Infinity;
      for (let i = 0; i < left.length; i++) {
        const near = out.reduce((m, o) => Math.max(m, similarity(traits(o), traits(left[i].c))), 0);
        const v = left[i].s - DIVERSITY * near;
        if (v > bestV) {
          bestV = v;
          best = i;
        }
      }
      out.push(left.splice(best, 1)[0].c);
    }
    return out;
  };

  const relevance = (cards: readonly HomeCorner[]): number => {
    const top = cards.map(score).sort((a, b) => b - a).slice(0, ROW_TOP);
    return top.length ? top.reduce((s, x) => s + x, 0) / top.length : 0;
  };

  return { personal: true, score, order, relevance };
}

/** Rows best-fit first. Stable for equal relevance; a row listed in `pin` stays at the front. */
export function rankRows<T>(rows: readonly T[], relevanceOf: (row: T) => number, pinned: (row: T) => boolean = () => false): T[] {
  const idx = rows.map((r, i) => ({ r, i, v: relevanceOf(r), p: pinned(r) }));
  idx.sort((a, b) => Number(b.p) - Number(a.p) || (a.p ? a.i - b.i : b.v - a.v || a.i - b.i));
  return idx.map((x) => x.r);
}
