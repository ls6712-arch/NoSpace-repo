import { Post } from "../../data/posts";

/**
 * A post's media counts as "real" when it's an actual uploaded https:// URL
 * rather than a missing/failed photo falling back to generated art — the
 * same test PostMedia.tsx and PostMediaCarousel.tsx already each make
 * locally. Shared here so the masonry cards and the Photos/Video/Written
 * filter agree with what a card actually renders.
 *
 * There is no "written" post type in the schema (Post.type is only "photo"
 * | "video" — see data/posts.ts) and this branch isn't adding one. "Written"
 * is derived instead: a Moment with no real uploaded photo or video is, in
 * practice, a caption carried by an illustration rather than a photo of the
 * thing itself, which is what QuoteCard is for.
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
  if (filter === "all") return true;
  if (filter === "written") return !hasRealMedia(post);
  return post.type === filter && hasRealMedia(post);
}
