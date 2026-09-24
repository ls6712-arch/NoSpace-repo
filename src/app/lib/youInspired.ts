import { supabase } from "../../lib/supabase";

export interface InspiredEntry {
  pursuitId: string;
  startedAt: number;
  pursuitTitle: string;
  hobbySlug: string;
  subHobby?: string;
  inspiringPostId: number;
  inspiringPostCaption: string;
}

/**
 * Reads public.you_inspired_this_month() — see the staged migration at
 * supabase/migrations/20260922040000_you_inspired_rpc.sql for the actual
 * query and the heuristic it's built on (pursuits.inspired_by_post_id, an
 * explicit recorded link, not inferred from reaction timing).
 *
 * Returns [] whenever there's nothing to show, Supabase isn't configured,
 * or the RPC doesn't exist yet because that migration hasn't been run —
 * same best-effort shape as every other not-yet-migrated read in this
 * app (see CornersContext.tsx's own refresh()), never a thrown error a
 * page has to handle.
 */
export async function fetchYouInspired(): Promise<InspiredEntry[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc("you_inspired_this_month");
    if (error || !data) return [];
    return (data as any[]).map((r) => ({
      pursuitId: r.pursuit_id,
      startedAt: new Date(r.started_at).getTime(),
      pursuitTitle: r.pursuit_title,
      hobbySlug: r.pursuit_hobby_slug,
      subHobby: r.pursuit_sub_hobby ?? undefined,
      inspiringPostId: r.inspiring_post_id,
      inspiringPostCaption: r.inspiring_post_caption,
    }));
  } catch {
    return [];
  }
}
