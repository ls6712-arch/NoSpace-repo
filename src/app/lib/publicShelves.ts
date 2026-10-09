import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

/** The landing page "See who is on" row stays hidden until this many real public Shelves exist. */
export const MIN_PUBLIC_SHELVES = 6;

export interface PublicShelf {
  id: string;
  path: string;
  firstName: string;
  photoUrl: string;
  interests: string[];
}

/** Real Shelves only: a name, a photo, and at least one public post to say what they are into. */
export async function fetchPublicShelves(limit = 24): Promise<PublicShelf[]> {
  if (!supabase) return [];
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("discoverable", true)
    .is("paused_at", null)
    .is("deletion_requested_at", null)
    .not("avatar_url", "is", null)
    .not("username", "is", null)
    .limit(limit);
  if (error || !profiles?.length) return [];

  const ids = profiles.map((p) => p.id as string);
  const { data: posts } = await supabase
    .from("posts")
    .select("user_id, corner")
    .in("user_id", ids)
    .eq("visibility", "public");

  const interests = new Map<string, string[]>();
  for (const row of posts ?? []) {
    const corner = ((row.corner as string | null) ?? "").replace(/[-_]+/g, " ").trim().toLowerCase();
    if (!corner) continue;
    const list = interests.get(row.user_id as string) ?? [];
    if (!list.includes(corner)) list.push(corner);
    interests.set(row.user_id as string, list);
  }

  const shelves: PublicShelf[] = [];
  for (const p of profiles) {
    const list = interests.get(p.id as string);
    const firstName = ((p.display_name as string | null) ?? "").trim().split(/\s+/)[0]?.slice(0, 30);
    if (!list?.length || !firstName) continue;
    shelves.push({
      id: p.id as string,
      path: `/u/${encodeURIComponent(p.username as string)}`,
      firstName,
      photoUrl: p.avatar_url as string,
      interests: list.slice(0, 3),
    });
  }
  return shelves;
}

/** Null while loading, then the shelves, or an empty list when there are too few to show. */
export function usePublicShelves(): PublicShelf[] | null {
  const [shelves, setShelves] = useState<PublicShelf[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchPublicShelves()
      .catch(() => [] as PublicShelf[])
      .then((list) => {
        if (!cancelled) setShelves(list.length >= MIN_PUBLIC_SHELVES ? list : []);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return shelves;
}
