import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Heart, Play } from "lucide-react";
import type { Post } from "../../data/posts";
import { PostMediaCarousel } from "../PostMediaCarousel";
import { exit, pop } from "../../lib/motionTokens";

export const hasRealMedia = (post: Pick<Post, "media">) => !!post.media && /^https?:\/\//.test(post.media);

/** Deterministic, so the same Moment always gets the same tile color on every surface. */
const TILE_TOKENS = [
  { bg: "var(--accent)", fg: "var(--accent-foreground)" },
  { bg: "var(--moment-tile-moss)", fg: "var(--moment-tile-moss-foreground)" },
  { bg: "var(--moment-tile-ink)", fg: "var(--moment-tile-ink-foreground)" },
] as const;

export function tileTokenFor(postId: number | string) {
  const n = typeof postId === "number" ? postId : [...postId].reduce((a, c) => a + c.charCodeAt(0), 0);
  // A stand-in id that is not a finite number must not index past the palette.
  return TILE_TOKENS[Number.isFinite(n) ? Math.abs(Math.trunc(n)) % TILE_TOKENS.length : 0];
}

/** The square older grids and their skeletons share. */
export const MOMENT_MEDIA = "aspect-square w-full rounded-card";

/** Words set into a text-only Moment's colored tile. Clamped so a long one never changes the tile's shape. */
export const TILE_CAPTION = "line-clamp-5 text-center italic text-lead leading-[1.2]";

const DOUBLE_TAP_MS = 300;
const MAX_ZOOM = 3;

const distance = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

/**
 * Pinch to zoom: two fingers scale the media where it sits, and it springs
 * back when they lift. Listens natively, since the page must not scroll or
 * zoom while two fingers are down (React's touch listeners are passive).
 */
function usePinchZoom(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let start = 0;
    let origin = { x: 0, y: 0 };
    const reset = () => {
      start = 0;
      el.style.transition = "transform var(--duration-base) var(--ease-standard)";
      el.style.transform = "";
      el.style.zIndex = "";
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      start = distance(e.touches[0], e.touches[1]);
      origin = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 };
      const box = el.getBoundingClientRect();
      el.style.transformOrigin = `${origin.x - box.left}px ${origin.y - box.top}px`;
      el.style.transition = "none";
      el.style.zIndex = "30";
    };
    const onMove = (e: TouchEvent) => {
      if (!start || e.touches.length !== 2) return;
      e.preventDefault();
      const scale = Math.max(1, Math.min(MAX_ZOOM, distance(e.touches[0], e.touches[1]) / start));
      const x = (e.touches[0].clientX + e.touches[1].clientX) / 2 - origin.x;
      const y = (e.touches[0].clientY + e.touches[1].clientY) / 2 - origin.y;
      el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    };
    const onEnd = () => {
      if (start) reset();
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled]);
  return ref;
}

/** The play badge every video carries until it is playing. */
export function PlayBadge({ small = false }: { small?: boolean }) {
  if (small) {
    return (
      <span className="pointer-events-none absolute right-1.5 top-1.5 flex text-on-media icon-halo" data-play-badge aria-hidden="true">
        <Play className="size-[18px]" fill="currentColor" strokeWidth={0} />
      </span>
    );
  }
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center" data-play-badge aria-hidden="true">
      <span className="flex size-14 items-center justify-center rounded-full bg-scrim-solid/55 text-on-media">
        <Play className="size-6 translate-x-0.5" fill="currentColor" strokeWidth={0} />
      </span>
    </span>
  );
}

/**
 * A Moment's media, the same on every surface: the photo carousel, a video
 * with its play badge, or a colored tile with the words set into it.
 *
 * - A single tap on a photo does nothing. A double tap loves it (never
 *   un-loves), with a heart over the photo.
 * - Two fingers zoom it in place.
 * - A tap on a video plays or pauses it.
 */
export function MomentMedia({
  post,
  aspect = "aspect-[4/3]",
  full = false,
  priority = false,
  onDoubleTap,
  className = "",
}: {
  post: Post;
  /** The frame's shape: 4:3 in a feed, square in the Moment itself. */
  aspect?: string;
  /** The Moment itself, where the photo is the point: full size, loaded now. */
  full?: boolean;
  priority?: boolean;
  /** Love it. Left out on your own Moment. Returns whether it was newly loved. */
  onDoubleTap?: () => boolean | void;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const tile = useMemo(() => tileTokenFor(post.id), [post.id]);
  const real = hasRealMedia(post);
  const video = real && post.type === "video";
  const zoom = usePinchZoom(real && !video);
  const [burst, setBurst] = useState(0);
  const [playing, setPlaying] = useState(false);
  const lastTap = useRef(0);
  const frame = useRef<HTMLDivElement>(null);

  const onTap = () => {
    if (video) {
      const el = frame.current?.querySelector("video");
      if (!el) return;
      if (el.paused) {
        // A tap is the person asking for it, sound included.
        el.muted = false;
        void el.play().catch(() => undefined);
      }
      else el.pause();
      return;
    }
    if (!onDoubleTap) return;
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      onDoubleTap();
      if (!reduceMotion) setBurst((n) => n + 1);
    } else {
      lastTap.current = now;
    }
  };

  // The badge follows the video itself, so it is right however playback starts or stops.
  useEffect(() => {
    if (!video) return;
    const el = frame.current?.querySelector("video");
    if (!el) return;
    const on = () => setPlaying(true);
    const off = () => setPlaying(false);
    el.addEventListener("play", on);
    el.addEventListener("pause", off);
    el.addEventListener("ended", off);
    return () => {
      el.removeEventListener("play", on);
      el.removeEventListener("pause", off);
      el.removeEventListener("ended", off);
    };
  }, [video, post.id]);

  useEffect(() => {
    if (!burst) return;
    const t = window.setTimeout(() => setBurst(0), 650);
    return () => window.clearTimeout(t);
  }, [burst]);

  const shape = `${aspect} w-full rounded-card`;

  if (!real) {
    return (
      <div
        data-moment-media="words"
        className={`${shape} flex items-center justify-center overflow-hidden p-[9%] ${className}`}
        style={{ background: tile.bg, color: tile.fg }}
      >
        <p className={TILE_CAPTION} style={{ fontFamily: "var(--font-body)" }}>
          {post.caption}
        </p>
      </div>
    );
  }

  return (
    <div ref={frame} data-moment-media={video ? "video" : "photo"} className={`relative ${className}`} onClick={onTap}>
      <div ref={zoom} className="relative touch-pan-x touch-pan-y">
        <PostMediaCarousel
          media={post.mediaUrls?.length ? post.mediaUrls : [post.media]}
          type={post.type}
          hobbySlug={post.hobbySlug}
          seed={post.id}
          width={full ? undefined : 640}
          priority={full || priority}
          // The feed plays a video from a tap on it; the browser's own bar would sit under the badge.
          preview={video}
          className={`${shape} overflow-hidden object-cover`}
        />
      </div>
      {video && !playing && <PlayBadge />}
      <AnimatePresence>
        {burst > 0 && (
          <motion.span
            key={burst}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1, transition: pop }}
            exit={{ opacity: 0, transition: exit }}
          >
            <Heart className="size-20 icon-halo" style={{ color: "var(--accent-text)" }} fill="currentColor" strokeWidth={0} />
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
