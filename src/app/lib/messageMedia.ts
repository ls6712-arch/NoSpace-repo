import { supabase } from "../../lib/supabase";

/** Phase 4's private bucket for chat photos (public = false — see
 * supabase/migrations/20261005000000_communication_phase4_rich.sql). Every
 * read goes through storage.objects RLS via a signed URL; there is no
 * public/unsigned endpoint for this bucket at all. */
export const MESSAGE_MEDIA_BUCKET = "message-media";

/** How long a signed URL for a chat photo stays valid before the viewer
 * needs a fresh one. Short-lived by design (decision 5) — nothing about
 * this bucket is meant to be shareable outside the two parties' own
 * sessions, and whoever a URL gets forwarded to (a screenshot's link, a
 * copy-pasted address) can open it until it expires regardless of who
 * they are. 5 minutes, not 30 — reviewed down from the first draft's
 * longer window for exactly that reason. */
export const MESSAGE_MEDIA_URL_TTL_SECONDS = 60 * 5;

function extensionOf(file: File): string {
  const dot = file.name.lastIndexOf(".");
  const raw = dot > -1 ? file.name.slice(dot + 1) : "";
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
  return cleaned || "jpg";
}

/** Uploads an already-HEIC-converted file into this participation's own
 * folder — `<participation_id>/<uuid>.<ext>`, the path shape the storage
 * policies and the messages INSERT policy's media_path check both expect. */
export async function uploadMessagePhoto(
  participationId: number | string,
  file: File,
): Promise<{ path: string | null; error: string | null }> {
  if (!supabase) return { path: null, error: "not configured" };
  const path = `${participationId}/${crypto.randomUUID()}.${extensionOf(file)}`;
  const { error } = await supabase.storage
    .from(MESSAGE_MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

/** A short-lived signed URL for a chat photo — never a public URL, since
 * this bucket has none. Returns null on any failure (object gone, no
 * longer readable — e.g. the sender unsent it, or a block took effect)
 * rather than throwing, so a stale reference just renders as unavailable. */
export async function getMessagePhotoUrl(path: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from(MESSAGE_MEDIA_BUCKET)
    .createSignedUrl(path, MESSAGE_MEDIA_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Best-effort delete of a chat photo's storage object — called after a
 * successful unsend. Never throws: the message row is already cleared
 * either way (that's the security boundary), so a delete failure here
 * just leaves an orphaned object. That object is still readable by BOTH
 * parties to the thread, not just the uploader — the read policy is
 * scoped to the chat's own folder (participation_id), not to the
 * uploader's identity — so this is best-effort cleanup, not the thing
 * standing between an unsent photo and being seen again; the message row
 * having lost its media_path is what actually cuts off the ordinary path
 * to it. */
export async function deleteMessagePhoto(path: string): Promise<void> {
  if (!supabase) return;
  await supabase.storage.from(MESSAGE_MEDIA_BUCKET).remove([path]);
}
