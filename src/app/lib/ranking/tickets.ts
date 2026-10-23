import { hobbies } from "../../data/hobbies";
import { categoryOfCorner, cornersInCategory } from "../../data/cornerCategories";
import { DAY_MS, sigmoid } from "./math";
import { friendDidIt, libraryPrior, novelty, timeFit } from "./features";
import { buildViewerModel, isColdStart, type ViewerModel } from "./model";
import {
  cornerKey,
  type RankPost,
  type RankedTicket,
  type Signals,
  type TicketCandidate,
  type TicketReasonKind,
} from "./types";
import { DEFAULT_WEIGHTS, type Prediction, type RankingWeights } from "./weights";


/** The most tickets a row shows. */
export const MAX_TICKETS = 10;
/** A ticket for a Corner the viewer logged in this many days is not shown. */
const RECENT_LOG_DAYS = 14;
/** In the ticket row, slot 4 and every 5th after goes to a discovery ticket. */
const EXPLORE_FIRST = 3;
const EXPLORE_EVERY = 5;
const EXPLORE_MAX_AFFINITY = 0.2;

const firstName = (name: string) => (name.trim().split(/\s+/)[0] ?? "").slice(0, 60);

interface Scored {
  card: TicketCandidate;
  key: string;
  category: string;
  value: number;
  features: Record<string, number>;
  friendName?: string;
  fits?: "weeknight" | "weekend";
  /** The one feature that added most to the value, as a reason kind. */
  top: TicketReasonKind;
  affinity: number;
}

function predict(pred: Prediction, f: Record<string, number>): number {
  let x = pred.b;
  for (const [name, w] of Object.entries(pred.w)) x += w * (f[name] ?? 0);
  return sigmoid(x);
}

function ticketValue(f: Record<string, number>, w: RankingWeights): number {
  const take = predict(w.tickets.take, f);
  const doIt = predict(w.tickets.doIt, f);
  return w.tickets.value.both * take * doIt + w.tickets.value.take * take;
}

const REASON_FEATURES: Exclude<TicketReasonKind, "exploration">[] = [
  "friendDidIt",
  "categoryAffinity",
  "novelty",
  "timeFit",
  "libraryPrior",
];

/** The label of the viewer's strongest Corner in a category (for "Pairs with your ..."). */
function strongestCornerLabel(categorySlug: string, model: ViewerModel): string | undefined {
  let best: { key: string; v: number } | undefined;
  for (const c of cornersInCategory(categorySlug)) {
    const key = cornerKey(c.spaceSlug, c.cornerSlug);
    const v = model.corner(key);
    if (v > 0 && (!best || v > best.v)) best = { key, v };
  }
  if (!best) return undefined;
  const [space, corner] = best.key.split("/");
  return hobbies.find((h) => h.slug === space)?.subItems.find((s) => s.slug === corner)?.label;
}

function reasonText(t: Scored, kind: TicketReasonKind, model: ViewerModel): string {
  switch (kind) {
    case "friendDidIt":
      return `${t.friendName ?? "Someone you follow"} did this this week`;
    case "categoryAffinity": {
      const label = strongestCornerLabel(t.category, model);
      return label ? `Pairs with your ${label}` : "A good first step";
    }
    case "novelty":
      return "New to you";
    case "timeFit":
      return `Fits a ${t.fits ?? "weeknight"}`;
    case "exploration":
      return "Something new for you";
    default:
      return "A good first step";
  }
}

/**
 * The ticket row and the cover (brief §4): filter, score, then assemble the row
 * slot by slot: no two neighbours from one category, and the discovery slots
 * (4, 9, ...) go to the best ticket the viewer has never tried in a category
 * they haven't touched. Every ticket keeps the feature that added most to its
 * value and says so in one line.
 */
export function rankTickets(
  candidates: readonly TicketCandidate[],
  posts: readonly RankPost[],
  s: Signals,
  w: RankingWeights = DEFAULT_WEIGHTS,
  cap = MAX_TICKETS,
): RankedTicket[] {
  const model = buildViewerModel(s, w);
  const nowDate = new Date(s.now);
  const recentCutoff = s.now - RECENT_LOG_DAYS * DAY_MS;
  const recentlyLogged = new Set(s.ownMoments.filter((m) => m.cornerKey && m.createdAt >= recentCutoff).map((m) => m.cornerKey as string));

  const scored: Scored[] = [];
  for (const card of candidates) {
    if (card.guide.adultsOnly) continue;
    const key = cornerKey(card.spaceSlug, card.cornerSlug);
    if (recentlyLogged.has(key) || s.savedTicketKeys.has(key)) continue;
    const category = categoryOfCorner(card.spaceSlug, card.cornerSlug)?.slug ?? card.spaceSlug;
    const friend = friendDidIt(posts, s.following, key, s.now);
    const tf = timeFit(card.guide, nowDate);
    const features: Record<string, number> = {
      friendDidIt: friend.value,
      categoryAffinity: model.category(category),
      novelty: novelty(s.ownMoments, key),
      timeFit: tf.value,
      libraryPrior: libraryPrior(card.guide),
      cornerAffinity: model.corner(key),
      haveIt: card.guide.haveIt ? 1 : 0,
    };
    const value = ticketValue(features, w);
    // The single feature whose removal costs the most value.
    let top: TicketReasonKind = "libraryPrior";
    let topDelta = 0;
    for (const name of REASON_FEATURES) {
      const delta = value - ticketValue({ ...features, [name]: 0 }, w);
      if (delta > topDelta) {
        topDelta = delta;
        top = name;
      }
    }
    scored.push({
      card,
      key,
      category,
      value,
      features,
      friendName: friend.userId ? firstName(s.following.get(friend.userId)?.name ?? "") || undefined : undefined,
      fits: tf.fits,
      top,
      affinity: features.categoryAffinity,
    });
  }

  if (isColdStart(s)) {
    // Nothing to personalise from: by time fit, then the library's own order.
    scored.sort((a, b) => b.features.timeFit - a.features.timeFit || b.features.libraryPrior - a.features.libraryPrior);
    for (const t of scored) t.top = t.fits ? "timeFit" : "libraryPrior";
  } else {
    scored.sort((a, b) => b.value - a.value);
  }

  // Assemble the row.
  const pool = [...scored];
  const out: { t: Scored; kind: TicketReasonKind }[] = [];
  const sameAsLast = (t: Scored) => out.length > 0 && out[out.length - 1].t.category === t.category;
  while (pool.length > 0 && out.length < cap) {
    const slot = out.length;
    const discoverySlot = slot >= EXPLORE_FIRST && (slot - EXPLORE_FIRST) % EXPLORE_EVERY === 0;
    if (discoverySlot && !isColdStart(s)) {
      const i = pool.findIndex((t) => t.features.novelty === 1 && t.affinity < EXPLORE_MAX_AFFINITY && !sameAsLast(t));
      if (i >= 0) {
        out.push({ t: pool.splice(i, 1)[0], kind: "exploration" });
        continue;
      }
    }
    let i = pool.findIndex((t) => !sameAsLast(t));
    if (i < 0) i = 0;
    const t = pool.splice(i, 1)[0];
    out.push({ t, kind: t.top });
  }

  return out.map(({ t, kind }) => ({ card: t.card, value: t.value, reasonKind: kind, reason: reasonText(t, kind, model) }));
}

