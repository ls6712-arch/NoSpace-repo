import { supabase } from "../../lib/supabase";
import { onlySpacesWithMemberMoments } from "./spaceMoments";

export interface NearbyEvent {
  id: number;
  title: string;
  startsAt: number;
  spaceName: string;
  spaceSlug: string;
  coverImage?: string;
  where?: string;
}

export interface SuggestedSpace {
  id: string;
  slug: string;
  name: string;
  coverImage?: string;
}

/** Upcoming events in open Spaces over the next 7 days, soonest first. Best effort: a failure is an empty list. */
export async function fetchEventsThisWeek(limit = 3): Promise<NearbyEvent[]> {
  if (!supabase) return [];
  try {
    const now = new Date();
    const week = new Date(now.getTime() + 7 * 86400000);
    const { data: events, error } = await supabase
      .from("space_events")
      .select("id, space_id, title, starts_at, neighborhood, city")
      .eq("status", "scheduled")
      .gt("starts_at", now.toISOString())
      .lt("starts_at", week.toISOString())
      .order("starts_at", { ascending: true })
      .limit(limit * 4);
    if (error || !events || events.length === 0) return [];
    const ids = [...new Set(events.map((e) => e.space_id as string))];
    const { data: spaces } = await supabase
      .from("spaces")
      .select("id, slug, name, cover_image, access, status")
      .in("id", ids)
      .eq("access", "open")
      .eq("status", "active");
    const shownSpaces = await onlySpacesWithMemberMoments((spaces ?? []).map((s) => ({ ...s, id: s.id as string })));
    const byId = new Map(shownSpaces.map((s) => [s.id, s]));
    const out: NearbyEvent[] = [];
    for (const e of events) {
      const s = byId.get(e.space_id as string);
      if (!s) continue;
      out.push({
        id: e.id as number,
        title: e.title as string,
        startsAt: new Date(e.starts_at as string).getTime(),
        spaceName: s.name as string,
        spaceSlug: s.slug as string,
        coverImage: (s.cover_image as string) || undefined,
        where: ((e.neighborhood as string | null) || (e.city as string | null)) ?? undefined,
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** A few open Spaces to follow, newest first. Best effort. */
export async function fetchSuggestedSpaces(limit = 3): Promise<SuggestedSpace[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("spaces")
      .select("id, slug, name, cover_image")
      .eq("access", "open")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(limit * 4);
    if (error || !data) return [];
    const shown = await onlySpacesWithMemberMoments(data.map((s) => ({ ...s, id: s.id as string })));
    return shown.slice(0, limit).map((s) => ({ id: s.id, slug: s.slug as string, name: s.name as string, coverImage: (s.cover_image as string) || undefined }));
  } catch {
    return [];
  }
}
