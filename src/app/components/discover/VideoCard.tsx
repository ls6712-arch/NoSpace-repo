import { useState } from "react";
import { Play } from "lucide-react";
import { Post } from "../../data/posts";
import { GeneratedArt } from "../GeneratedArt";
import { PostBookmark } from "../PostBookmark";
import { realMediaUrls } from "./discoverMedia";
import { CardActions, CardByline, CornerChip } from "./DiscoverCardChrome";

/**
 * Masonry's video tile. Sized like PhotoCard — `h-auto`, to the thumbnail's
 * own aspect ratio, not a fixed 16:9/4:5 — because a uniform ratio across
 * every tile is exactly what was flattening the masonry into a plain grid.
 *
 * The tradeoff that trades for: a real <video> has no known height until
 * its metadata loads (it paints at 0×0 until then, same as an <img> before
 * its first byte), so this tile's column briefly reflows once that arrives
 * — accepted rather than worked around with a locked ratio, since the
 * whole point of this layout is tiles sized by their actual content.
 * `preload="metadata"` keeps that window short (only the header downloads,
 * not the clip). GeneratedArt is the one exception that keeps a fixed
 * aspect ratio, same reason PhotoCard's fallback does: it fills whatever
 * box it's given rather than sizing itself.
 *
 * The play overlay is ContentCard's existing badge (see ContentCard.tsx),
 * reused as-is. A duration badge is not: Post carries no duration field
 * (data/posts.ts) and nothing else in this codebase computes one, so
 * rendering one here would mean inventing data rather than reading it —
 * flagged as a gap rather than added.
 */
export function VideoCard({ post }: { post: Post }) {
  const [failed, setFailed] = useState(false);
  const url = failed ? undefined : realMediaUrls(post)[0];

  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative overflow-hidden">
        {url ? (
          // #t=0.1 seeks the still frame the same way PostMedia.tsx's
          // preview mode does, so a video tile isn't solid black until
          // something (nothing, in a static grid) triggers a decode.
          <video
            src={`${url}#t=0.1`}
            muted
            playsInline
            preload="metadata"
            onError={() => setFailed(true)}
            className="block h-auto w-full object-cover transition-transform duration-500 group-hover:scale-105 [background-color:var(--void)]"
          />
        ) : (
          <GeneratedArt hobbySlug={post.hobbySlug} seed={post.id} className="aspect-[4/5] w-full" />
        )}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--void)]/25">
          <span className="flex size-12 items-center justify-center rounded-full bg-[var(--void)]/55 backdrop-blur-md">
            <Play className="size-5 fill-white text-white" />
          </span>
        </div>
        <PostBookmark postId={post.id} />
      </div>
      <div className="p-4">
        <CardByline post={post} />
        <p className="mb-3 text-sm text-muted-foreground">{post.caption}</p>
        <CornerChip post={post} />
        <CardActions post={post} />
      </div>
    </div>
  );
}
