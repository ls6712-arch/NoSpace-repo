import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ImagePlus, Pin } from "lucide-react";
import { Post } from "../data/posts";
import { useContent } from "../context/ContentContext";
import { PostMedia } from "./PostMedia";
import { MomentFeedOverlay } from "./MomentFeedOverlay";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";

const PAGE_SIZE = 15;

function dateLabel(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** True only for a real, loadable upload — not a generated-art placeholder.
 * Shared shape with HobbyShelf.tsx's own hasRealMedia, kept local here to
 * avoid a cross-import for one line. */
function hasRealMedia(post: Post) {
  return !!post.media && /^https?:\/\//.test(post.media);
}

type Aspect = "landscape" | "portrait" | "standard";

/** Reads a real photo's actual shape so the bento grid can give it a block
 * size based on its content — a wide shot spanning two columns, a portrait
 * shot standing tall — rather than a repeating equal grid. Unknown until
 * the image loads, at which point the grid gently reflows; a video (no
 * cheap way to read its shape without loading the whole file) and any
 * generated-art placeholder both stay "standard" deliberately (see Fix 5:
 * a placeholder never grabs a block size that implies real content). */
function useImageAspect(post: Post): Aspect {
  const [aspect, setAspect] = useState<Aspect>("standard");
  const url = post.type === "photo" && hasRealMedia(post) ? post.media : undefined;

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const ratio = img.naturalWidth / img.naturalHeight;
      if (ratio >= 1.35) setAspect("landscape");
      else if (ratio <= 0.8) setAspect("portrait");
      else setAspect("standard");
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);

  return url ? aspect : "standard";
}

/**
 * Every one of this Shelf's own Moments, pickable to pin or unpin — opened
 * from the grid's own "Pin a moment" tile rather than a new button
 * somewhere else, since that tile already existed as exactly this
 * invitation, just not wired to anything real yet.
 */
