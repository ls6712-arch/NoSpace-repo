import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "./AuthContext";
import { useContent } from "./ContentContext";
import { hobbies } from "../data/hobbies";

/**
 * Corners, created by tagging rather than suggest-and-approve (sql/corners.sql):
 * the moment someone tags a Moment with a Corner name that doesn't exist yet
 * in that Space, the Corner exists. No moderator, no queue.
 *
 * Each Space's original hand-picked Corners (hobbies.ts's subItems) stay in
 * code as a permanent baseline — the same split categories.ts already uses
 * for the fifteen Spaces themselves — and are merged in here with count 0
 * until someone actually tags into one. Everything past that baseline comes
 * from the corners table, or, signed out or unconfigured, is derived from
 * whatever's in the local/demo feed, so tagging still works before anyone
 * has an account.
 */
export interface Corner {
  spaceSlug: string;
  slug: string;
  name: string;
  momentCount: number;
  /** From hobbies.ts's original hand-picked list, not tagged into existence.
   * Curated Corners are signage — they show up regardless of momentCount,
   * the same way they already do today. See isDiscoverable for how this
   * interacts with brand-new, tagged Corners. */
  isCurated: boolean;
}

/**
 * Task 3's call: a brand-new, user-tagged Corner needs at least one public
 * Moment before it shows up on Discover, where anonymous visitors browse.
 * Reasoning: in normal use this costs nothing, since tagging a Moment is
 * what creates the Corner in the first place, so the tagger's own Moment is
 * already Corner #1 by the time anyone could see it. What the threshold
 * actually prevents is Discover filling up with hollow, zero-Moment tiles
 * from edge cases (a Corner created without ever getting its Moment
 * published, a private-only tag), which the brief explicitly flagged as the
 * failure mode to avoid. Curated Corners are exempt: they're editorial
 * signage, not activity, so they show regardless of momentCount, matching
 * how they already behave today.
 */
export function isDiscoverable(c: Corner) {
  return c.isCurated || c.momentCount > 0;
}

interface CornersContextType {
  /** Every Corner known for a Space: the curated baseline plus anything
   * real, sorted most-active first. */
  cornersFor: (spaceSlug: string) => Corner[];
  /** Fuzzy matches within a Space, for the tagging autocomplete — close
   * enough to catch "Pasta" -> "Pasta Making" in either direction. */
  matchesFor: (spaceSlug: string, query: string) => Corner[];
  /** Resolves a typed name to a Corner slug, creating the row if it's
   * genuinely new. Best-effort and local-first: a signed-out visitor or an
   * unmigrated table still gets a usable slug back, so tagging a Moment
   * never depends on this succeeding. */
  getOrCreateCorner: (spaceSlug: string, name: string) => Promise<{ slug: string; name: string }>;
  refresh: () => Promise<void>;
}

const CornersContext = createContext<CornersContextType | undefined>(undefined);

export function slugifyCorner(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const BASELINE: Corner[] = hobbies.flatMap((h) =>
  h.subItems.map((s) => ({ spaceSlug: h.slug, slug: s.slug, name: s.label, momentCount: 0, isCurated: true })),
);

export function CornersProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { publicFeed } = useContent();
  const [remote, setRemote] = useState<Corner[]>([]);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data } = await supabase
        .from("corners")
        .select("space_slug, slug, name, moment_count");
      setRemote(
        ((data ?? []) as any[]).map((r) => ({
          spaceSlug: r.space_slug,
          slug: r.slug,
          name: r.name,
          momentCount: r.moment_count ?? 0,
          isCurated: false,
        })),
      );
    } catch {
      // The curated baseline still works offline; this list is additive.
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Signed out, or Supabase isn't configured: derive real activity from
  // whatever's in the local/demo feed instead, so a fresh tag still shows
  // up immediately rather than only after an account exists.
  const derived: Corner[] = [];
  if (!supabase) {
    const counts = new Map<string, { spaceSlug: string; slug: string; count: number }>();
    for (const post of publicFeed) {
      if (!post.subHobby) continue;
      const key = `${post.hobbySlug}::${post.subHobby}`;
      const entry = counts.get(key) ?? { spaceSlug: post.hobbySlug, slug: post.subHobby, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
    for (const { spaceSlug, slug, count } of counts.values()) {
      // No local store for the canonical name a slug like this was tagged
      // with, so this title-cases the slug as a reasonable stand-in — the
      // real Supabase path always has the actual typed name instead.
      const name = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      derived.push({ spaceSlug, slug, name, momentCount: count, isCurated: false });
    }
  }

  const cornersFor = useCallback(
    (spaceSlug: string) => {
      const merged = new Map<string, Corner>();
      for (const c of BASELINE) if (c.spaceSlug === spaceSlug) merged.set(c.slug, c);
      for (const c of derived) if (c.spaceSlug === spaceSlug) {
        const existing = merged.get(c.slug);
        merged.set(c.slug, existing ? { ...existing, momentCount: c.momentCount } : c);
      }
      for (const c of remote) if (c.spaceSlug === spaceSlug) {
        const existing = merged.get(c.slug);
        merged.set(c.slug, existing ? { ...existing, momentCount: c.momentCount } : c);
      }
      return [...merged.values()].sort((a, b) => b.momentCount - a.momentCount);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [remote, publicFeed],
  );

  const matchesFor = useCallback(
    (spaceSlug: string, query: string) => {
      const q = query.trim().toLowerCase();
      if (!q) return cornersFor(spaceSlug).slice(0, 6);
      const qWords = q.split(/\s+/);
      return cornersFor(spaceSlug)
        .filter((c) => {
          const name = c.name.toLowerCase();
          if (name === q) return true;
          if (name.includes(q) || q.includes(name)) return true;
          const nameWords = name.split(/\s+/);
          return qWords.some((qw) => nameWords.some((nw) => nw.startsWith(qw) || qw.startsWith(nw)));
        })
        .slice(0, 6);
    },
    [cornersFor],
  );

  const getOrCreateCorner: CornersContextType["getOrCreateCorner"] = async (spaceSlug, rawName) => {
    const name = rawName.trim().slice(0, 60);
    const slug = slugifyCorner(name);

    if (supabase && user) {
      try {
        await supabase.from("corners").insert({ space_slug: spaceSlug, slug, name });
      } catch {
        // Best effort, same as mirrorPursuit: an unmigrated table or a
        // network hiccup still lets the Moment itself get tagged below.
      }
      await refresh();
    }

    return { slug, name };
  };

  return (
    <CornersContext.Provider value={{ cornersFor, matchesFor, getOrCreateCorner, refresh }}>
      {children}
    </CornersContext.Provider>
  );
}

export function useCorners() {
  const ctx = useContext(CornersContext);
  if (!ctx) throw new Error("useCorners must be used within CornersProvider");
  return ctx;
}
