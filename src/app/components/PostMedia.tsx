import { useState } from "react";
import { GeneratedArt } from "./GeneratedArt";

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
}: {
  media?: string;
  type?: "photo" | "video";
  hobbySlug: string;
  seed: string | number;
  className?: string;
  /** Thumbnail context: no controls, no sound — the tile is a target, not a player. */
  preview?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const isRealMedia = !failed && !!media && /^https?:\/\//.test(media);

  if (isRealMedia && type === "video") {
    return (
      <video
        src={media}
        controls={!preview}
        muted={preview}
        playsInline
        preload="metadata"
        onError={() => setFailed(true)}
        className={`${className ?? ""} object-cover [background-color:var(--forest-ink)]`}
      />
    );
  }

  if (isRealMedia) {
    return (
      <img
        src={media}
        alt=""
        className={`${className ?? ""} object-cover`}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  return <GeneratedArt hobbySlug={hobbySlug} seed={seed} className={className} />;
}
