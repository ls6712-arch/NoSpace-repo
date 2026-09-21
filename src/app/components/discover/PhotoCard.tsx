import { useState } from "react";
import { Post } from "../../data/posts";
import { GeneratedArt } from "../GeneratedArt";
import { PostBookmark } from "../PostBookmark";
import { realMediaUrls } from "./discoverMedia";
import { CardActions, CardByline, CornerChip } from "./DiscoverCardChrome";

/**
 * Masonry's photo tile. Unlike ContentCard's fixed aspect-square (a uniform
 * shelf, by design — see ContentCard.tsx's own comment on CARD_ASPECT), a
 * real uploaded photo here renders at its own natural height (`h-auto`):
 * the whole point of a Pinterest-style column layout is tiles that don't
 * all match, and column heights are meant to vary with what's actually in
 * the photo.
 *
 * A post with no real photo (seed content, or an upload that failed) falls
 * back to GeneratedArt — which fills whatever box it's given rather than
 * sizing itself (it layers absolutely-positioned artwork over the whole
 * container), so that one case keeps a fixed aspect ratio instead of
 * collapsing to zero height.
 */
export function PhotoCard({ post }: { post: Post }) {
  const urls = realMediaUrls(post);
  const [failed, setFailed] = useState(false);
  const cover = failed ? undefined : urls[0];
  const extra = cover ? urls.length - 1 : 0;

  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative overflow-hidden">
        {cover ? (
          <img
            src={cover}
            alt=""
            loading="lazy"
            onError={() => setFailed(true)}
            className="block h-auto w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          // Same degrade-to-illustration rule as PostMedia.tsx: no real
          // photo, or a real one that failed to load (dead link,
          // unreachable host, removed file), ends up here rather than a
          // broken-image glyph or a collapsed, zero-height tile.
          <GeneratedArt hobbySlug={post.hobbySlug} seed={post.id} className="aspect-[4/5] w-full" />
        )}
        {extra > 0 && (
          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-[var(--void)]/60 px-2 py-0.5 text-[11px] text-white backdrop-blur-sm">
            +{extra} more
          </span>
        )}
        <PostBookmark postId={post.id} />
      </div>
      <div className="p-4">
        <CardByline post={post} />
        {/* Full caption, no line-clamp — masonry column heights are meant
            to vary with how much someone actually wrote. */}
        <p className="mb-3 text-sm text-muted-foreground">{post.caption}</p>
        <CornerChip post={post} />
        <CardActions post={post} />
      </div>
    </div>
  );
}
