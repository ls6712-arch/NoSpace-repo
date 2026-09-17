import { useState } from "react";
import { ImagePlus, Pin } from "lucide-react";
import { getHobby, hobbies, subHobbyLabel } from "../data/hobbies";
import { Post } from "../data/posts";
import { useContent } from "../context/ContentContext";
import { PostMedia } from "./PostMedia";
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

/** The card's own dark ink color — the cream card is a deliberate, contained
 * exception to the app's dark surfaces (same pairing the flat illustrations
 * already use), so its text needs to be dark-on-cream, not the page's
 * light-on-dark foreground tokens. Exported so HobbyShelf's Corner tiles,
 * built to the same cream-card treatment, use the identical color rather
 * than a close approximation. */
export const INK = "#3A2A1F";

/** A colored tag per Space, cycling through the brand's warm-hue tokens —
 * same idea as HobbyShelf's book-spine colors. A few Spaces get an explicit
 * color instead of the rotation where one obviously fits (mustard for
 * cooking, green for anything craft-adjacent, plum for travel). Exported so
 * a Corner tile's tag resolves to the same color as this same Space's tag
 * on an All-moments card, instead of keeping a second, separately-hashed
 * mapping that could disagree with this one. */
const TAG_TINTS = [
  "color-mix(in srgb, var(--yellow) 78%, black)",
  "var(--sky-deep)",
  "var(--forest)",
  "var(--coral-deep)",
  "var(--plum)",
];
const TAG_TINT_OVERRIDES: Record<string, string> = {
  "food-cooking": TAG_TINTS[0],
  "art-creative": "var(--forest)",
  "crafts-making": "var(--forest)",
  "travel-adventure": "var(--plum)",
};
export function tagTint(hobbySlug: string) {
  if (TAG_TINT_OVERRIDES[hobbySlug]) return TAG_TINT_OVERRIDES[hobbySlug];
  const idx = hobbies.findIndex((h) => h.slug === hobbySlug);
  return TAG_TINTS[(idx < 0 ? 0 : idx) % TAG_TINTS.length];
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

/**
 * Your Moments, as a small photo-and-caption grid: a colored tag names what
 * each Moment's about, the date sits quietly in the corner, and the caption
 * reads underneath on its own cream card rather than laid over the photo.
 * "Pin a moment" closes out the row as a standing invitation to add another,
 * rather than the grid just stopping.
 *
 * Pinned Moments always sort first, on the owner's own Shelf and on a
 * visitor's view of it alike — the one deliberate exception to "newest
 * first" this grid has, and always visually set apart with a small filled
 * pin badge and a permanent coral edge rather than the hover-only one every
 * other card gets.
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
  const [shown, setShown] = useState(PAGE_SIZE);
  const [pinPickerOpen, setPinPickerOpen] = useState(false);

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
      <div className="grid grid-cols-3 gap-0.5 sm:grid-cols-4">
        {visible.map((post) => {
          const hobby = getHobby(post.hobbySlug);
          // Corner first — the tag should name the specific thing this
          // Moment is about, not the broad Space it lives under, whenever
          // it was actually tagged that specifically. Untagged Moments
          // fall back to the Space name rather than a fabricated Corner.
          const cornerLabel = post.subHobby ? subHobbyLabel(post.subHobby) ?? post.subHobby : hobby?.shortName;
          return (
            <div key={post.id} className="group relative flex h-full">
              <button
                type="button"
                onClick={() => onOpen(post)}
                className="flex h-full w-full text-left"
                aria-label={`Open: ${post.caption.slice(0, 60)}`}
              >
                {/* flex-col + h-full so this actually fills the grid row's
                    height (which CSS Grid already stretches every card to) —
                    without it, a short caption left the card's own cream
                    background shorter than its neighbors', exposing the dark
                    page background in the gap and making the row look ragged.
                    Square corners (not rounded) since cards sit almost flush
                    at a hairline gap — a rounded corner here would leave a
                    small diamond of page background showing at every 4-way
                    junction, which reads as a leftover gap even with a near-
                    zero grid gap. The gap itself stays a sliver rather than
                    zero: at true gap-0, two cream cards with no border between
                    them read as one continuous card, so a short caption on one
                    post visually ran into its neighbor's — enough of a gap to
                    read as separate posts, not enough to look like the old
                    uneven masonry spacing. */}
                <div
                  className={`flex h-full w-full flex-col overflow-hidden border bg-[var(--cream)] transition-colors group-hover:border-[var(--coral-deep)] ${
                    post.pinned ? "border-[var(--coral-deep)]" : "border-transparent"
                  }`}
                  style={{ color: INK }}
                >
                  <div className="relative aspect-square overflow-hidden">
                    <PostMedia
                      media={post.media}
                      type={post.type}
                      hobbySlug={post.hobbySlug}
                      seed={post.id}
                      preview
                      className="h-full w-full object-cover"
                    />
                    {/* A shared flex row (not two independently-absolute spans)
                        so a long Corner label truncates against the date
                        instead of running into it — visible once cards get
                        narrow enough (a 3-up mobile grid, a Pursuit panel's
                        attached-Moments row) that both badges compete for the
                        same width. */}
                    <div className="absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-1.5">
                      <span className="min-w-0 max-w-[65%]">
                        {cornerLabel && (
                          <span
                            className="inline-block max-w-full truncate rounded-full px-2.5 py-1 text-[10px] font-semibold text-white"
                            style={{ backgroundColor: tagTint(post.hobbySlug) }}
                          >
                            {cornerLabel}
                          </span>
                        )}
                      </span>
                      <span
                        className="shrink-0 text-[11px] font-medium text-white"
                        style={{ textShadow: "0 1px 3px rgba(0,0,0,0.45)" }}
                      >
                        {dateLabel(post.createdAt)}
                      </span>
                    </div>
                    {/* A visual marker only — unpinning happens through the
                        same "Pin a moment" picker that added it, not a
                        second interactive control nested inside this card's
                        own open-the-Moment button. */}
                    {post.pinned && (
                      <span
                        className="absolute bottom-2.5 right-2.5 flex size-6 items-center justify-center rounded-full bg-[var(--coral-deep)] text-white shadow"
                        aria-hidden="true"
                      >
                        <Pin className="size-3.5" fill="currentColor" />
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 items-start px-3.5 py-3">
                    <p
                      className="w-full truncate text-sm leading-snug sm:text-base"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {post.caption}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          );
        })}

        {/* Owner-only: a visitor browsing someone else's Shelf has nothing
            to pin here and no reason to be routed toward /create on their
            own account. */}
        {remaining === 0 && editable && (
          <button
            type="button"
            onClick={() => setPinPickerOpen(true)}
            className="flex h-full min-h-32 flex-col items-center justify-center gap-2 border-2 border-dashed border-[var(--hairline)] text-muted-foreground transition-colors hover:border-[var(--coral-deep)] hover:text-foreground"
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
    </div>
  );
}
