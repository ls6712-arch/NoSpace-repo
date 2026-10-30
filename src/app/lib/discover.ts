import { supabase } from "../../lib/supabase";
import { suggestionLoggingEnabled } from "../config";

/**
 * What Discover v2 reads and logs: `discover_moments()`, `discover_corners()` and
 * `discover_spaces()`, and the Discover rows of `suggestion_events`, all from
 * migration 20261111000000. Best effort: a failure, or the migration not being live
 * yet, means an empty list (the section hides) and a lost log row, never an error
 * screen. No function here returns a follower or member count.
 */

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

// ---------- Moments from people you do not follow yet ----------

export interface DiscoverMoment {
  postId: number;
  authorId: string;
  /** ISO time; pass the last one back as the cursor for the next page. */
  createdAt: string;
  /** "space-slug/corner-slug". */
  cornerKey: string;
}

interface MomentRow {
  post_id?: unknown;
  author_id?: unknown;
  created_at?: unknown;
  corner_key?: unknown;
}

export function mapMomentRow(row: MomentRow): DiscoverMoment | null {
  const postId = typeof row.post_id === "number" ? row.post_id : Number(row.post_id);
  const authorId = text(row.author_id);
  const createdAt = text(row.created_at);
  if (!Number.isFinite(postId) || !authorId || !createdAt || !Number.isFinite(Date.parse(createdAt))) return null;
  return { postId, authorId, createdAt, cornerKey: text(row.corner_key) ?? "" };
}

export async function fetchDiscoverMoments(opts: { corner?: string | null; cursor?: string | null; limit?: number } = {}): Promise<DiscoverMoment[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc("discover_moments", {
      p_corner: opts.corner ?? null,
      p_cursor: opts.cursor ?? null,
      p_limit: opts.limit ?? 20,
    });
    if (error || !Array.isArray(data)) return [];
    return (data as MomentRow[]).flatMap((r) => {
      const m = mapMomentRow(r);
      return m ? [m] : [];
    });
  } catch {
    return [];
  }
}

// ---------- Corners new to you ----------

export interface DiscoverCorner {
  cornerKey: string;
  /** A guide to start at home. */
  hasHome: boolean;
  /** An open Pursuit with room. */
  hasGroup: boolean;
  /** An open Space or an upcoming event in the city. */
  hasPlace: boolean;
}

interface CornerRow {
  corner_key?: unknown;
  has_home?: unknown;
  has_group?: unknown;
  has_place?: unknown;
}

export function mapCornerRow(row: CornerRow): DiscoverCorner | null {
  const cornerKey = text(row.corner_key);
  if (!cornerKey || !cornerKey.includes("/")) return null;
  return { cornerKey, hasHome: row.has_home === true, hasGroup: row.has_group === true, hasPlace: row.has_place === true };
}

/** `candidates` are the Corner keys the app has a guide for; built-in Corners live in code, not in the database. */
export async function fetchDiscoverCorners(limit = 3, candidates?: readonly string[]): Promise<DiscoverCorner[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc("discover_corners", { p_limit: limit, p_candidates: candidates ? [...candidates] : null });
    if (error || !Array.isArray(data)) return [];
    return (data as CornerRow[]).flatMap((r) => {
      const c = mapCornerRow(r);
      return c ? [c] : [];
    });
  } catch {
    return [];
  }
}

// ---------- Spaces near you ----------

export interface DiscoverSpace {
  id: string;
  slug: string;
  name: string;
  cornerKey: string | null;
  neighborhood: string | null;
  /** Open spaces are joined; Closed ones are asked to join. */
  access: "open" | "closed";
  /** "{N} Moments this month". */
  momentsThisMonth: number;
  nextEvent: { title: string; startsAt: number } | null;
}

interface SpaceRow {
  space_id?: unknown;
  slug?: unknown;
  name?: unknown;
  corner_key?: unknown;
  neighborhood?: unknown;
  access?: unknown;
  moments_this_month?: unknown;
  next_event_title?: unknown;
  next_event_at?: unknown;
}

export function mapSpaceRow(row: SpaceRow): DiscoverSpace | null {
  const id = text(row.space_id);
  const slug = text(row.slug);
  const name = text(row.name);
  const access = row.access === "open" || row.access === "closed" ? row.access : null;
  if (!id || !slug || !name || !access) return null;
  const title = text(row.next_event_title);
  const at = typeof row.next_event_at === "string" ? Date.parse(row.next_event_at) : NaN;
  const count = Number(row.moments_this_month);
  return {
    id,
    slug,
    name,
    cornerKey: text(row.corner_key),
    neighborhood: text(row.neighborhood),
    access,
    momentsThisMonth: Number.isFinite(count) && count > 0 ? Math.floor(count) : 0,
    nextEvent: title && Number.isFinite(at) ? { title, startsAt: at } : null,
  };
}

export async function fetchDiscoverSpaces(limit = 10): Promise<DiscoverSpace[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc("discover_spaces", { p_limit: limit });
    if (error || !Array.isArray(data)) return [];
    return (data as SpaceRow[]).flatMap((r) => {
      const s = mapSpaceRow(r);
      return s ? [s] : [];
    });
  } catch {
    return [];
  }
}

// ---------- The log ----------

export type DiscoverKind = "idea" | "corner" | "space" | "moment";
export type DiscoverAction = "shown" | "opened" | "followed" | "joined" | "tried";

export interface DiscoverLog {
  kind: DiscoverKind;
  refId: string;
  cornerKey?: string | null;
  /** Zero-based place in the list. */
  position: number;
  action: DiscoverAction;
}

/**
 * Fire and forget, off while `suggestionLoggingEnabled` (config.ts) is off. `shown` is
 * sent once per item per mount, at 50% visibility, by the caller.
 */
export async function logDiscoverEvent(e: DiscoverLog): Promise<void> {
  if (!suggestionLoggingEnabled || !supabase) return;
  try {
    await supabase.rpc("log_discover_event", {
      p_kind: e.kind,
      p_ref_id: e.refId.slice(0, 80),
      p_corner_key: e.cornerKey ?? null,
      p_position: Math.max(0, Math.min(Math.floor(e.position), 99)),
      p_action: e.action,
    });
  } catch {
    // Offline or not deployed yet.
  }
}
