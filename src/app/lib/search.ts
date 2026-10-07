import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { hobbies, subHobbyLabel } from "../data/hobbies";
import { products } from "../data/products";
import { deriveProjects } from "./journal";
import { pursuitCorner } from "./pursuitProgress";
import { useContent } from "../context/ContentContext";
import { useCorners, isDiscoverable } from "../context/CornersContext";
import { usePeopleSearch, profilePath } from "./people";
import { marketplaceEnabled } from "../config";
import { postCorner } from "../data/posts";
import type { SpaceRow } from "./spaces";

/**
 * One search, everywhere. Before this, Discover's search only matched Space
 * names, and the nav search only really surfaced products for anything that
 * wasn't an exact Space name or a creator's exact name (it did technically
 * loop over hobbies and creators too, but neither Corners nor Pursuits were
 * ever in scope, so a query like "pottery" — a Corner, not a Space — fell
 * through to whatever products happened to match). This is the one place
 * that knows how to search all of it.
 */
export type SearchGroup =
  | "space"
  | "corner"
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
 * covers Spaces, Corners, Pursuits, Moments, and Products. Safe to call on
 * every keystroke: nothing here does network I/O.
 */
export function useUnifiedSearchIndex(query: string) {
  const { publicFeed } = useContent();
  const { cornersFor } = useCorners();

  const q = norm(query);

  const cornersByHobby = useMemo(() => {
    const map = new Map<string, ReturnType<typeof cornersFor>>();
    for (const hobby of hobbies) {
      if (hobby.hidden) continue;
      map.set(hobby.slug, cornersFor(hobby.slug).filter(isDiscoverable));
    }
    return map;
  }, [cornersFor]);

  const pursuits = useMemo(() => deriveProjects(publicFeed, subHobbyLabel), [publicFeed]);

  return useMemo(() => {
    const groups: Record<SearchGroup, SearchHit[]> = {
      space: [],
      corner: [],
      person: [],
      pursuit: [],
      moment: [],
      product: [],
    };
    if (!q) return groups;

    for (const [hobbySlug, corners] of cornersByHobby) {
      for (const corner of corners) {
        if (includesQ(corner.name, q)) {
          groups.corner.push({
            group: "corner",
            key: `corner-${hobbySlug}-${corner.slug}`,
            label: corner.name,
            sub: "",
            to: `/corner/${corner.slug}`,
          });
        }
      }
    }

    for (const pursuit of pursuits) {
      if (includesQ(pursuit.title, q) || includesQ(pursuit.creator, q) || includesQ(pursuitCorner(pursuit), q)) {
        groups.pursuit.push({
          group: "pursuit",
          key: `pursuit-${pursuit.key}`,
          label: pursuit.title,
          sub: [pursuit.creator, pursuitCorner(pursuit)].filter(Boolean).join(" · "),
          to: pursuit.subHobby ? `/corner/${pursuit.subHobby}` : "/discover",
        });
      }
    }

    for (const post of publicFeed) {
      const cornerSlug = postCorner(post);
      const subLabel = cornerSlug ? subHobbyLabel(cornerSlug) ?? cornerSlug : undefined;
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
          sub: [post.creator, subLabel].filter(Boolean).join(" · "),
          to: `/moment/${post.id}`,
        });
      }
    }

    for (const product of marketplaceEnabled ? products : []) {
      if (includesQ(product.name, q) || includesQ(product.description, q)) {
        groups.product.push({
          group: "product",
          key: `product-${product.id}`,
          label: product.name,
          sub: `$${product.price.toFixed(0)}`,
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
 * "Spaces / Corners / ..." sections.
 */
/** Active Spaces, fetched once and filtered as you type. Spaces are the
 * host-created communities; Corners and hobby groups are never listed here. */
let spacesCache: SpaceRow[] | null = null;
function useSpacesSearch(query: string): SearchHit[] {
  const [spaces, setSpaces] = useState<SpaceRow[]>(spacesCache ?? []);
  const q = norm(query);
  useEffect(() => {
    if (!q || spacesCache || !supabase) return;
    let cancelled = false;
    supabase
      .from("spaces")
      .select("*")
      .eq("status", "active")
      .limit(100)
      .then(({ data }) => {
        if (cancelled || !data) return;
        spacesCache = data as SpaceRow[];
        setSpaces(spacesCache);
      });
    return () => {
      cancelled = true;
    };
  }, [q]);
  return useMemo(
    () =>
      !q
        ? []
        : spaces
            .filter((s) => includesQ(s.name, q) || includesQ(s.description, q))
            .map((s) => ({ group: "space" as const, key: `space-${s.id}`, label: s.name, sub: s.description, to: `/space/${s.slug}` })),
    [spaces, q],
  );
}

export function useUnifiedSearch(query: string) {
  const indexGroups = useUnifiedSearchIndex(query);
  const { people, loading } = usePeopleSearch(query);
  const spaceHits = useSpacesSearch(query);

  const groups = useMemo<Record<SearchGroup, SearchHit[]>>(() => {
    const personHits: SearchHit[] = people.map((p) => ({
      group: "person" as const,
      key: `person-${p.id}`,
      label: p.displayName,
      sub: "",
      to: profilePath(p),
      avatarUrl: p.avatarUrl,
    }));
    return { ...indexGroups, space: spaceHits, person: personHits };
  }, [indexGroups, people, spaceHits]);

  const all = useMemo(
    () => SEARCH_GROUP_ORDER.flatMap(({ group }) => groups[group]),
    [groups],
  );

  return { groups, all, loading };
}