function PinPicker({
  open,
  onOpenChange,
  posts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  posts: Post[];
}) {
  const { togglePin } = useContent();
  const [busyId, setBusyId] = useState<number | null>(null);

  const toggle = async (postId: number) => {
    setBusyId(postId);
    await togglePin(postId);
    setBusyId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>Pin your Moments</DialogTitle>
          <DialogDescription>
            Pinned Moments show first on your Shelf, for anyone who visits it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          {posts.map((post) => (
            <button
              key={post.id}
              type="button"
              disabled={busyId === post.id}
              onClick={() => toggle(post.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left transition-colors hover:border-[var(--coral-deep)] disabled:opacity-50"
            >
              <div className="size-11 shrink-0 overflow-hidden rounded-lg">
                <PostMedia
                  media={post.media}
                  type={post.type}
                  hobbySlug={post.hobbySlug}
                  seed={post.id}
                  preview
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="min-w-0 flex-1 truncate text-sm">{post.caption || "Untitled moment"}</span>
              <Pin
                className={`size-4 shrink-0 ${post.pinned ? "text-[var(--coral-deep)]" : "text-muted-foreground"}`}
                fill={post.pinned ? "currentColor" : "none"}
              />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The bento span for one tile. Pinned always gets the hero treatment
 * (real visual hierarchy, per Fix 7) regardless of its own photo's shape;
 * everything else spans by its actual content. */
function spanFor(pinned: boolean, aspect: Aspect): string {
  if (pinned) return "col-span-2 row-span-2";
  if (aspect === "landscape") return "col-span-2 row-span-1";
  if (aspect === "portrait") return "col-span-1 row-span-2";
  return "col-span-1 row-span-1";
}

function MomentTile({
  post,
  onOpenFeed,
  justPublished,
  reduceMotion,
}: {
  post: Post;
  onOpenFeed: () => void;
  justPublished: boolean;
  reduceMotion: boolean;
}) {
  const aspect = useImageAspect(post);
  const tag = post.tags?.[0];

  // A placeholder illustration is never pretending to be a photo: fixed
  // standard size, its own quiet paper-card treatment (caption underneath,
  // not overlaid) rather than sharing the photo tiles' full-bleed one —
  // see Fix 5. Real media always gets the full-bleed bento treatment.
  if (!hasRealMedia(post)) {
    return (
      <button
        type="button"
        onClick={onOpenFeed}
        className="col-span-1 row-span-1 flex h-full flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] text-left transition-colors hover:border-[var(--coral-deep)]"
        aria-label={`Open: ${post.caption.slice(0, 60)}`}
      >
        <div className="relative aspect-[4/3] overflow-hidden">
          <PostMedia
            media={post.media}
            type={post.type}
            hobbySlug={post.hobbySlug}
            seed={post.id}
            preview
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1 px-3.5 py-3">
          <p
            className="line-clamp-2 text-sm leading-snug text-[var(--ink)]"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {post.caption}
          </p>
          <p className="mt-auto text-[11px] text-[var(--ink-faint)]">
            {tag ? `${tag} · ` : ""}
            {dateLabel(post.createdAt)}
          </p>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenFeed}
      className={`group relative h-full overflow-hidden rounded-xl border ${
        post.pinned ? "border-[var(--coral-deep)]" : "border-transparent"
      } ${spanFor(post.pinned ?? false, aspect)}`}
      aria-label={`Open: ${post.caption.slice(0, 60)}`}
    >
      <motion.div
        layout={!reduceMotion}
        // Shared with the composer's own "Saved." screen preview (Log.tsx)
        // and the click-to-feed overlay's lead image — whichever of those
        // is tracked alongside this tile hands its box off here instead of
        // the tile just appearing cold. Skipped under reduced motion.
        layoutId={reduceMotion ? undefined : `moment-${post.id}`}
        {...(!reduceMotion && justPublished
          ? {
              initial: { opacity: 0, scale: 0.85 },
              animate: { opacity: 1, scale: 1 },
              transition: { type: "spring", stiffness: 300, damping: 26 },
            }
          : {})}
        className="absolute inset-0"
      >
        <PostMedia
          media={post.media}
          type={post.type}
          hobbySlug={post.hobbySlug}
          seed={post.id}
          preview
          className="h-full w-full object-cover"
        />
      </motion.div>

      {/* Full-bleed photo, caption on a bottom scrim — bold and oversized
          rather than a fixed strip underneath, since the block itself is no
          longer a fixed shape. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3 text-left sm:p-4">
        <p
          className="text-base italic leading-snug text-white sm:text-lg"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {post.caption.length > 90 ? `${post.caption.slice(0, 90)}…` : post.caption}
        </p>
        <p className="mt-1 text-[11px] text-white/70">
          {tag ? `${tag} · ` : ""}
          {dateLabel(post.createdAt)}
        </p>
      </div>

      {post.pinned && (
        <span
          className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full bg-[var(--coral-deep)] text-white shadow"
          aria-hidden="true"
        >
          <Pin className="size-3.5" fill="currentColor" />
        </span>
      )}
    </button>
  );
}

/**
 * Your Moments, as a genuine bento grid — block size follows the photo's
 * own shape (a wide shot spans two columns, a portrait shot stands tall,
 * most are standard) instead of a repeating equal grid. Pinned Moments get
 * the same hero treatment regardless of shape, the one deliberate exception
 * to "sized by its own content." "Pin a moment" closes out the grid as a
 * standing invitation to add another, rather than the grid just stopping.
 *
 * Tags read from the Moment's own open tags now, in one neutral pill style
 * — no per-Space color, see lib/postTags.ts and TagsField. A photo speaks
 * for itself; the caption and tag are quiet metadata on top of it, not a
 * colored badge claiming a category.
 */
export function WorkGrid({
  posts,
  onOpen,
  emptyLabel,
  editable = false,
}: {
  posts: Post[];
  onOpen: (post: Post) => void;
  emptyLabel: string;
  /** Only the owner can pin/unpin — a visitor's WorkGrid (PublicProfile) still
   * sorts pinned Moments first, it just can't change which ones are. */
  editable?: boolean;
}) {
  const { justPublishedId } = useContent();
  const reduceMotion = !!useReducedMotion();
  const [shown, setShown] = useState(PAGE_SIZE);
  const [pinPickerOpen, setPinPickerOpen] = useState(false);
  const [feedIndex, setFeedIndex] = useState<number | null>(null);

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  // Stable sort: pinned first, everything else keeps the order it arrived
  // in (newest first, from the caller).
  const ordered = [...posts].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  const visible = ordered.slice(0, shown);
  const remaining = ordered.length - visible.length;

  return (
    <div>
      <div className="grid auto-rows-[130px] grid-cols-2 gap-2 sm:auto-rows-[160px] sm:grid-cols-3 lg:auto-rows-[190px] lg:grid-cols-4 [grid-auto-flow:dense]">
        {visible.map((post, i) => (
          <MomentTile
            key={post.id}
            post={post}
            onOpenFeed={() => setFeedIndex(i)}
            justPublished={post.id === justPublishedId}
            reduceMotion={reduceMotion}
          />
        ))}

        {/* Owner-only: a visitor browsing someone else's Shelf has nothing
            to pin here and no reason to be routed toward /create on their
            own account. */}
        {remaining === 0 && editable && (
          <button
            type="button"
            onClick={() => setPinPickerOpen(true)}
            className="col-span-1 row-span-1 flex h-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--line,var(--hairline))] text-muted-foreground transition-colors hover:border-[var(--coral-deep)] hover:text-foreground"
          >
            <ImagePlus className="size-5" strokeWidth={1.7} />
            <span className="text-sm font-medium">Pin a moment</span>
          </button>
        )}
      </div>

      {remaining > 0 && (
        <div className="mt-4 text-center">
          <Button variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE_SIZE)}>
            Show more
          </Button>
        </div>
      )}

      {editable && <PinPicker open={pinPickerOpen} onOpenChange={setPinPickerOpen} posts={posts} />}

      <MomentFeedOverlay
        posts={visible}
        leadIndex={feedIndex}
        onClose={() => setFeedIndex(null)}
        onOpenDetail={(post) => {
          setFeedIndex(null);
          onOpen(post);
        }}
      />
    </div>
  );
}
