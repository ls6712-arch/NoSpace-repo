import { useMemo } from "react";
import { hobbies } from "../data/hobbies";
import { CATEGORIES } from "../data/categories";
import { useContent } from "../context/ContentContext";

/**
 * Every tag anyone has already put on a Moment, plus the app's own sub-hobby
 * names and category examples as a starting vocabulary so the list isn't
 * empty on day one — same idea as useKnownInterests, extended to the open
 * `tags` array replacing the fixed Space picker in the composer (TagsField).
 * Sharing this vocabulary with useKnownInterests means "pottery" typed into
 * either field converges on the same canonical spelling.
 */
export function useKnownTags(): string[] {
  const { posts } = useContent();
  return useMemo(() => {
    const seen = new Map<string, string>();
    const add = (raw?: string) => {
      const label = raw?.trim();
      if (!label) return;
      const key = label.toLowerCase();
      if (!seen.has(key)) seen.set(key, label);
    };
    for (const post of posts) {
      add(post.interest);
      for (const t of post.tags ?? []) add(t);
    }
    for (const hobby of hobbies) {
      add(hobby.name);
      for (const sub of hobby.subItems) add(sub.label);
    }
    for (const c of CATEGORIES) for (const e of c.examples) add(e);
    return [...seen.values()];
  }, [posts]);
}
