import { supabase } from "../../lib/supabase";

export interface BusyCorner {
  /** "{space}/{corner}". */
  key: string;
  /** Events in the next `days` days, near this city. Always at least 1. */
  events: number;
}

/** The Corners with the most events first, those with none left out, at most `limit`. Pure, so it can be tested. */
export function topBusyCorners(rows: readonly { corner_key: unknown; events: unknown }[], limit = 6): BusyCorner[] {
  const sums = new Map<string, number>();
  for (const r of rows) {
    const key = typeof r.corner_key === "string" && r.corner_key.includes("/") ? r.corner_key : null;
    const n = Number(r.events);
    if (key && Number.isFinite(n) && n > 0) sums.set(key, (sums.get(key) ?? 0) + Math.floor(n));
  }
  return [...sums]
    .map(([key, events]) => ({ key, events }))
    .sort((a, b) => b.events - a.events || a.key.localeCompare(b.key))
    .slice(0, limit);
}

/**
 * Corners with the most events in the next 7 days near the person's city (public.corners_with_activity, events only).
 * Empty with no city, signed out, or on any failure, and the page then leaves the section out.
 */
export async function fetchBusyCorners(city: string, days = 7, limit = 6): Promise<BusyCorner[]> {
  if (!supabase || !city.trim()) return [];
  try {
    const { data, error } = await supabase.rpc("corners_with_activity", { p_city: city, p_days: days });
    if (error || !Array.isArray(data)) return [];
    return topBusyCorners(data as { corner_key: unknown; events: unknown }[], limit);
  } catch {
    return [];
  }
}
