import { supabase } from "../../lib/supabase";
import { canonicalCorner } from "../data/hobbies";
import { friendlyError } from "./friendlyError";
import { cleanWindows, isBudget, isPassKind, PLACE_MAX, type Budget, type Pass } from "./tasteModel";

/**
 * Reading and writing what screens 7 to 9 ask: picks, free windows and the
 * monthly budget (profile_private), passes (user_passes), and the two lookups
 * that order the picks. All of it is owner-only, from migration 20261105000000.
 * Before that migration is live each call quietly does nothing, so the screens
 * still work and nobody is blocked by a missing column.
 */
// PostgREST: PGRST202 no such function, PGRST204 no such column, PGRST205 no such table; Postgres: 42883, 42703, 42P01.
const notDeployed = (code?: string) => ["PGRST202", "PGRST204", "PGRST205", "42883", "42703", "42P01"].includes(code ?? "");

export interface Taste {
  picks: string[];
  windows: string[];
  budget: Budget | null;
}

export const EMPTY_TASTE: Taste = { picks: [], windows: [], budget: null };

/** A Corner key in its one canonical form ("space-slug/corner-slug", merged Corners folded in). */
export function pickKey(spaceSlug: string, slug: string): string {
  const c = canonicalCorner(spaceSlug, slug);
  return `${c.spaceSlug}/${c.slug}`;
}

/** Known, canonical, distinct keys in the order given. */
export function cleanPicks(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const k of raw) {
    if (typeof k !== "string") continue;
    const [space, slug, extra] = k.split("/");
    if (!space || !slug || extra !== undefined) continue;
    const key = pickKey(space, slug);
    if (!out.includes(key)) out.push(key);
  }
  return out;
}

export async function fetchTaste(userId: string): Promise<Taste> {
  if (!supabase) return EMPTY_TASTE;
  try {
    const { data, error } = await supabase.from("profile_private").select("picks, free_windows, monthly_budget").eq("user_id", userId).maybeSingle();
    if (error || !data) return EMPTY_TASTE;
    const row = data as { picks: unknown; free_windows: unknown; monthly_budget: unknown };
    return { picks: cleanPicks(row.picks), windows: cleanWindows(row.free_windows), budget: isBudget(row.monthly_budget) ? row.monthly_budget : null };
  } catch {
    return EMPTY_TASTE;
  }
}

/** Which Corners have something real near this city in the next 14 days, and how many things (events plus open Pursuits). */
export async function fetchCornerActivity(city: string, days = 14): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!supabase || !city.trim()) return out;
  try {
    const { data, error } = await supabase.rpc("corners_with_activity", { p_city: city, p_days: days });
    if (error || !Array.isArray(data)) return out;
    for (const r of data as { corner_key: string; events: number; pursuits: number }[]) {
      const [space, slug] = String(r.corner_key).split("/");
      if (!space || !slug) continue;
      const key = pickKey(space, slug);
      out.set(key, (out.get(key) ?? 0) + (Number(r.events) || 0) + (Number(r.pursuits) || 0));
    }
  } catch {
    // Without it the list is just the curated one.
  }
  return out;
}

/** The Corner of the Pursuit a friend's invite link is for, as a key. Null when there is none, or it cannot be asked yet. */
export async function fetchInviteCorner(token: string): Promise<string | null> {
  if (!supabase || !token) return null;
  try {
    const { data, error } = await supabase.rpc("pursuit_invite_corner", { invite_token: token });
    const row = (Array.isArray(data) ? data[0] : data) as { hobby_slug?: string; sub_hobby?: string } | null | undefined;
    if (error || !row?.hobby_slug || !row.sub_hobby) return null;
    return pickKey(row.hobby_slug, row.sub_hobby);
  } catch {
    return null;
  }
}

export async function fetchPasses(userId: string): Promise<Pass[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from("user_passes").select("id, kind, label, place").eq("user_id", userId).order("created_at");
    if (error || !Array.isArray(data)) return [];
    return (data as { id: string; kind: string; label: string; place: string | null }[])
      .filter((r) => isPassKind(r.kind))
      .map((r) => ({ id: r.id, kind: r.kind as Pass["kind"], label: r.label, place: r.place ?? "" }));
  } catch {
    return [];
  }
}

/**
 * Saves the passes as they are on screen: each is written (by its own id, so
 * saving twice never doubles it) and any that were saved before and are gone now
 * are removed. A place is trimmed and left out when empty.
 */
export async function savePasses(userId: string, passes: readonly Pass[], savedIds: readonly string[]): Promise<{ error: string | null }> {
  if (!supabase) return { error: null };
  try {
    if (passes.length > 0) {
      const rows = passes.map((p) => ({
        id: p.id,
        user_id: userId,
        kind: p.kind,
        label: p.label,
        place: p.place.replace(/\s+/g, " ").trim().slice(0, PLACE_MAX) || null,
      }));
      const { error } = await supabase.from("user_passes").upsert(rows, { onConflict: "id" });
      if (error) return notDeployed(error.code) ? { error: null } : { error: friendlyError(error) };
    }
    const gone = savedIds.filter((id) => !passes.some((p) => p.id === id));
    if (gone.length > 0) {
      const { error } = await supabase.from("user_passes").delete().eq("user_id", userId).in("id", gone);
      if (error && !notDeployed(error.code)) return { error: friendlyError(error) };
    }
    return { error: null };
  } catch (e) {
    return { error: friendlyError(e) };
  }
}

/** A fresh id for a pass, made on this device so a retry never saves it twice. */
export function newPassId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
        const r = Math.floor(Math.random() * 16);
        return (ch === "x" ? r : (r & 3) | 8).toString(16);
      });
}
