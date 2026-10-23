import type { CornerGuide } from "../../data/cornerGuides";

/**
 * What the ranking is allowed to read. Plain data: no React, no Supabase.
 * A Moment's author's follower count is deliberately not a field of
 * RankPost, and no function in this folder reads one.
 */
export interface RankPost {
  id: number;
  userId?: string;
  createdAt: number;
  visibility: "public" | "followers" | "space" | "just_me" | "private";
  type: "photo" | "video" | "written";
  /** True when the Moment carries a real photo or video. */
  hasMedia: boolean;
  hobbySlug: string;
  /** The Corner slug, or undefined for a Moment with no Corner. */
  corner?: string;
  caption: string;
  loveCount: number;
  inCount: number;
  /** Thoughts the viewer can count (their own Moments' are all of them; others' are 0). */
  thoughtCount: number;
}

export type InteractionKind = "love" | "thought" | "countMeIn" | "message" | "sharedPursuit" | "follow";

/** Something the viewer did toward an author. */
export interface Interaction {
  authorId: string;
  kind: InteractionKind;
  at: number;
}

/** Something the viewer did in a Corner (key `space/slug`). */
export interface CornerEvent {
  cornerKey: string;
  kind: "own" | "love" | "thought";
  at: number;
}

export interface Signals {
  viewerId: string | null;
  now: number;
  /** People the viewer follows (accepted), with the first name used in a reason line. */
  following: ReadonlyMap<string, { name: string }>;
  /** Blocked in either direction. */
  blockedIds: ReadonlySet<string>;
  interactions: readonly Interaction[];
  cornerEvents: readonly CornerEvent[];
  /** Keys the viewer follows: a Space slug, a Corner slug or `space/slug`. */
  hobbyFollowKeys: ReadonlySet<string>;
  /** The viewer's own Moments, newest first or any order. */
  ownMoments: readonly { cornerKey: string | null; createdAt: number }[];
  /** Moments the viewer has an open report on. */
  reportedMomentIds: ReadonlySet<number>;
  /** Tickets the viewer saved that haven't expired (`space/slug`). */
  savedTicketKeys: ReadonlySet<string>;
}

export interface TicketCandidate {
  spaceSlug: string;
  cornerSlug: string;
  /** The Corner's name. */
  label: string;
  guide: CornerGuide;
}

export type TicketReasonKind =
  | "friendDidIt"
  | "categoryAffinity"
  | "novelty"
  | "timeFit"
  | "libraryPrior"
  | "exploration";

export interface RankedTicket {
  card: TicketCandidate;
  value: number;
  reasonKind: TicketReasonKind;
  /** The sentence to show. */
  reason: string;
}

export const cornerKey = (spaceSlug: string, cornerSlug: string) => `${spaceSlug}/${cornerSlug}`;
