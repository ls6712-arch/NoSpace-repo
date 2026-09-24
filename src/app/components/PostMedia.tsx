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
  // "written" behaves exactly like the "photo" default below — there's
  // never a real video to play, so it falls straight to the isRealMedia
  // checks and, having none, on to GeneratedArt.
  type?: "photo" | "video" | "written";
  hobbySlug: string;
  seed: string | number;
  className?: string;
  /** Thumbnail context: no controls, no sound — the tile is a target, not a player. */
  preview?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const isRealMedia = !failed && !!media && /^https?:\/\//.test(media);

  if (isRealMedia && type === "video") {
    // A bare <video> with no poster shows solid black until something
    // triggers a decode — in a thumbnail grid nothing ever does, since
    // preview clips never play. Appending #t=0.1 makes the browser seek to
    // that frame as soon as metadata loads and paint it, the same trick a
    // real poster image would otherwise need a generated thumbnail for.
    const src = preview ? `${media}#t=0.1` : media;
    return (
      <video
        src={src}
        controls={!preview}
        muted={preview}
        playsInline
        preload="metadata"
        onError={() => setFailed(true)}
        className={`${className ?? ""} object-cover [background-color:var(--void)]`}
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
