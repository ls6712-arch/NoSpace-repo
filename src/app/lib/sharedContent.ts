import { supabase } from "../../lib/supabase";
import { rowToPost } from "../context/ContentContext";
import { Post } from "../data/posts";

/**
 * Loads a shared Moment/Pursuit card's content under the VIEWER's own
 * permissions — a plain `select ... where id = ...`, subject to that
 * table's normal RLS, exactly like any other read in the app. A message
 * row referencing a Moment/Pursuit never widens who can see it (see the
 * messages INSERT policy's own comment in the Phase 4 migration): the
 * sender could see it at send time, but the recipient's own visibility is
 * all that governs whether THEY can, right now. A private/followers-only
 * Moment the sender shared with someone who isn't a follower simply comes
 * back empty here — indistinguishable from "deleted" or "never existed",
 * on purpose (see docs/communication-strategy.md's Phase 4 "Not available"
 * requirement).
 */

export async function fetchSharedMoment(postId: number | string): Promise<Post | null> {
  if (!supabase) return null;
  const { data: row, error } = await supabase.from("posts").select("*").eq("id", postId).maybeSingle();
  if (error || !row) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", row.user_id)
    .maybeSingle();
  return rowToPost(row, profile?.display_name?.trim() || "Someone");
}

export interface SharedPursuitPreview {
  id: string;
  title: string;
  ownerId: string;
  ownerName: string;
}

export async function fetchSharedPursuit(pursuitId: string): Promise<SharedPursuitPreview | null> {
  if (!supabase) return null;
  const { data: row, error } = await supabase
    .from("pursuits")
    .select("id, title, user_id")
    .eq("id", pursuitId)
    .maybeSingle();
  if (error || !row) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", row.user_id)
    .maybeSingle();
  return {
    id: row.id,
    title: row.title,
    ownerId: row.user_id,
    ownerName: profile?.display_name?.trim() || "Someone",
  };
}
