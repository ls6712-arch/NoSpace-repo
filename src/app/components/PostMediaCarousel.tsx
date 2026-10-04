import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Images } from "lucide-react";
import { GeneratedArt } from "./GeneratedArt";
import { scrollBehavior } from "../lib/scrollToElement";
import { ImageWithFallback } from "./ImageWithFallback";

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
  width,
  priority,
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
  /** Display width in CSS px, so resized copies can be served when image transforms are on. */
  width?: number;
  /** Above the fold: the first photo loads now instead of lazily. */
  priority?: boolean;
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
    return <ImageWithFallback src={url} alt="" className={className} width={width} priority={priority} onFail={() => markFailed(url)} />;
  }

  if (preview) {
    const cover = validUrls[0];
    return (
      <div className={`relative ${className ?? ""}`}>
        <ImageWithFallback src={cover} alt="" className="size-full" width={width} priority={priority} onFail={() => markFailed(cover)} />
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-control bg-scrim-solid/60 px-1.5 py-0.5 text-caption font-medium text-on-media backdrop-blur-sm">
          <Images className="size-3" aria-hidden="true" />
          {validUrls.length}
        </span>
      </div>
    );
  }

  return <PhotoTrack urls={validUrls} className={className} width={width} priority={priority} onError={markFailed} />;
}

function PhotoTrack({
  urls,
  className,
  width,
  priority,
  onError,
}: {
  urls: string[];
  className?: string;
  width?: number;
  priority?: boolean;
  onError: (url: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const next = Math.max(0, Math.min(urls.length - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: scrollBehavior() });
  };

  // Which slide is centred as the thumb drags: read once per frame (a scroll
  // event fires far more often than that), and only re-render when it changes.
  const handleScroll = () => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const el = trackRef.current;
      if (!el || el.clientWidth === 0) return;
      setIndex(Math.round(el.scrollLeft / el.clientWidth));
    });
  };

  const label = `Photo ${index + 1} of ${urls.length}`;

  return (
    <div className={`relative ${className ?? ""}`} role="group" aria-roledescription="carousel" aria-label="Photos">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        tabIndex={0}
        aria-label={label}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-none [-ms-overflow-style:none] [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--coral-deep)] [&::-webkit-scrollbar]:hidden"
      >
        {urls.map((url, i) => (
          <div key={url + i} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${urls.length}`} className="size-full shrink-0 snap-center snap-always">
            <ImageWithFallback src={url} alt="" className="size-full" width={width} priority={priority && i === 0} onFail={() => onError(url)} />
          </div>
        ))}
      </div>

      {/* Announced as the photo changes; the visible "2/5" is the same thing, so it's hidden from readers. */}
      <span role="status" className="sr-only">
        {label}
      </span>
      <span aria-hidden="true" className="pointer-events-none absolute bottom-2.5 right-2.5 rounded-control bg-scrim-solid/60 px-2 py-0.5 text-caption text-on-media backdrop-blur-sm">
        {index + 1}/{urls.length}
      </span>

      {/* Dots show where you are; swipe, the arrow keys or the arrows (mouse) move. They aren't buttons:
          6px targets 12px apart can't each have a 44px hit area. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
        {urls.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-[width,background-color] duration-fast ease-standard ${i === index ? "w-4 bg-on-media" : "w-1.5 bg-on-media/50"}`}
          />
        ))}
      </div>

      {index > 0 && (
        <button type="button" aria-label="Previous photo" onClick={() => goTo(index - 1)} className="absolute left-2 top-1/2 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full transition-colors text-on-media backdrop-blur-sm pointer-fine:flex">
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
      )}
      {index < urls.length - 1 && (
        <button type="button" aria-label="Next photo" onClick={() => goTo(index + 1)} className="absolute right-2 top-1/2 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-scrim-solid/50 text-on-media backdrop-blur-sm pointer-fine:flex">
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
