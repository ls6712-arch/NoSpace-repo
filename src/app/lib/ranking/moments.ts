import { DAY_MS, sigmoid } from "./math";
import { categoryOfCorner } from "../../data/cornerCategories";
import { freshness, hasPhoto, momentQuality, novelty } from "./features";
import { greedyRerank, momentFits } from "./diversity";
import { buildViewerModel, isColdStart, type ViewerModel } from "./model";
import { cornerKey, type RankPost, type Signals } from "./types";
import { DEFAULT_WEIGHTS, type Prediction, type RankingWeights } from "./weights";

/** The most candidates a Moments surface ranks. */
export const MAX_CANDIDATES = 300;

export interface RankedMoment {
  post: RankPost;
  value: number;
}

export interface MomentOptions {
  /** Only Moments newer than this many days. Omit for no window (All Moments). */
  windowDays?: number;
  /** Rank at most this many newest candidates. */
  candidateCap?: number;
}

/** Stage 2: the hard rules. Applied before any scoring. */
export function filterMoments(posts: readonly RankPost[], s: Signals, opts: MomentOptions = {}): RankPost[] {
  const cutoff = opts.windowDays === undefined ? -Infinity : s.now - opts.windowDays * DAY_MS;
  const kept = posts.filter((p) => {
    if (s.viewerId && p.userId === s.viewerId) return false; // the viewer's own
    if (p.userId && s.blockedIds.has(p.userId)) return false; // blocked either way
    if (s.reportedMomentIds.has(p.id)) return false; // an open report from the viewer
    if (p.createdAt < cutoff) return false;
    if (p.visibility === "public") return true;
    return p.visibility === "followers" && !!p.userId && s.following.has(p.userId);
  });
  kept.sort((a, b) => b.createdAt - a.createdAt);
  return kept.slice(0, opts.candidateCap ?? MAX_CANDIDATES);
}

function predict(pred: Prediction, f: Record<string, number>): number {
  let x = pred.b;
  for (const [name, w] of Object.entries(pred.w)) x += w * (f[name] ?? 0);
  return sigmoid(x);
}

/** Stage 3 and 4: the features, the four predictions, and the value. */
export function momentValue(post: RankPost, s: Signals, model: ViewerModel, w: RankingWeights): number {
  const key = post.corner !== undefined ? cornerKey(post.hobbySlug, post.corner) : undefined;
  const cat = key && post.corner !== undefined ? categoryOfCorner(post.hobbySlug, post.corner) : undefined;
  const f = {
    authorAffinity: model.author(post.userId),
    cornerAffinity: key ? model.corner(key) : 0,
    categoryAffinity: cat ? model.category(cat.slug) : 0,
    novelty: key ? novelty(s.ownMoments, key) : 0,
    freshness: freshness(post.createdAt, s.now),
    momentQuality: momentQuality(post),
    hasPhoto: hasPhoto(post),
  };
  const m = w.moments;
  return (
    m.value.countMeIn * predict(m.countMeIn, f) +
    m.value.thought * predict(m.thought, f) +
    m.value.love * predict(m.love, f) +
    m.value.open * predict(m.open, f)
  );
}

/**
 * Seen tonight and All Moments: filter, score, then re-rank so the top 4 come
 * from 4 different authors and no author is ever twice in a row. A viewer with
 * nothing to personalise from (cold start) gets the newest public Moments with
 * a photo, best first by their own smoothed reaction counts.
 */
export function rankMoments(
  posts: readonly RankPost[],
  s: Signals,
  w: RankingWeights = DEFAULT_WEIGHTS,
  opts: MomentOptions = {},
): RankedMoment[] {
  const candidates = filterMoments(posts, s, opts);
  let scored: RankedMoment[];
  if (isColdStart(s)) {
    scored = candidates
      .filter((p) => p.hasMedia)
      .map((post) => ({ post, value: momentQuality(post) }))
      .sort((a, b) => b.value - a.value || b.post.createdAt - a.post.createdAt);
  } else {
    const model = buildViewerModel(s, w);
    scored = candidates
      .map((post) => ({ post, value: momentValue(post, s, model, w) }))
      .sort((a, b) => b.value - a.value || b.post.createdAt - a.post.createdAt);
  }
  return greedyRerank(scored, momentFits((m: RankedMoment) => m.post.userId));
}

/** Seen tonight: 3 photos and 1 quote (the best-ranked text-only Moment). */
export function seenTonight(ranked: readonly RankedMoment[]): { photos: RankPost[]; quote: RankPost | null } {
  // The photos get the same author rule among themselves, so the collage never shows one person twice while others wait.
  const photos = greedyRerank(
    ranked.filter((m) => m.post.type === "photo" && m.post.hasMedia),
    momentFits((m: RankedMoment) => m.post.userId),
    3,
  ).map((m) => m.post);
  const quote = ranked.find((m) => !m.post.hasMedia && m.post.caption.trim().length > 0)?.post ?? null;
  return { photos, quote };
}
