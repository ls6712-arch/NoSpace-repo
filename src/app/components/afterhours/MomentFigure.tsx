import { motion } from "motion/react";
import { ImageWithFallback } from "../ImageWithFallback";
import { GeneratedArt } from "../GeneratedArt";
import { MomentMedia, hasRealMedia } from "../MomentCard";
import type { Post } from "../../data/posts";
import { PRESS_SCALE, springs } from "../../lib/springs";

/**
 * A Moment as a plate in a magazine: the photograph on its own, then the
 * caption in italic serif and the maker in small type underneath. Nothing sits
 * on the photo. Tapping opens the Moment, where reacting and saving live.
 * Videos and written Moments reuse MomentMedia so they look the same as
 * everywhere else.
 */
export function MomentFigure({
  post,
  onOpen,
  aspect = "aspect-[4/5]",
  className = "",
  priority = false,
  large = false,
  bleed = false,
}: {
  post: Post;
  onOpen: () => void;
  aspect?: string;
  className?: string;
  priority?: boolean;
  /** The lead plate: a larger caption. */
  large?: boolean;
  /** Edge to edge on a phone: no side margin or rounding below sm; the caption keeps its own. */
  bleed?: boolean;
}) {
  const photo = hasRealMedia(post) && post.type !== "video";
  const written = !hasRealMedia(post);
  const src = post.mediaUrls?.[0] ?? post.media;

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileTap={{ scale: PRESS_SCALE }}
      transition={springs.press}
      className={`group block w-full text-left ${className}`}
    >
      <div className={`relative overflow-hidden bg-surface-muted ${bleed ? "rounded-none sm:rounded-control" : "rounded-control"} ${aspect}`}>
        {photo ? (
          <ImageWithFallback
            src={src}
            alt=""
            width={large ? 1200 : 640}
            priority={priority}
            className="absolute inset-0 size-full"
            imgClassName="transition-transform duration-base ease-standard group-hover:scale-[1.02]"
            fallback={<GeneratedArt hobbySlug={post.hobbySlug} seed={post.id} className="size-full" />}
          />
        ) : (
          <div className="pointer-events-none absolute inset-0 [&>*]:!aspect-auto [&>*]:!h-full [&>*]:!rounded-none">
            <MomentMedia post={post} />
          </div>
        )}
      </div>
      {!written && post.caption && (
        <p
          className={`mt-3 line-clamp-3 italic leading-snug text-foreground ${bleed ? "px-4 sm:px-0" : ""} ${large ? "text-title" : "text-lead"}`}
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {post.caption}
        </p>
      )}
      <p className={`mt-1 text-small text-muted-foreground ${bleed ? "px-4 sm:px-0" : ""}`}>{post.creator}</p>
    </motion.button>
  );
}
