import { useMemo } from "react";
import { hobbies, subHobbyLabel } from "../data/hobbies";
import { circles } from "../data/circles";
import { products } from "../data/products";
import { deriveProjects } from "./journal";
import { useContent } from "../context/ContentContext";
import { useCorners, isDiscoverable } from "../context/CornersContext";
import { usePeopleSearch, profilePath } from "./people";

/**
 * One search, everywhere. Before this, Discover's search only matched Space
 * names, and the nav search only really surfaced products for anything that
 * wasn't an exact Space name or a creator's exact name (it did technically
 * loop over hobbies and creators too, but neither Corners, Circles, nor
 * Pursuits were ever in scope, so a query like "pottery" — a Corner, not a
 * Space — fell through to whatever products happened to match). This is the
 * one place that knows how to search all of it.
 */
export type SearchGroup =
  | "space"
  | "corner"
  | "circle"
  | "person"
  | "pursuit"
  | "moment"
  | "product";

export interface SearchHit {
  group: SearchGroup;
  key: string;
  label: string;
  sub: string;
  to: string;
  avatarUrl?: string;
}

/** Display order everywhere a grouped list is shown — products always last,
 * per the "never rank products above other content" requirement. */
export const SEARCH_GROUP_ORDER: { group: SearchGroup; title: string }[] = [
  { group: "space", title: "Spaces" },
  { group: "corner", title: "Corners" },
  { group: "circle", title: "Circles" },
  { group: "person", title: "People" },
  { group: "pursuit", title: "Pursuits" },
  { group: "moment", title: "Moments" },
  { group: "product", title: "Products" },
];

function norm(s: string) {
  return s.trim().toLowerCase();
}

function includesQ(haystack: string | undefined, q: string) {
  return !!haystack && haystack.toLowerCase().includes(q);
}

/** Whether a Space matches on its own text, or through one of its Corners —
 * used both by the unified index below and by Discover's "Explore Spaces"
 * tiles, so searching a Corner name (e.g. "pottery") still surfaces the
 * Space it lives in there too. */
export function hobbyMatchesQuery(
  hobby: { shortName: string; name: string; tagline: string; description: string },
  cornerNames: string[],
  q: string,
): boolean {
  if (!q) return true;
  return (
    includesQ(hobby.shortName, q) ||
    includesQ(hobby.name, q) ||
    includesQ(hobby.tagline, q) ||
    includesQ(hobby.description, q) ||
    cornerNames.some((name) => includesQ(name, q))
  );
}

/**
 * Everything except live people search (that part's async/debounced and
 * already has its own hook — see usePeopleSearch) and, notably, still
 * covers Spaces, Corners, Circles, Pursuits, Moments, and Products. Safe to
 * call on every keystroke: nothing here does network I/O.
 */
