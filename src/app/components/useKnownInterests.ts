import { useMemo } from "react";
import { hobbies } from "../data/hobbies";
import { CATEGORIES } from "../data/categories";
import { useContent } from "../context/ContentContext";

/**
 * Everything anyone has already typed as a Moment's interest, plus the
 * app's own sub-hobby names and category examples as a starting vocabulary
 * so the list isn't empty on day one. Shared by every free-text "what's
 * this about" field (InterestField, the Explore modal's own-interest
 * field) so they all check "does this already exist?" against the exact
 * same vocabulary — see lib/tagMatching.ts, which is what actually decides
 * whether two labels are the same tag.
 */
export function useKnownInterests(): string[] {
  const { posts } = useContent();
  return useMemo(() => {
    const seen = new Map<string, string>();
    const add = (raw?: string) => {
      const label = raw?.trim();
      if (!label) return;
      const key = label.toLowerCase();
      if (!seen.has(key)) seen.set(key, label);
    };
    for (const post of posts) add(post.interest);
    for (const hobby of hobbies) for (const sub of hobby.subItems) add(sub.label);
    for (const c of CATEGORIES) for (const e of c.examples) add(e);
    return [...seen.values()];
  }, [posts]);
}
