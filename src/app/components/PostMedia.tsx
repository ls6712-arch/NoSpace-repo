import { useState } from "react";
import { GeneratedArt } from "./GeneratedArt";
import { ImageWithFallback } from "./ImageWithFallback";
import { isRealMediaUrl, withFirstFrame } from "../lib/mediaUrl";

/**
 * Renders a post/product's actual uploaded photo or video when there is one
 * (a real https:// URL from Supabase Storage), and falls back to the
 * generated illustration otherwise — seed content and any post made without
 * a real account attached still get the illustrated look.
 *
 * The same fallback also covers a real URL that fails to load — a dead link,
 * a network that can't reach the host, a removed file. Without this, that
 * showed as a blank box or a broken-image glyph; now it degrades the same
 * way "no media at all" already does, so nothing on the page ever shows an
 * empty tile.
 */
export function PostMedia({
  media,
  type = "photo",
  hobbySlug,
  seed,
  className,
  preview,
  width,
  priority,
}: {
  media?: string;
  // "written" behaves exactly like the "photo" default below — there's
  // never a real video to play, so it falls straight to the isRealMedia
  // checks and, having none, on to GeneratedArt.
  type?: "photo" | "video" | "written";
  hobbySlug: string;
  seed: string | number;
  className?: string;
  /** Thumbnail context: no controls, no sound — the tile is a target, not a player. */
  preview?: boolean;
  /** Display width in CSS px, so a resized copy can be served when image transforms are on. */
  width?: number;
  /** Above the fold: load now instead of lazily. */
  priority?: boolean;
}) {
  // The URL that failed, not a flag: the same slot given a different photo gets a fresh try.
  const [failedUrl, setFailedUrl] = useState<string>();
  const failed = failedUrl === media;
  const isRealMedia = !failed && isRealMediaUrl(media);

  if (isRealMedia && type === "video") {
    // No poster image exists, so withFirstFrame makes the browser paint the first frame as the
    // cover, in thumbnails and in the full player alike (otherwise it's blank until played).
    return (
      <video
        src={withFirstFrame(media)}
        controls={!preview}
        muted={preview}
        playsInline
        preload="metadata"
        onError={() => setFailedUrl(media)}
        className={`${className ?? ""} object-cover [background-color:var(--void)]`}
      />
    );
  }

  if (isRealMedia) {
    return (
      <ImageWithFallback
        src={media}
        alt=""
        className={className}
        width={width}
        priority={priority}
        onFail={() => setFailedUrl(media)}
      />
    );
  }

  return <GeneratedArt hobbySlug={hobbySlug} seed={seed} className={className} />;
}
