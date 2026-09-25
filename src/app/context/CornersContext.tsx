import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "./AuthContext";
import { useContent } from "./ContentContext";
import { hobbies, titleCaseSlug } from "../data/hobbies";
import { postCorner } from "../data/posts";
import { bestMatch } from "../lib/tagMatching";
import { guessSpace } from "../lib/pursuitProgress";
import { isBlocklistedName } from "../lib/blocklist";

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
  /** Lifetime count (sql/corners.sql's trigger-maintained moment_count) —
   * used for autocomplete ranking and the tagging/Create-Space pickers.
   * Discover itself uses momentCount30d instead; see isBrowsableOnDiscover. */
  momentCount: number;
  /** Public Moments in the last 30 days, computed at query time
   * (public.corner_activity_30d(), 20260924099000) rather than trigger-
   * maintained — 0 for anything the RPC hasn't returned a row for, which
   * is the correct value (no recent activity), not "unknown". */
  momentCount30d: number;
  /** Whether at least one active new-model Space (spaces/space_corners,
   * 20260924110000) lists this Corner. Always false until Phase 5 ships
   * Create Space — there's nothing to link yet. */
  hasActiveSpace: boolean;
  /** Admin-hidden (sql/corners.sql's `hidden` column, 20260924099000).
   * Filtered out of every browse/autocomplete surface here; a Moment that
   * already carries this Corner's slug still resolves and displays fine —
   * hiding never breaks an existing link, same rule as hiding a Category. */
  hidden: boolean;
  /** From hobbies.ts's original hand-picked list, not tagged into existence.
   * Curated Corners are signage for the tagging/Create-Space autocomplete —
   * they suggest regardless of momentCount there — but on Discover itself
   * they're just another Corner: no bypass, see isBrowsableOnDiscover. */
  isCurated: boolean;
  /** Short, optional — only ever set by whoever created the Corner
   * deliberately (via "Create a Corner" on the Space page), never by
   * tagging-into-existence, which only ever has a name to go on. */
  description?: string;
  /** When this Corner's row was actually created in Supabase (sql/corners.sql's
   * created_at) — only ever set for a real remote row. Never fabricated for
   * the curated baseline (which wasn't "created" at any point in time) or a
   * signed-out/local one (no real clock to read), so newestCorners() below
   * only ever surfaces Corners this field is honestly set for. */
  createdAt?: number;
}

/**
 * Suggestable in the tagging/Create-Space autocomplete: curated Corners
 * always suggest (editorial signage), a tagged-into-existence one needs at
 * least one Moment ever. Hidden Corners never suggest. This is deliberately
 * lenient — it's picking from a list you're about to tag, not deciding
 * what an anonymous visitor sees on Discover; see isBrowsableOnDiscover for
 * that, stricter rule.
 */
export function isDiscoverable(c: Corner) {
  return !c.hidden && (c.isCurated || c.momentCount > 0);
}

/**
 * hobby_follows.hobby_key for a Corner-level follow. corners.slug is only
 * unique within one Category (sql/corners.sql: `unique (space_slug, slug)`
 * — two different Categories can each have a Corner slugged "beginners"),
 * so a bare slug is ambiguous there and can't be used as this key on its
 * own. Composite, same "kind:value" shape social.sql's own whole-Category
 * key already uses ("space:<slug>") — a Category slug is never literally
 * "space", so the two forms never collide. Every writer and reader of a
 * Corner-level follow (Onboarding's resolveInterest calls, BePart.tsx,
 * admin_merge_corners) must go through this, not build the string by hand.
 */
export function cornerFollowKey(spaceSlug: string, slug: string): string {
  return `${spaceSlug}:${slug}`;
}

/**
 * Discover's own rule (Spec change: "Corners carry discovery" — no empty
 * Corner is ever shown, curated or not): at least `threshold` public
 * Moments in the last 30 days, or at least one active Space. Nothing is
 * exempt — a curated Corner with no recent activity simply doesn't show,
 * the same as any other quiet one. `threshold` comes from app_config's
 * corner_min_moments_30d (see useCornerThreshold below); callers that don't
 * have it yet can pass the same default (3) that table seeds.
 */
