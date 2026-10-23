import { postCorner, type Post } from "../../data/posts";
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
        p.hobbySlug === card.spaceSlug &&
        postCorner(p) === card.cornerSlug,
    )
    .sort((a, b) => b.createdAt - a.createdAt);
  return here.find((p) => p.userId && followingIds.has(p.userId)) ?? here[0] ?? null;
}

/** The highest-ranked ticket whose Corner has a public photo Moment, with that photo. None have one: the top ticket, no photo. */
export function pickCover<T extends { card: MoodCard }>(
  tickets: readonly T[],
  posts: readonly Post[],
  followingIds: ReadonlySet<string>,
): { ticket: T; photo: Post | null } | null {
  for (const ticket of tickets) {
    const photo = pickCoverPhoto(posts, ticket.card, followingIds);
    if (photo) return { ticket, photo };
  }
  return tickets[0] ? { ticket: tickets[0], photo: null } : null;
}
