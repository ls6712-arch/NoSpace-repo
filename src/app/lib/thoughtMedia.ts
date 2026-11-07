/**
 * Photos and videos on thoughts. New ones live in the private moment-media
 * bucket as a path (thoughts.media_path) and are shown through signed links,
 * the way Moment photos are. Thoughts written before that kept a public
 * post-media URL in media_url; those are still read, and cleaned up on delete.
 */

const VIDEO_EXT = /\.(mp4|webm|mov)$/i;

/** A video, from a storage path or a legacy URL (a signed link has a query, so look at the path part). */
export function thoughtMediaIsVideo(pathOrUrl: string | undefined | null): boolean {
  if (!pathOrUrl) return false;
  return VIDEO_EXT.test(pathOrUrl.split("?")[0]);
}

/** The path inside post-media for a legacy public thought URL, or null if it is not one. */
export function legacyPostMediaPath(url: string | undefined | null): string | null {
  if (!url) return null;
  const marker = "/storage/v1/object/public/post-media/";
  const at = url.indexOf(marker);
  if (at === -1) return null;
  const path = decodeURIComponent(url.slice(at + marker.length).split("?")[0]);
  return path && !path.includes("..") ? path : null;
}