export function isBrowsableOnDiscover(c: Corner, threshold: number) {
  return !c.hidden && (c.momentCount30d >= threshold || c.hasActiveSpace);
}

/** Autocomplete matching shared by matchesFor (one Category) and
 * CornerTagField's global mode (every Category) — exact, substring
 * either direction, or a shared word prefix ("Pasta" -> "Pasta Making"). */
export function matchCorners(corners: Corner[], query: string): Corner[] {
  const q = query.trim().toLowerCase();
  if (!q) return corners.slice(0, 6);
  const qWords = q.split(/\s+/);
  return corners
    .filter((c) => {
      const name = c.name.toLowerCase();
      if (name === q) return true;
      if (name.includes(q) || q.includes(name)) return true;
      const nameWords = name.split(/\s+/);
      return qWords.some((qw) => nameWords.some((nw) => nw.startsWith(qw) || qw.startsWith(nw)));
    })
    .slice(0, 6);
}

interface CornersContextType {
  /** Every Corner known for a Space: the curated baseline plus anything
   * real, sorted most-active first. */
  cornersFor: (spaceSlug: string) => Corner[];
  /** Every Corner across every non-hidden Category, flat — for
   * CornerTagField's "no Category chosen yet" mode and anywhere else that
   * needs to search across all of them at once. */
  allCorners: Corner[];
  /** Fuzzy matches within a Space, for the tagging autocomplete — close
   * enough to catch "Pasta" -> "Pasta Making" in either direction. */
  matchesFor: (spaceSlug: string, query: string) => Corner[];
  /** True when a name would be rejected by the trademark-blocklist CHECK
   * constraint (corners.name, spaces.name) — checked client-side first
   * against app_config's trademark_blocklist so a caller can show a
   * friendly message before attempting the write; the constraint itself
   * is what actually enforces this. */
  isNameBlocked: (name: string) => boolean;
  /** Resolves a typed name to a Corner slug, creating the row if it's
   * genuinely new. Best-effort and local-first: a signed-out visitor or an
   * unmigrated table still gets a usable slug back, so tagging a Moment
   * never depends on this succeeding. An explicit "Create a Corner" can
   * pass a short description; tagging-into-existence never has one to give. */
  getOrCreateCorner: (
    spaceSlug: string,
    name: string,
    description?: string,
  ) => Promise<{ slug: string; name: string }>;
  /** Resolves free text ("pottery") to a real Corner, across every
   * Category, not scoped to one the caller has to already know — for
   * anywhere that only has a person's own words to go on (Onboarding's
   * interest picker, a freeform tag): exact name match first, then a
   * near-duplicate (tagMatching's bestMatch, catching "Pottery" vs
   * "pottery" vs a typo) so this never mints a needless duplicate, and
   * only creates a new Corner when nothing close exists — its parent
   * Category guessed from keywords (lib/pursuitProgress.ts's guessSpace,
   * the same heuristic Pursuits already use), defaulting to the first
   * Category when nothing matches. Never returns null for non-empty text:
   * getOrCreateCorner's own local-first fallback guarantees a usable slug
   * even signed out or before a real table exists. Returns
   * `{ blocked: true }` instead of creating anything when the text hits
   * app_config's trademark_blocklist (checked client-side first — see
   * isBlocklistedName — so the caller can show a friendly message rather
   * than surface the CHECK constraint's raw error; the constraint is the
   * real enforcement boundary regardless). */
  resolveInterest: (
    text: string,
  ) => Promise<{ spaceSlug: string; slug: string; name: string } | { blocked: true } | null>;
  refresh: () => Promise<void>;
  /** The most recently created real Corners, platform-wide — not scoped to
   * one Space, not filtered by follows (My Space's "Freshly opened this
   * week"). Only ever draws from real Supabase rows (see Corner.createdAt);
   * signed out or unconfigured, this is always empty rather than guessing
   * at a creation time that was never actually recorded. */
  newestCorners: (limit: number) => Corner[];
  /** app_config's corner_min_moments_30d, for isBrowsableOnDiscover. Starts
   * at 3 (the seeded default) until the real value loads, so Discover's
   * gate is never briefly wide open on first paint. */
  cornerThreshold: number;
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

/** Corner names are free-text (tagged into existence, not curated), so
 * whatever case someone typed — "photography" as easily as "Photography" —
 * is what would otherwise get stored and shown verbatim. This only touches
 * the first character, not full title-case (which would mangle a
 * deliberately-cased multi-word name), and never touches the slug — dedupe
 * and the unique constraint key off slugifyCorner's already-lowercased
 * output, so this is purely cosmetic. Applied both at creation time (so new
 * rows are stored capitalized) and at every display site (so a Corner
 * already stored lowercase still renders correctly). */
export function capitalizeCornerName(name: string) {
  return name.length > 0 ? name[0].toUpperCase() + name.slice(1) : name;
}

const BASELINE: Corner[] = hobbies.flatMap((h) =>
  h.subItems.map((s) => ({
    spaceSlug: h.slug,
    slug: s.slug,
    name: s.label,
    momentCount: 0,
    momentCount30d: 0,
    hasActiveSpace: false,
    hidden: false,
    isCurated: true,
  })),
);

interface LocalCorner {
  spaceSlug: string;
  slug: string;
  name: string;
  description?: string;
}

const LOCAL_KEY = "sushii.corners.local.v1";

/**
 * Corners created via "Create a Corner" while signed out, or while Supabase
 * isn't configured, have nowhere else to live — getOrCreateCorner's remote
 * insert only ever runs with `supabase && user`, and the local/demo
 * derivation below only surfaces Corners that already have a tagged post.
 * Without this, a brand-new Corner with zero Moments would disappear the
 * instant the dialog closed. Kept local-first, same spirit as journal.ts.
 */
function loadLocalCorners(): LocalCorner[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as LocalCorner[]) : [];
  } catch {
    return [];
  }
}

