import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { Post } from "../data/posts";
import { useContent } from "../context/ContentContext";
import { MomentCard, MomentCardSurface } from "./MomentCard";
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

function monthKey(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: "long", year: "numeric" });
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
            Pinned Moments show first on your Shelf, as the wide lead card, for anyone who visits it.
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
              <span className={`text-xs ${post.pinned ? "text-[var(--coral-deep)]" : "text-muted-foreground"}`}>
                {post.pinned ? "Pinned" : "Pin"}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Your Moments (or, on a visitor's read of `PublicProfile`, someone else's
 * public ones), built from the shared `MomentCard` (docs/moment-card-and-
 * reactions-spec.md §2) instead of this grid's own bespoke tiles. A pinned
 * Moment is always the wide lead card up top, ungrouped; everything else
 * follows month by month (board 1), newest first, in a plain responsive
 * grid at standard size. "Pin a moment" closes out the last month's grid
 * as a standing invitation to add another.
 *
 * Still simpler than board 1 in one way: no click-through "quiet read"
 * feed — a card's own media now opens `MomentDetail` directly via `onOpen`,
 * the same one-open-affordance MomentCard already gives every other
 * surface.
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

  const lead = visible[0]?.pinned ? visible[0] : null;
  const rest = lead ? visible.slice(1) : visible;
  const surface: MomentCardSurface = editable ? "you" : "profile";

  // Grouped by month, newest first — board 1's Shelf. The lead pinned card
  // above is deliberately left out of this grouping: it's always first,
  // regardless of when it was made.
  const byMonth: { month: string; items: Post[] }[] = [];
  for (const post of rest) {
    const key = monthKey(post.createdAt);
    const last = byMonth[byMonth.length - 1];
    if (last && last.month === key) last.items.push(post);
    else byMonth.push({ month: key, items: [post] });
  }
  const lastMonthIndex = byMonth.length - 1;

  return (
    <div>
      {lead && (
        <div className="mb-8">
          <MomentCard post={lead} surface={surface} size="wide" onOpen={() => onOpen(lead)} />
        </div>
      )}

      <div className="space-y-8">
        {byMonth.map(({ month, items }, i) => (
          <section key={month}>
            <div className="mb-4 flex items-center gap-3">
              <span className="ns-section-kicker text-muted-foreground">{month}</span>
              <span className="h-px flex-1 bg-[var(--line,var(--hairline))]" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((post) => (
                <MomentCard
                  key={post.id}
                  post={post}
                  surface={surface}
                  size="standard"
                  onOpen={() => onOpen(post)}
                />
              ))}

              {/* Owner-only: a visitor browsing someone else's Shelf has
                  nothing to pin here and no reason to be routed toward
                  /create on their own account. Appended to the last
                  month's grid rather than a section of its own. */}
              {i === lastMonthIndex && remaining === 0 && editable && (
                <button
                  type="button"
                  onClick={() => setPinPickerOpen(true)}
                  className="flex h-[220px] flex-col items-center justify-center gap-2 rounded-[var(--radius-moment)] border-2 border-dashed border-[var(--line,var(--hairline))] text-muted-foreground transition-colors hover:border-[var(--coral-deep)] hover:text-foreground sm:h-[320px]"
                >
                  <ImagePlus className="size-5" strokeWidth={1.7} />
                  <span className="text-sm font-medium">Pin a moment</span>
                </button>
              )}
            </div>
          </section>
        ))}

        {/* Nothing left but the pinned lead card — still needs somewhere
            to offer "Pin a moment" when there's no month section to
            append it to. */}
        {byMonth.length === 0 && remaining === 0 && editable && (
          <button
            type="button"
            onClick={() => setPinPickerOpen(true)}
            className="flex h-[220px] w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-moment)] border-2 border-dashed border-[var(--line,var(--hairline))] text-muted-foreground transition-colors hover:border-[var(--coral-deep)] hover:text-foreground sm:h-[320px]"
          >
            <ImagePlus className="size-5" strokeWidth={1.7} />
            <span className="text-sm font-medium">Pin a moment</span>
          </button>
        )}
      </div>

      {remaining > 0 && (
        <div className="mt-6 text-center">
          <Button variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE_SIZE)}>
            Turn the page
          </Button>
        </div>
      )}

      {editable && (
        <PinPicker
          open={pinPickerOpen}
          onOpenChange={setPinPickerOpen}
          posts={posts.filter((p) => !p.isPrivateLog)}
        />
      )}
    </div>
  );
}