export function useUnifiedSearchIndex(query: string) {
  const { publicFeed } = useContent();
  const { cornersFor } = useCorners();

  const q = norm(query);

  const cornersByHobby = useMemo(() => {
    const map = new Map<string, ReturnType<typeof cornersFor>>();
    for (const hobby of hobbies) map.set(hobby.slug, cornersFor(hobby.slug).filter(isDiscoverable));
    return map;
  }, [cornersFor]);

  const pursuits = useMemo(() => deriveProjects(publicFeed, subHobbyLabel), [publicFeed]);

  return useMemo(() => {
    const groups: Record<SearchGroup, SearchHit[]> = {
      space: [],
      corner: [],
      circle: [],
      person: [],
      pursuit: [],
      moment: [],
      product: [],
    };
    if (!q) return groups;

    for (const hobby of hobbies) {
      if (includesQ(hobby.shortName, q) || includesQ(hobby.name, q) || includesQ(hobby.tagline, q) || includesQ(hobby.description, q)) {
        groups.space.push({
          group: "space",
          key: `space-${hobby.slug}`,
          label: hobby.shortName,
          sub: hobby.tagline,
          to: `/space/${hobby.slug}`,
        });
      }
    }

    for (const [hobbySlug, corners] of cornersByHobby) {
      const hobby = hobbies.find((h) => h.slug === hobbySlug);
      for (const corner of corners) {
        if (includesQ(corner.name, q)) {
          groups.corner.push({
            group: "corner",
            key: `corner-${hobbySlug}-${corner.slug}`,
            label: corner.name,
            sub: hobby ? `In ${hobby.shortName}` : "",
            to: `/space/${hobbySlug}?hobby=${corner.slug}`,
          });
        }
      }
    }

    for (const circle of circles) {
      if (
        includesQ(circle.name, q) ||
        includesQ(circle.description, q) ||
        includesQ(circle.purpose, q) ||
        includesQ(circle.location, q)
      ) {
        const hobby = hobbies.find((h) => h.slug === circle.hobbySlug);
        groups.circle.push({
          group: "circle",
          key: `circle-${circle.id}`,
          label: circle.name,
          sub: [hobby?.shortName, circle.location].filter(Boolean).join(" · "),
          // No per-Circle route exists yet — the browse page is the real
          // destination a result can land on today.
          to: "/circles",
        });
      }
    }

    for (const pursuit of pursuits) {
      const hobby = hobbies.find((h) => h.slug === pursuit.hobbySlug);
      if (
        includesQ(pursuit.title, q) ||
        includesQ(pursuit.creator, q) ||
        includesQ(hobby?.shortName, q) ||
        includesQ(hobby?.name, q)
      ) {
        groups.pursuit.push({
          group: "pursuit",
          key: `pursuit-${pursuit.key}`,
          label: pursuit.title,
          sub: `${pursuit.creator} · ${hobby?.shortName ?? ""}`,
          to: `/space/${pursuit.hobbySlug}${pursuit.subHobby ? `?hobby=${pursuit.subHobby}` : ""}`,
        });
      }
    }

    for (const post of publicFeed) {
      const hobby = hobbies.find((h) => h.slug === post.hobbySlug);
      const subLabel = post.subHobby ? subHobbyLabel(post.subHobby) : undefined;
      if (
        includesQ(post.caption, q) ||
        includesQ(post.creator, q) ||
        includesQ(post.interest, q) ||
        includesQ(subLabel, q)
      ) {
        groups.moment.push({
          group: "moment",
          key: `moment-${post.id}`,
          label: post.caption.length > 60 ? `${post.caption.slice(0, 60)}…` : post.caption,
          sub: `${post.creator} · ${hobby?.shortName ?? ""}`,
          // Moments don't have their own URL (MomentDetail opens as a
          // dialog from inside a feed) — the Space it lives in is the real
          // destination.
          to: `/space/${post.hobbySlug}`,
        });
      }
    }

    for (const product of products) {
      if (includesQ(product.name, q) || includesQ(product.description, q)) {
        const hobby = hobbies.find((h) => h.slug === product.hobbySlug);
        groups.product.push({
          group: "product",
          key: `product-${product.id}`,
          label: product.name,
          sub: `$${product.price.toFixed(0)} · ${hobby?.shortName ?? ""}`,
          to: `/product/${product.id}`,
        });
      }
    }

    return groups;
  }, [q, cornersByHobby, pursuits, publicFeed]);
}

/**
 * The one hook both search boxes use: the synchronous index above, plus the
 * existing debounced/async people search, merged into a single ordered list
 * (products always last) and grouped for anywhere that wants to show
 * "Spaces / Corners / Circles / ..." sections.
 */
export function useUnifiedSearch(query: string) {
  const indexGroups = useUnifiedSearchIndex(query);
  const { people, loading } = usePeopleSearch(query);

  const groups = useMemo<Record<SearchGroup, SearchHit[]>>(() => {
    const personHits: SearchHit[] = people.map((p) => ({
      group: "person" as const,
      key: `person-${p.id}`,
      label: p.displayName,
      sub:
        p.hobbyKeys
          .map((k) => hobbies.find((h) => h.slug === k)?.shortName)
          .filter(Boolean)
          .slice(0, 2)
          .join(" · ") || "On NoSpace",
      to: profilePath(p),
      avatarUrl: p.avatarUrl,
    }));
    return { ...indexGroups, person: personHits };
  }, [indexGroups, people]);

  const all = useMemo(
    () => SEARCH_GROUP_ORDER.flatMap(({ group }) => groups[group]),
    [groups],
  );

  return { groups, all, loading };
}