function saveLocalCorners(corners: LocalCorner[]) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(corners));
  } catch {
    // best effort
  }
}

const DEFAULT_CORNER_THRESHOLD = 3;
// Mirrors app_config's seeded default (20260924098000) so the client-side
// check below still catches the obvious case before that table has ever
// loaded, or if it's unreachable.
const DEFAULT_BLOCKLIST = ["lego"];

export function CornersProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { publicFeed } = useContent();
  const [remote, setRemote] = useState<Corner[]>([]);
  const [blocklist, setBlocklist] = useState<string[]>(DEFAULT_BLOCKLIST);
  const [local, setLocal] = useState<LocalCorner[]>(loadLocalCorners);
  const [cornerThreshold, setCornerThreshold] = useState(DEFAULT_CORNER_THRESHOLD);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    try {
      const [cornersRes, activityRes, activeSpacesRes] = await Promise.all([
        supabase.from("corners").select("id, space_slug, slug, name, moment_count, description, created_at, hidden"),
        // Best-effort: an unmigrated table (20260924099000 not yet run)
        // just means every Corner's 30-day count stays 0 below, not a
        // thrown error — corners still exist and are still taggable.
        supabase.rpc("corner_activity_30d").then(
          (r) => r,
          () => ({ data: null }),
        ),
        // Same best-effort spirit: space_corners/spaces (20260924110000)
        // may not exist yet, and there's nothing to link until Phase 5
        // ships Create Space regardless.
        supabase
          .from("space_corners")
          .select("corner_id, spaces!inner(status)")
          .eq("spaces.status", "active")
          .then(
            (r) => r,
            () => ({ data: null }),
          ),
      ]);

      const activity30d = new Map<string, number>();
      for (const r of (activityRes.data ?? []) as any[]) {
        activity30d.set(`${r.space_slug}::${r.slug}`, Number(r.moments_30d) || 0);
      }
      const activeSpaceCornerIds = new Set<number>(
        ((activeSpacesRes.data ?? []) as any[]).map((r) => r.corner_id as number),
      );

      setRemote(
        ((cornersRes.data ?? []) as any[]).map((r) => ({
          spaceSlug: r.space_slug,
          slug: r.slug,
          name: capitalizeCornerName(r.name),
          momentCount: r.moment_count ?? 0,
          momentCount30d: activity30d.get(`${r.space_slug}::${r.slug}`) ?? 0,
          hasActiveSpace: r.id != null && activeSpaceCornerIds.has(r.id),
          hidden: r.hidden ?? false,
          isCurated: false,
          description: r.description ?? undefined,
          createdAt: r.created_at ? new Date(r.created_at).getTime() : undefined,
        })),
      );
    } catch {
      // The curated baseline still works offline; this list is additive.
    }

    try {
      const { data } = await supabase.from("app_config").select("value").eq("key", "corner_min_moments_30d").single();
      if (typeof data?.value === "number") setCornerThreshold(data.value);
    } catch {
      // app_config not migrated yet, or the row's missing — keep the
      // built-in default (3), same number the migration seeds it with.
    }

    try {
      const { data } = await supabase.from("app_config").select("value").eq("key", "trademark_blocklist").single();
      if (Array.isArray(data?.value)) setBlocklist(data.value as string[]);
    } catch {
      // Keep DEFAULT_BLOCKLIST — the real enforcement is the CHECK
      // constraint server-side either way.
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Signed out, or Supabase isn't configured: derive real activity from
  // whatever's in the local/demo feed instead, so a fresh tag still shows
  // up immediately rather than only after an account exists. There's no
  // real "last 30 days" signal available locally, so momentCount30d just
  // mirrors the derived lifetime count — good enough for a demo/offline
  // session, where nothing is actually gating Discover against real data.
  const derived: Corner[] = [];
  if (!supabase) {
    const counts = new Map<string, { spaceSlug: string; slug: string; count: number }>();
    for (const post of publicFeed) {
      const slug = postCorner(post);
      if (!slug) continue;
      const key = `${post.hobbySlug}::${slug}`;
      const entry = counts.get(key) ?? { spaceSlug: post.hobbySlug, slug, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
    for (const { spaceSlug, slug, count } of counts.values()) {
      // No local store for the canonical name a slug like this was tagged
      // with, so this title-cases the slug as a reasonable stand-in — the
      // real Supabase path always has the actual typed name instead.
      const name = titleCaseSlug(slug);
      derived.push({
        spaceSlug,
        slug,
        name,
        momentCount: count,
        momentCount30d: count,
        hasActiveSpace: false,
        hidden: false,
        isCurated: false,
      });
    }
  }

  const cornersFor = useCallback(
    (spaceSlug: string) => {
      const merged = new Map<string, Corner>();
      for (const c of BASELINE) if (c.spaceSlug === spaceSlug) merged.set(c.slug, c);
      // Locally-created corners go in before derived/remote activity so a
      // brand-new, zero-Moment Corner still shows up immediately, and any
      // momentCount that shows up later for the same slug still wins.
      for (const c of local) if (c.spaceSlug === spaceSlug) {
        const existing = merged.get(c.slug);
        merged.set(
          c.slug,
          existing
            ? { ...existing, description: c.description ?? existing.description }
            : {
                spaceSlug,
                slug: c.slug,
                name: capitalizeCornerName(c.name),
                momentCount: 0,
                momentCount30d: 0,
                hasActiveSpace: false,
                hidden: false,
                isCurated: false,
                description: c.description,
              },
        );
      }
      for (const c of derived) if (c.spaceSlug === spaceSlug) {
        const existing = merged.get(c.slug);
        merged.set(
          c.slug,
          existing ? { ...existing, momentCount: c.momentCount, momentCount30d: c.momentCount30d } : c,
        );
      }
      for (const c of remote) if (c.spaceSlug === spaceSlug) {
        const existing = merged.get(c.slug);
        merged.set(
          c.slug,
          existing
            ? {
                ...existing,
                momentCount: c.momentCount,
                momentCount30d: c.momentCount30d,
                hasActiveSpace: c.hasActiveSpace,
                hidden: c.hidden,
                description: c.description ?? existing.description,
              }
            : c,
        );
      }
      return [...merged.values()].sort((a, b) => b.momentCount - a.momentCount);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [remote, local, publicFeed],
  );

  const matchesFor = useCallback(
    (spaceSlug: string, query: string) => matchCorners(cornersFor(spaceSlug), query),
    [cornersFor],
  );

  // Every Corner across every non-hidden Category, flat — for anywhere
  // that doesn't (or can't yet) scope to one Category, the same source
  // Discover's own Corners tab and resolveInterest already build inline.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allCorners = useMemo(
    () => hobbies.filter((h) => !h.hidden).flatMap((h) => cornersFor(h.slug)),
    [cornersFor],
  );

  const newestCorners = useCallback(
    (limit: number) =>
      [...remote]
        .filter((c) => c.createdAt != null)
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        .slice(0, limit),
    [remote],
  );

  const getOrCreateCorner: CornersContextType["getOrCreateCorner"] = async (spaceSlug, rawName, description) => {
    const name = capitalizeCornerName(rawName.trim().slice(0, 60));
    const slug = slugifyCorner(name);
    const trimmedDescription = description?.trim().slice(0, 140) || undefined;

    // Local-first, same as mirrorPursuit/profileLinks: the Corner is real
    // the instant it's created, whether or not a remote write ever lands.
    setLocal((prev) => {
      if (prev.some((c) => c.spaceSlug === spaceSlug && c.slug === slug)) return prev;
      const next = [...prev, { spaceSlug, slug, name, description: trimmedDescription }];
      saveLocalCorners(next);
      return next;
    });

    if (supabase && user) {
      try {
        await supabase.from("corners").insert({
          space_slug: spaceSlug,
          slug,
          name,
          description: trimmedDescription || null,
        });
      } catch {
        // Best effort, same as mirrorPursuit: an unmigrated table or a
        // network hiccup still lets the Moment itself get tagged below.
      }
      await refresh();
    }

    return { slug, name };
  };

  const resolveInterest: CornersContextType["resolveInterest"] = async (text) => {
    const q = text.trim();
    if (!q) return null;
    const qNorm = q.toLowerCase();

    const all = hobbies.filter((h) => !h.hidden).flatMap((h) => cornersFor(h.slug));

    const exact = all.find((c) => c.name.toLowerCase() === qNorm);
    if (exact) return { spaceSlug: exact.spaceSlug, slug: exact.slug, name: exact.name };

    const match = bestMatch(
      q,
      [...new Set(all.map((c) => c.name))],
    );
    if (match) {
      const found = all.find((c) => c.name === match.label);
      if (found) return { spaceSlug: found.spaceSlug, slug: found.slug, name: found.name };
    }

    // Only reachable when nothing close already exists — an existing
    // Corner resolves above regardless of its own name, same as the CHECK
    // constraint only ever gates a new row, not one already there.
    if (isBlocklistedName(q, blocklist)) return { blocked: true };

    const guessedSpace = guessSpace(q) ?? hobbies[0].slug;
    const created = await getOrCreateCorner(guessedSpace, q);
    return { spaceSlug: guessedSpace, slug: created.slug, name: created.name };
  };

  const isNameBlocked = useCallback((name: string) => isBlocklistedName(name, blocklist), [blocklist]);

  return (
    <CornersContext.Provider
      value={{
        cornersFor,
        allCorners,
        matchesFor,
        isNameBlocked,
        getOrCreateCorner,
        resolveInterest,
        refresh,
        newestCorners,
        cornerThreshold,
      }}
    >
      {children}
    </CornersContext.Provider>
  );
}

export function useCorners() {
  const ctx = useContext(CornersContext);
  if (!ctx) throw new Error("useCorners must be used within CornersProvider");
  return ctx;
}
