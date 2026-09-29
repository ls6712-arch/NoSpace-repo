/**
 * Pure logic for scripts/backfill-moment-media.ts, pulled out on its own so
 * "which legacy rows are eligible, and what path do they migrate to" is
 * testable without a real Supabase project or storage bucket.
 */

/** Pulls the storage path back out of a `getPublicUrl()`-shaped URL for the
 * given bucket — the inverse of how post-media uploads built their public
 * URL in the first place. Returns null for anything that isn't actually an
 * object in that bucket (an external URL, a data: URI, or the plain
 * generated-placeholder-art URL a wordless capture used instead of a real
 * photo) — the backfill leaves those alone rather than guessing at a path
 * that was never uploaded anywhere. */
export function extractStoragePath(url: string, bucket: string): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = url.slice(idx + marker.length);
  return path || null;
}

export interface LegacyMediaRow {
  media_url: string | null;
  media_urls: string[] | null;
}

/**
 * The ordered list of `bucket` storage paths a legacy post's photos live
 * at — same display order ContentContext.tsx's own rowToPost already uses
 * (`media_urls ?? [media_url]`) — or null when the row isn't a clean set of
 * real uploads to that bucket at all (no media, or a generated-placeholder-
 * art URL rather than an uploaded photo). A row this returns null for is
 * left on its legacy columns untouched: nulling media_url/media_urls for a
 * wordless capture with no real file behind it would delete its only
 * display reference for nothing.
 */
export function legacyMediaPaths(row: LegacyMediaRow, bucket: string): string[] | null {
  const urls = row.media_urls ?? (row.media_url ? [row.media_url] : []);
  if (urls.length === 0) return null;
  const paths = urls.map((u) => extractStoragePath(u, bucket));
  if (paths.some((p) => !p)) return null;
  return paths as string[];
}

/** True for a path ending .heic/.heif, case-insensitively — the shape
 * every pre-HEIC-conversion upload left behind (a handful of posts from
 * before ContentContext.tsx started running every pick through
 * convertHeicIfNeeded). Chrome, Firefox and Android can't decode these at
 * all — a non-Safari viewer just sees the illustration fallback instead of
 * the photo, migration or not. */
export function isHeicPath(path: string): boolean {
  return /\.(heic|heif)$/i.test(path);
}

/** Swaps a HEIC/HEIF path's extension for .jpg — the path a converted copy
 * lands at in moment-media. Non-HEIC paths are returned unchanged. */
export function jpegPathFor(path: string): string {
  return isHeicPath(path) ? path.replace(/\.(heic|heif)$/i, ".jpg") : path;
}

export interface LegacyMediaPlanEntry {
  /** Where the object currently lives, in post-media. */
  sourcePath: string;
  /** Where it should land in moment-media — same path for a plain copy,
   * the .heic/.heif extension swapped for .jpg when it needs converting. */
  destPath: string;
  needsConversion: boolean;
}

/**
 * legacyMediaPaths() plus the HEIC decision for each path — the one thing
 * the backfill script actually needs to decide, per file, whether to
 * `storage.copy()` as-is or download-convert-upload as a JPEG. Returns null
 * under the exact same conditions legacyMediaPaths() does (nothing to
 * migrate, or something that was never really an upload to this bucket).
 */
export function planLegacyMedia(row: LegacyMediaRow, bucket: string): LegacyMediaPlanEntry[] | null {
  const paths = legacyMediaPaths(row, bucket);
  if (!paths) return null;
  return paths.map((sourcePath) => ({
    sourcePath,
    destPath: jpegPathFor(sourcePath),
    needsConversion: isHeicPath(sourcePath),
  }));
}
