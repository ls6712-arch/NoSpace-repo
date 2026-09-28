import { supabase } from "../../lib/supabase";
import {
  BASE_POST_COLUMNS,
  isMissingCountColumn,
  POST_COLUMNS,
  POST_COLUMNS_WITH_MEDIA_PATHS,
  rowToPost,
} from "../context/ContentContext";
import { Post } from "../data/posts";
import { resolvePostMedia, signMomentPaths } from "./momentMedia";
import { buildSharedPursuitPreview, SharedPursuitPreview } from "./sharedPursuitPreview";

export type { SharedPursuitPreview };
export { buildSharedPursuitPreview };

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
  // without the reaction-count columns, then without media_paths too, if
  // either isn't in this database yet — same two-step fallback as
  // ContentContext.tsx's refetchRealPosts.
  let { data: row, error } = await supabase.from("posts").select(POST_COLUMNS).eq("id", postId).maybeSingle<any>();
  if (isMissingCountColumn(error) && POST_COLUMNS !== POST_COLUMNS_WITH_MEDIA_PATHS) {
    ({ data: row, error } = await supabase
      .from("posts")
      .select(POST_COLUMNS_WITH_MEDIA_PATHS)
      .eq("id", postId)
      .maybeSingle<any>());
  }
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
  const post = rowToPost(row, profile?.display_name?.trim() || "Someone");
  if (!post.mediaPaths?.length) return post;
  // Step 1: the card that shows up on the recipient's end resolves this
  // Moment's photo fresh, under THEIR own signed-URL access — never a URL
  // riding along from the sender's own session.
  return resolvePostMedia(post, await signMomentPaths(post.mediaPaths));
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
  // The Pursuit's most recent photo Moment, under the VIEWER's own RLS —
  // same "just comes back empty" privacy shape as fetchSharedMoment above,
  // never a separate visibility check. A written-only entry (no media)
  // just means no cover, same as any other Moment with nothing to show.
  let { data: coverRow, error: coverError } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    .eq("pursuit_id", pursuitId)
    .neq("type", "written")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<any>();
  if (isMissingCountColumn(coverError) && POST_COLUMNS !== POST_COLUMNS_WITH_MEDIA_PATHS) {
    ({ data: coverRow } = await supabase
      .from("posts")
      .select(POST_COLUMNS_WITH_MEDIA_PATHS)
      .eq("pursuit_id", pursuitId)
      .neq("type", "written")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<any>());
  }
  if (isMissingCountColumn(coverError) && POST_COLUMNS !== BASE_POST_COLUMNS) {
    ({ data: coverRow } = await supabase
      .from("posts")
      .select(BASE_POST_COLUMNS)
      .eq("pursuit_id", pursuitId)
      .neq("type", "written")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<any>());
  }
  // Step 1: a real cover photo lives at a path in moment-media now, not a
  // public post-media URL — sign it the same way a shared Moment's own
  // photo is. A legacy post (no media_paths yet) still falls back to its
  // existing media_url directly.
  const coverPath: string | undefined = coverRow?.media_paths?.[0];
  const cover: string | null = coverPath
    ? ((await signMomentPaths([coverPath])).get(coverPath) ?? null)
    : (coverRow?.media_url ?? null);
  return buildSharedPursuitPreview(row, profile?.display_name, cover);
}
