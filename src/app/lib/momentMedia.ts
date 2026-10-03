import { supabase } from "../../lib/supabase";
import { Post } from "../data/posts";
import { friendlyError } from "./friendlyError";
import { UPLOAD_COPY } from "./stateCopy";

/**
 * Step 1's private bucket for Moment photos (public = false — see
 * supabase/migrations/20261007000000_step1_moment_media_private.sql).
 * Every read goes through storage.objects RLS via a signed URL; there is
 * no public/unsigned endpoint for this bucket at all. The storage SELECT
 * policy checks the same posts RLS the `posts` table itself enforces, so
 * "if you can see the Moment, you can see its photos" holds automatically
 * for public/followers/circle/just_me alike, and changing a Moment's
 * audience takes effect on its photos immediately — nothing here has to
 * know about visibility rules itself. `post-media` keeps avatars, Space
 * covers and thought attachments for now (see the migration's own notes
 * for what's explicitly not moved yet).
 */
export const MOMENT_MEDIA_BUCKET = "moment-media";

/** How long a signed Moment-photo URL stays valid before a fresh one is
 * needed. Longer than a chat photo's (message-media's 5 minutes) since a
 * Moment's photo is meant to be looked at for a while on one page load,
 * not just alongside a live conversation. */
export const MOMENT_MEDIA_URL_TTL_SECONDS = 60 * 60;

/** The in-memory signed-URL cache refreshes a path once this fraction of
 * its TTL has elapsed, not only once it's fully expired — so a page that's
 * been open a while never serves a URL that's seconds from going dead. */
const CACHE_REFRESH_FRACTION = 0.8;

function extensionOf(file: File): string {
  const dot = file.name.lastIndexOf(".");
  const raw = dot > -1 ? file.name.slice(dot + 1) : "";
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
  return cleaned || "jpg";
}

/** Uploads a Moment photo (already HEIC-converted, same as every other
 * photo upload in this app) into the uploader's own folder —
 * `<user_id>/<uuid>.<ext>`, the path shape the storage policies' INSERT
 * check expects (the folder segment must match the uploader's own
 * auth.uid()). */
export async function uploadMomentFile(
  userId: string,
  file: File,
): Promise<{ path: string | null; error: string | null }> {
  if (!supabase) return { path: null, error: "not configured" };
  const path = `${userId}/${crypto.randomUUID()}.${extensionOf(file)}`;
  const { error } = await supabase.storage
    .from(MOMENT_MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) return { path: null, error: friendlyError(error, UPLOAD_COPY.failed) };
  return { path, error: null };
}

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const urlCache = new Map<string, CacheEntry>();

/** Whether a cached entry is still worth using at `now` — pulled out as
 * its own pure function so the "refresh before the last 20%, not only
 * after full expiry" rule is directly testable without mocking storage or
 * waiting on a real clock. */
export function isCacheEntryFresh(entry: CacheEntry, now: number): boolean {
  return now < entry.expiresAt;
}

/** Splits a batch of paths into what the cache can already answer and
 * what still needs a real `createSignedUrls` call — pure, so the
 * batching behavior (never re-signing something already fresh) is
 * testable on its own. Exported for that test; ordinary callers just want
 * signMomentPaths below. */
export function partitionCachedPaths(
  paths: string[],
  cache: ReadonlyMap<string, CacheEntry>,
  now: number,
): { cached: Map<string, string>; toSign: string[] } {
  const cached = new Map<string, string>();
  const toSign: string[] = [];
  for (const path of paths) {
    const entry = cache.get(path);
    if (entry && isCacheEntryFresh(entry, now)) {
      cached.set(path, entry.url);
    } else {
      toSign.push(path);
    }
  }
  return { cached, toSign };
}

/**
 * Signs a whole batch of Moment-photo paths in one `createSignedUrls`
 * call, backed by the in-memory cache above. A path that's missing or the
 * viewer can no longer read (the storage policy denies it — a private
 * Moment they're no longer allowed to see, a deleted object) is simply
 * absent from the returned map rather than throwing; the caller renders
 * those as unavailable, the same way a stale chat-photo reference already
 * does in Messages.tsx.
 */
export async function signMomentPaths(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return new Map();
  if (!supabase) return new Map();

  const { cached, toSign } = partitionCachedPaths(unique, urlCache, Date.now());
  if (toSign.length === 0) return cached;

  const { data, error } = await supabase.storage
    .from(MOMENT_MEDIA_BUCKET)
    .createSignedUrls(toSign, MOMENT_MEDIA_URL_TTL_SECONDS);
  if (error || !data) return cached;

  const expiresAt = Date.now() + MOMENT_MEDIA_URL_TTL_SECONDS * 1000 * CACHE_REFRESH_FRACTION;
  const result = new Map(cached);
  for (const row of data) {
    // Supabase returns one row per requested path, in order, each either a
    // signedUrl or its own per-path error — a denied/missing path never
    // fails the whole batch.
    if (row.signedUrl && row.path) {
      urlCache.set(row.path, { url: row.signedUrl, expiresAt });
      result.set(row.path, row.signedUrl);
    }
  }
  return result;
}

/**
 * Fills in a Post's display `media`/`mediaUrls` from a batch of already-
 * signed URLs, keyed by storage path — pure, so "a legacy post untouched,
 * a Step-1 post's URLs replaced, a path the signing call couldn't resolve
 * just drops out" is directly testable without a real signing round trip.
 * A post with no `mediaPaths` at all (legacy — still reading `media_url`/
 * `media_urls` from the row directly) is returned unchanged; this only
 * ever touches a post that Step 1 actually uploaded.
 */
export function resolvePostMedia(post: Post, signedByPath: ReadonlyMap<string, string>): Post {
  if (!post.mediaPaths || post.mediaPaths.length === 0) return post;
  const mediaUrls = post.mediaPaths.map((p) => signedByPath.get(p)).filter((u): u is string => !!u);
  return { ...post, media: mediaUrls[0] ?? "", mediaUrls };
}

/** Best-effort delete of Moment-photo storage objects — called after a
 * Moment's row is deleted, or when a photo is replaced. Never throws: the
 * row is already gone (or already repointed) either way, so a delete
 * failure here just leaves an orphaned object rather than blocking
 * anything the person is waiting on. */
export async function deleteMomentFiles(paths: string[]): Promise<void> {
  if (!supabase || paths.length === 0) return;
  for (const path of paths) urlCache.delete(path);
  await supabase.storage.from(MOMENT_MEDIA_BUCKET).remove(paths);
}
