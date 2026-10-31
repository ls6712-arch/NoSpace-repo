import { fetchCornersLive, type LiveSpace } from "./cornersLive";
import { fetchOpenPursuits, type OpenPursuit } from "./openPursuits";
import { supabase } from "../../lib/supabase";

/**
 * The names on a Corner card's With people and At a place tabs: the soonest open
 * Pursuit and the nearest Space for that Corner. Read with the same calls the
 * Corner page uses, so it needs no new database function. Best effort: anything
 * that fails or comes back empty leaves the tab on its fallback line.
 */

export interface CornerNames {
  /** Title of the soonest open Pursuit with room. */
  people?: string;
  /** Name of the nearest Space. */
  place?: string;
}

const lower = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

/** The open Pursuit whose next session is soonest (one with no upcoming session last); null when there is none. */
export function soonestPursuitName(list: readonly OpenPursuit[], now = Date.now()): string | null {
  const when = (p: OpenPursuit) => (p.session && p.session.startsAt > now ? p.session.startsAt : Infinity);
  const best = [...list].filter((p) => p.title.trim()).sort((a, b) => when(a) - when(b))[0];
  return best ? best.title.trim() : null;
}

/** Same neighborhood as the person first, then the same city, then the first listed; null when there are none. */
export function nearestSpaceName(spaces: readonly Pick<LiveSpace, "name" | "neighborhood" | "city">[], where: { area?: string; city?: string }): string | null {
  const named = spaces.filter((s) => s.name.trim());
  const area = lower(where.area);
  const city = lower(where.city);
  const pick =
    (area && named.find((s) => lower(s.neighborhood) === area)) ||
    (city && named.find((s) => lower(s.city) === city)) ||
    named[0];
  return pick ? pick.name.trim() : null;
}

/** The person's own neighborhood (profile_private.area, readable only by them). Empty when unknown. */
export async function fetchMyArea(userId: string): Promise<string> {
  if (!supabase) return "";
  try {
    const { data, error } = await supabase.from("profile_private").select("area").eq("user_id", userId).maybeSingle();
    return error || !data ? "" : String((data as { area?: unknown }).area ?? "").trim();
  } catch {
    return "";
  }
}

export async function fetchCornerNames(
  keys: readonly string[],
  where: { area?: string; city?: string },
): Promise<Map<string, CornerNames>> {
  const out = new Map<string, CornerNames>();
  if (keys.length === 0) return out;
  const targets = keys.map((k) => ({ spaceSlug: k.split("/")[0], slug: k.split("/")[1] }));
  const [live, pursuits] = await Promise.all([
    fetchCornersLive({ targets }).catch(() => new Map()),
    Promise.all(keys.map((k) => fetchOpenPursuits(k.split("/")[0], k.split("/")[1], 5).catch(() => [] as OpenPursuit[]))),
  ]);
  keys.forEach((key, i) => {
    const names: CornerNames = {};
    const people = soonestPursuitName(pursuits[i]);
    if (people) names.people = people;
    const place = nearestSpaceName(live.get(key)?.spaces ?? [], where);
    if (place) names.place = place;
    out.set(key, names);
  });
  return out;
}
