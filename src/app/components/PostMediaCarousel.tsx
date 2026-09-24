import { useRef, useState } from "react";
import { Images } from "lucide-react";
import { GeneratedArt } from "./GeneratedArt";

const isRealUrl = (url?: string) => !!url && /^https?:\/\//.test(url);

/**
 * Drop-in replacement for PostMedia that also handles a Moment carrying more
 * than one photo (see sql/social.sql's media_urls, Post.mediaUrls). A single
 * photo, or a video (always single-item), render exactly like PostMedia
 * always has — no carousel chrome, same DOM shape, so nothing that only ever
 * had one photo looks any different.
 *
 * 2+ photos in a full view (preview unset) get a horizontal snap-scroll
 * track with a "current/total" counter and dot indicators. In a grid/tile
 * context (preview) they collapse to the first photo plus a small stack
 * icon + count badge, Instagram's own convention for the same thing — no
 * swipe interaction inside a tile that small.
 */
export function PostMediaCarousel({
  media,
  type = "photo",
  hobbySlug,
  seed,
  className,
  preview,
}: {
  media: string[];
  // "written" is treated the same as "photo" below — a written Moment
  // never has a real video, so it just falls through to the photo/
  // GeneratedArt branches like any other media-less post.
  type?: "photo" | "video" | "written";
  hobbySlug: string;
  seed: string | number;
  className?: string;
  /** Thumbnail context: no controls, no sound, no swipe — the tile is a target, not a player. */
  preview?: boolean;
}) {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const markFailed = (url: string) => setFailedUrls((prev) => new Set(prev).add(url));

  // Same degrade-to-illustration rule as PostMedia: a dead link, an
  // unreachable host, or a removed file is treated the same as no photo at
  // all, rather than showing a broken-image glyph or an empty slide.
  const validUrls = media.filter((url) => isRealUrl(url) && !failedUrls.has(url));

  if (validUrls.length === 0) {
    return <GeneratedArt hobbySlug={hobbySlug} seed={seed} className={className} />;
  }

  if (type === "video") {
    // Videos stay single-item, unchanged — never mixed with photos in one Moment.
    const url = validUrls[0];
    return (
      <video
        src={url}
        controls={!preview}
        muted={preview}
        playsInline
        preload="metadata"
        onError={() => markFailed(url)}
        className={`${className ?? ""} object-cover [background-color:var(--void)]`}
      />
    );
  }

  if (validUrls.length === 1) {
    const url = validUrls[0];
    return (
      <img
        src={url}
        alt=""
        className={`${className ?? ""} object-cover`}
        loading="lazy"
        onError={() => markFailed(url)}
      />
    );
  }

  if (preview) {
    const cover = validUrls[0];
    return (
      <div className={`relative ${className ?? ""}`}>
        <img
          src={cover}
          alt=""
          loading="lazy"
          onError={() => markFailed(cover)}
          className="h-full w-full object-cover"
        />
        <span className="pointer-events-none absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-[var(--void)]/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          <Images className="size-3" aria-hidden="true" />
          {validUrls.length}
        </span>
      </div>
    );
  }

  return <PhotoTrack urls={validUrls} className={className} onError={markFailed} />;
}

function PhotoTrack({
  urls,
  className,
  onError,
}: {
  urls: string[];
  className?: string;
  onError: (url: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollToIndex = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  // Tracks which slide is centered as the person swipes, rather than only
  // updating on a click — a real thumb-drag never fires onClick.
  const handleScroll = () => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {urls.map((url, i) => (
          <img
            key={url + i}
            src={url}
            alt=""
            loading={i === 0 ? "eager" : "lazy"}
            onError={() => onError(url)}
            className="h-full w-full shrink-0 snap-center object-cover"
          />
        ))}
      </div>

      <span className="pointer-events-none absolute right-2.5 top-2.5 rounded-full bg-[var(--void)]/60 px-2 py-0.5 text-[11px] text-white backdrop-blur-sm">
        {index + 1}/{urls.length}
      </span>

      <div className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
        {urls.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Photo ${i + 1} of ${urls.length}`}
            aria-current={i === index}
            onClick={() => scrollToIndex(i)}
            className={`pointer-events-auto h-1.5 rounded-full transition-all ${
              i === index ? "w-4 bg-white" : "w-1.5 bg-white/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
