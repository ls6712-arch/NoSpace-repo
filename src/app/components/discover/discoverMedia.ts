import { Post } from "../../data/posts";

/**
 * A post's media counts as "real" when it's an actual uploaded https:// URL
 * rather than a missing/failed photo falling back to generated art — the
 * same test PostMedia.tsx and PostMediaCarousel.tsx already each make
 * locally. Used by PhotoCard/VideoCard to pick a cover image and fall back
 * to GeneratedArt — not to classify a Moment as Photo/Video/Written
 * anymore; Post.type is authoritative for that (see data/posts.ts and
 * ContentContext.tsx's NewPostInput).
 */
export function isRealMediaUrl(url?: string): boolean {
  return !!url && /^https?:\/\//.test(url);
}

export function realMediaUrls(post: Post): string[] {
  const urls = post.mediaUrls?.length ? post.mediaUrls : post.media ? [post.media] : [];
  return urls.filter(isRealMediaUrl);
}

export function hasRealMedia(post: Post): boolean {
  return realMediaUrls(post).length > 0;
}

export type MediaFilter = "all" | "photo" | "video" | "written";

export function matchesMediaFilter(post: Post, filter: MediaFilter): boolean {
  return filter === "all" || post.type === filter;
}
