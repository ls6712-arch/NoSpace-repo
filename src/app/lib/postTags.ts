import { Post } from "../data/posts";

export interface TagTally {
  tag: string;
  count: number;
}

/**
 * Every open tag across a set of posts, most-used first — the Shelf's own
 * tag-pill row now reads from this instead of the fixed 15-Space list
 * (HobbyShelf.tsx's sessionsFromPosts, which stays exactly as it was for
 * the separate "By Corner" grid). Case-insensitive tally, first-seen casing
 * wins, same convention as useKnownTags/lib/tagMatching.
 */
export function tagsFromPosts(posts: Post[]): TagTally[] {
  const tally = new Map<string, TagTally>();
  for (const post of posts) {
    for (const raw of post.tags ?? []) {
      const label = raw.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      const existing = tally.get(key);
      if (existing) existing.count += 1;
      else tally.set(key, { tag: label, count: 1 });
    }
  }
  return [...tally.values()].sort((a, b) => b.count - a.count);
}
