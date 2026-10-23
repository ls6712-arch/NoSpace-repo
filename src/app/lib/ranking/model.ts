import { authorAffinity, categoryAffinity, cornerAffinity } from "./features";
import { DEFAULT_WEIGHTS, type RankingWeights } from "./weights";
import type { Signals } from "./types";

/** The viewer's affinities, computed on first use and remembered for one ranking pass. */
export interface ViewerModel {
  author(id: string | undefined): number;
  corner(key: string): number;
  category(slug: string): number;
}

export function buildViewerModel(s: Signals, weights: RankingWeights = DEFAULT_WEIGHTS): ViewerModel {
  const authors = new Map<string, number>();
  const corners = new Map<string, number>();
  const categories = new Map<string, number>();
  const model: ViewerModel = {
    author(id) {
      if (!id) return 0;
      let v = authors.get(id);
      if (v === undefined) authors.set(id, (v = authorAffinity(s.interactions, id, s.now, weights.interaction)));
      return v;
    },
    corner(key) {
      let v = corners.get(key);
      if (v === undefined) corners.set(key, (v = cornerAffinity(s.cornerEvents, s.hobbyFollowKeys, key, s.now)));
      return v;
    },
    category(slug) {
      let v = categories.get(slug);
      if (v === undefined) categories.set(slug, (v = categoryAffinity(slug, model.corner)));
      return v;
    },
  };
  return model;
}

/** Fewer than 3 Moments and nobody followed: there is nothing to personalise from yet. */
export const isColdStart = (s: Signals): boolean => s.ownMoments.length < 3 && s.following.size === 0;
