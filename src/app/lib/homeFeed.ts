import type { Post } from "../data/posts";

/** Where a card on Home comes from. Only "space" counts toward the promotion cap. */
export type FeedSource = "friend" | "space";

export interface FeedItem {
  post: Post;
  source: FeedSource;
}

/** About one card in four may be a Space promotion. */
export const SPACE_SHARE_DENOMINATOR = 4;

export interface FeedInputs {
  meId?: string;
  followingIds: readonly string[];
  /** Posts approved into a Space you are an active member of. */
  spacePostIds: ReadonlySet<number>;
  /** Corners you follow (Post.subHobby). */
  followedCorners: ReadonlySet<string>;
}

/**
 * A Moment from someone you follow is a friend card, even when it was shared
 * at a Space. Only Moments from people you do not follow, surfaced because of
 * a Space you are in or a Corner you follow, are Space promotions. Your own
 * Moments never show. Newest first.
 */
export function classifyFeed(posts: readonly Post[], inputs: FeedInputs): { friends: FeedItem[]; spaces: FeedItem[] } {
  const following = new Set(inputs.followingIds);
  const friends: FeedItem[] = [];
  const spaces: FeedItem[] = [];
  for (const post of [...posts].sort((a, b) => b.createdAt - a.createdAt)) {
    if (post.userId && post.userId === inputs.meId) continue;
    if (post.userId && following.has(post.userId)) {
      friends.push({ post, source: "friend" });
    } else if ((post.subHobby && inputs.followedCorners.has(post.subHobby)) || inputs.spacePostIds.has(post.id)) {
      spaces.push({ post, source: "space" });
    }
  }
  return { friends, spaces };
}

/**
 * Friends' cards in order, with one Space promotion after every third friend
 * card (positions 4, 8, 12 ...). That keeps promotions at or under a quarter
 * of the feed at every length. Promotions never fill a gap: with fewer than
 * three friend cards there are none, and spare promotions are dropped.
 */
export function interleaveFeed(friends: readonly FeedItem[], spaces: readonly FeedItem[]): FeedItem[] {
  const out: FeedItem[] = [];
  const gap = SPACE_SHARE_DENOMINATOR - 1;
  let next = 0;
  friends.forEach((item, i) => {
    out.push(item);
    if ((i + 1) % gap === 0 && next < spaces.length) out.push(spaces[next++]);
  });
  return out;
}

export function buildFeed(posts: readonly Post[], inputs: FeedInputs): FeedItem[] {
  const { friends, spaces } = classifyFeed(posts, inputs);
  return interleaveFeed(friends, spaces);
}
