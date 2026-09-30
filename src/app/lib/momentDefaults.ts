import type { Visibility } from "../data/posts";

/**
 * Step 3 (two-tap logging): the last Pursuit, Corner, and audience someone
 * actually saved a Moment with, so the next one opens with the same
 * defaults instead of asking again. Keyed by account id inside one
 * localStorage value (not a key per account) — simplest thing that works
 * for v1, per the app brief. Never trusted for anything but a starting
 * point: every value here stays a one-tap-to-change chip in the composer.
 */
const STORAGE_KEY = "sushii.momentDefaults.v1";

export interface CornerRef {
  spaceSlug: string;
  slug: string;
  name: string;
}

export interface MomentDefaults {
  pursuitId?: string;
  corner?: CornerRef;
  /** "private" | "followers" | "public" — the exact strings every composer
   * writes to posts.visibility today (see lib/visibility.ts's own note on
   * "private" vs "just_me"), not the Visibility union alone. */
  audience?: Visibility | "private";
}

type Store = Record<string, MomentDefaults>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // A private window may refuse writes — the defaults just won't persist
    // this session, which is a fine fallback for a convenience feature.
  }
}

export function loadMomentDefaults(userId: string): MomentDefaults {
  return readStore()[userId] ?? {};
}

export function saveMomentDefaults(userId: string, patch: Partial<MomentDefaults>) {
  const store = readStore();
  store[userId] = { ...store[userId], ...patch };
  writeStore(store);
}
