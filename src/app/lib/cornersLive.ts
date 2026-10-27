import { supabase } from "../../lib/supabase";
import type { SpaceRow } from "./spaces";

/**
 * What is happening in the curated Corners right now: their Spaces and
 * events, joined on by (spaceSlug, slug). Corner rows are created the first
 * time anyone tags or links one, so a Corner with no row has nothing live
 * and simply comes back empty.
 *
 * Reads only, and only what a signed-out visitor may see: Spaces are public,
 * and events follow the Space's access (an Open Space's events are readable,
 * a Closed Space's are not). A Closed Space's event shows up here only as a
 * teaser (title and time), through list_event_teasers.
 */
export type LiveSpace = Pick<
  SpaceRow,
  "id" | "slug" | "name" | "cover_image" | "access" | "created_by" | "city" | "neighborhood"
>;

export interface LiveEvent {
  id: number;
  spaceId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  /** "in_person", "online" or "both"; null on a teaser. */
  meets: string | null;
  neighborhood: string | null;
  city: string | null;
  /** From a Closed Space: title and time only. */
  teaser: boolean;
}

export interface CornerLive {
  spaces: LiveSpace[];
  events: LiveEvent[];
}

const WEEK_MS = 7 * 24 * 3_600_000;

export function emptyLive(): CornerLive {
  return { spaces: [], events: [] };
}

/** Events starting inside the next seven days. */
export function thisWeek(events: LiveEvent[], now = Date.now()): LiveEvent[] {
  return events.filter((e) => {
    const t = new Date(e.startsAt).getTime();
    return t > now && t <= now + WEEK_MS;
  });
}

interface Options {
  /** The Corners to load; results are keyed `${spaceSlug}/${slug}`. */
  targets: { spaceSlug: string; slug: string }[];
  /** Include events further out than a week, and Closed Space teasers. */
  full?: boolean;
  /** Leave Closed Spaces out entirely, teasers included (signed-out and not-yet-approved viewers). */
  openOnly?: boolean;
}

export async function fetchCornersLive(opts: Options): Promise<Map<string, CornerLive>> {
  const result = new Map<string, CornerLive>();
  const wanted = opts.targets;
  const keyOf = (t: { spaceSlug: string; slug: string }) => `${t.spaceSlug}/${t.slug}`;
  for (const x of wanted) result.set(keyOf(x), emptyLive());
  if (!supabase || wanted.length === 0) return result;

  const { data: cornerRows } = await supabase
    .from("corners")
    .select("id, space_slug, slug")
    .in("slug", [...new Set(wanted.map((x) => x.slug))]);
  const cornerSlugById = new Map<number, string>();
  for (const r of cornerRows ?? []) {
    const key = `${r.space_slug as string}/${r.slug as string}`;
    if (!result.has(key)) continue;
    cornerSlugById.set(r.id as number, key);
  }
  if (cornerSlugById.size === 0) return result;

  const { data: links } = await supabase
    .from("space_corners")
    .select("space_id, corner_id")
    .in("corner_id", [...cornerSlugById.keys()]);
  const spaceIds = [...new Set((links ?? []).map((l) => l.space_id as string))];
  if (spaceIds.length === 0) return result;

  const { data: spaceRows } = await supabase
    .from("spaces")
    .select("id, slug, name, cover_image, access, created_by, city, neighborhood")
    .in("id", spaceIds)
    .eq("status", "active");
  const spaceById = new Map(
    ((spaceRows as LiveSpace[] | null) ?? []).filter((s) => !opts.openOnly || s.access === "open").map((s) => [s.id, s]),
  );

  const slugsBySpace = new Map<string, string[]>();
  for (const l of links ?? []) {
    const slug = cornerSlugById.get(l.corner_id as number);
    const space = spaceById.get(l.space_id as string);
    if (!slug || !space) continue;
    result.get(slug)!.spaces.push(space);
    slugsBySpace.set(space.id, [...(slugsBySpace.get(space.id) ?? []), slug]);
  }

  const openIds = [...spaceById.values()].filter((s) => s.access === "open").map((s) => s.id);
  const events: LiveEvent[] = [];
  if (openIds.length > 0) {
    const now = new Date();
    let q = supabase
      .from("space_events")
      .select("id, space_id, title, starts_at, ends_at, timezone, meets, neighborhood, city")
      .in("space_id", openIds)
      .eq("status", "scheduled")
      .gt("starts_at", now.toISOString())
      .order("starts_at", { ascending: true })
      .limit(500);
    if (!opts.full) q = q.lte("starts_at", new Date(now.getTime() + WEEK_MS).toISOString());
    const { data } = await q;
    for (const e of data ?? []) {
      events.push({
        id: e.id as number,
        spaceId: e.space_id as string,
        title: e.title as string,
        startsAt: e.starts_at as string,
        endsAt: (e.ends_at as string | null) ?? null,
        timezone: e.timezone as string,
        meets: (e.meets as string | null) ?? null,
        neighborhood: (e.neighborhood as string | null) ?? null,
        city: (e.city as string | null) ?? null,
        teaser: false,
      });
    }
  }
  if (opts.full) {
    const closedIds = [...spaceById.values()].filter((s) => s.access === "closed").map((s) => s.id);
    const teasers = await Promise.all(
      closedIds.map((id) => supabase!.rpc("list_event_teasers", { p_space_id: id })),
    );
    teasers.forEach((t, i) => {
      for (const e of (t.data as { id: number; title: string; starts_at: string; timezone: string }[] | null) ?? []) {
        events.push({
          id: e.id,
          spaceId: closedIds[i],
          title: e.title,
          startsAt: e.starts_at,
          endsAt: null,
          timezone: e.timezone,
          meets: null,
          neighborhood: null,
          city: null,
          teaser: true,
        });
      }
    });
  }
  events.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  for (const e of events) {
    for (const slug of slugsBySpace.get(e.spaceId) ?? []) result.get(slug)!.events.push(e);
  }
  return result;
}
