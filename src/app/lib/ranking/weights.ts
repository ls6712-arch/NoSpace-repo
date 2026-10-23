/**
 * Every number the ranking uses. Overridable at runtime from `app_config` key
 * `ranking_weights` (JSON, the same shape as DEFAULT_WEIGHTS, any subset), so
 * the weights can be tuned without a deploy. Door list brief §4.4.
 *
 * The weights reward DOING (a Moment logged, Count me in, joining) far above
 * passive taps. Nothing here is, or may become, time spent.
 */
export interface Prediction {
  /** The bias, before any feature. */
  b: number;
  /** Weight per feature name. */
  w: Record<string, number>;
}

export interface RankingWeights {
  moments: {
    love: Prediction;
    thought: Prediction;
    countMeIn: Prediction;
    open: Prediction;
    /** value = sum of weight * prediction. */
    value: { countMeIn: number; thought: number; love: number; open: number };
  };
  tickets: {
    take: Prediction;
    doIt: Prediction;
    /** value = both * P_take * P_doIt + take * P_take. */
    value: { both: number; take: number };
  };
  rooms: { followedLogged: number; categoryAffinity: number; anyPublic: number; newCorner: number };
  /** What each kind of interaction toward an author is worth (brief §4.3). */
  interaction: { love: number; thought: number; countMeIn: number; message: number; sharedPursuit: number; follow: number };
}

export const DEFAULT_WEIGHTS: RankingWeights = {
  moments: {
    love: { b: -2.0, w: { authorAffinity: 2.5, cornerAffinity: 1.5, freshness: 1.0, momentQuality: 1.0, hasPhoto: 0.5 } },
    thought: { b: -3.0, w: { authorAffinity: 3.0, cornerAffinity: 1.0, freshness: 0.8 } },
    countMeIn: { b: -3.5, w: { cornerAffinity: 2.0, categoryAffinity: 1.0, novelty: 1.0, authorAffinity: 1.0 } },
    open: { b: -1.0, w: { hasPhoto: 1.0, freshness: 1.0, authorAffinity: 1.0 } },
    value: { countMeIn: 6, thought: 4, love: 1, open: 0.5 },
  },
  tickets: {
    take: { b: -1.5, w: { friendDidIt: 2.0, categoryAffinity: 1.5, novelty: 0.8, timeFit: 1.0, libraryPrior: 0.5 } },
    doIt: { b: -2.0, w: { friendDidIt: 1.5, timeFit: 1.5, cornerAffinity: 0.5, haveIt: 1.0 } },
    value: { both: 10, take: 1 },
  },
  rooms: { followedLogged: 3, categoryAffinity: 2, anyPublic: 1, newCorner: 0.5 },
  interaction: { love: 1, thought: 3, countMeIn: 4, message: 2, sharedPursuit: 5, follow: 2 },
};

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

function mergeInto<T>(base: T, override: unknown): T {
  if (!isObj(base) || !isObj(override)) return base;
  const out: Json = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (!(k in base)) continue; // unknown keys are ignored, never trusted
    const b = (base as Json)[k];
    if (typeof b === "number") {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    } else if (isObj(b)) {
      out[k] = mergeInto(b, v);
    }
  }
  return out as T;
}

/** DEFAULT_WEIGHTS with any numeric overrides applied. Anything that isn't a known number is ignored. */
export function mergeWeights(override: unknown): RankingWeights {
  const merged = mergeInto(DEFAULT_WEIGHTS, override);
  return merged;
}
