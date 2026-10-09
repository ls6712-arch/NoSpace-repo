import { supabase } from "../../lib/supabase";

/**
 * Mirrors a Save to public.bookmarks, so the author's "wants to try"
 * notification can fire (see supabase/migrations/20261022000000_save_
 * notification.sql). Saves are still kept on the phone first (lib/journal.ts);
 * this only adds the database copy, and never blocks or undoes the local one.
 *
 * Only a save made now is sent. Anything saved before this shipped stays on
 * the phone, so old saves never notify anyone. bookmarks is owner-only: nobody
 * else can read the row, and the notification carries a count, never a name.
 *
 * Saving twice is a no-op in the database (ON CONFLICT DO NOTHING), which is
 * also what keeps a repeat from notifying again. Failures are swallowed: signed
 * out, offline, or a post that is not in the database.
 */
export async function syncBookmark(postId: number, saved: boolean): Promise<void> {
  if (!supabase || !Number.isSafeInteger(postId)) return;
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;
    if (saved) {
      await supabase
        .from("bookmarks")
        .upsert({ user_id: userId, post_id: postId }, { onConflict: "user_id,post_id", ignoreDuplicates: true });
    } else {
      await supabase.from("bookmarks").delete().eq("user_id", userId).eq("post_id", postId);
    }
  } catch {
    // The local save already happened; a missing database copy only means no notification.
  }
}
