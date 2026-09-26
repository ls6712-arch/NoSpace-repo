import { supabase } from "../../lib/supabase";
import { BASE_POST_COLUMNS, isMissingCountColumn, POST_COLUMNS, rowToPost } from "../context/ContentContext";
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
  // Explicit columns, never select("*") — same reason as every other posts
  // select in the app (see ContentContext.tsx's own comment on
  // BASE_POST_COLUMNS): a Reflection is owner-only and must never round-trip
  // to anyone else's browser, even as a field this mapper ignores. Retries
  // once without the reaction-count columns if they're not in this database
  // yet, same as ContentContext.tsx's refetchRealPosts.
  let { data: row, error } = await supabase.from("posts").select(POST_COLUMNS).eq("id", postId).maybeSingle<any>();
  if (isMissingCountColumn(error) && POST_COLUMNS !== BASE_POST_COLUMNS) {
    ({ data: row, error } = await supabase
      .from("posts")
      .select(BASE_POST_COLUMNS)
      .eq("id", postId)
      .maybeSingle<any>());
  }
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
