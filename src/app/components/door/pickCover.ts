import type { Post } from "../../data/posts";
import { isInCorner } from "../../lib/cornerAlias";
import type { MoodCard } from "../../data/moodCards";

// Same test as hasRealMedia in MomentCard (kept here so this file stays free of React).
const hasPhoto = (p: Post) => p.type === "photo" && !!p.media && /^https?:\/\//.test(p.media);

/** The newest public photo Moment in the ticket's Corner from someone you follow, else any public one. */
export function pickCoverPhoto(posts: readonly Post[], card: MoodCard, followingIds: ReadonlySet<string>): Post | null {
  const here = posts
    .filter(
      (p) =>
        p.visibility === "public" &&
        hasPhoto(p) &&
        isInCorner(p, card.spaceSlug, card.cornerSlug),
    )
    .sort((a, b) => b.createdAt - a.createdAt);
  return here.find((p) => p.userId && followingIds.has(p.userId)) ?? here[0] ?? null;
}

/** The highest-ranked ticket whose Corner has a public photo Moment, with that photo. None have one: the top ticket, no photo. */
export function pickCover(
  tickets: readonly MoodCard[],
  posts: readonly Post[],
  followingIds: ReadonlySet<string>,
): { card: MoodCard; photo: Post | null } | null {
  for (const card of tickets) {
    const photo = pickCoverPhoto(posts, card, followingIds);
    if (photo) return { card, photo };
  }
  return tickets[0] ? { card: tickets[0], photo: null } : null;
}

