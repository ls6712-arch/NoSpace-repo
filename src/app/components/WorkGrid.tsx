import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { Link } from "react-router";
import { getHobby, hobbies, subHobbyLabel } from "../data/hobbies";
import { Post } from "../data/posts";
import { PostMedia } from "./PostMedia";
import { Button } from "./ui/button";

const PAGE_SIZE = 15;

function dateLabel(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** The card's own dark ink color — the cream card is a deliberate, contained
 * exception to the app's dark surfaces (same pairing the flat illustrations
 * already use), so its text needs to be dark-on-cream, not the page's
 * light-on-dark foreground tokens. */
const INK = "#3A2A1F";

/** A colored tag per Space, cycling through the brand's warm-hue tokens —
 * same idea as HobbyShelf's book-spine colors. A few Spaces get an explicit
 * color instead of the rotation where one obviously fits (mustard for
 * cooking, green for anything craft-adjacent, plum for travel). */
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
function tagTint(hobbySlug: string) {
  if (TAG_TINT_OVERRIDES[hobbySlug]) return TAG_TINT_OVERRIDES[hobbySlug];
  const idx = hobbies.findIndex((h) => h.slug === hobbySlug);
  return TAG_TINTS[(idx < 0 ? 0 : idx) % TAG_TINTS.length];
}

/**
 * Your Moments, as a small photo-and-caption grid: a colored tag names what
 * each Moment's about, the date sits quietly in the corner, and the caption
 * reads underneath on its own cream card rather than laid over the photo.
 * "Pin a moment" closes out the row as a standing invitation to add another,
 * rather than the grid just stopping.
 */
export function WorkGrid({
  posts,
  onOpen,
  emptyLabel,
}: {
  posts: Post[];
  onOpen: (post: Post) => void;
  emptyLabel: string;
}) {
  const [shown, setShown] = useState(PAGE_SIZE);

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  const visible = posts.slice(0, shown);
  const remaining = posts.length - visible.length;

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {visible.map((post) => {
          const hobby = getHobby(post.hobbySlug);
          // Corner first — the tag should name the specific thing this
          // Moment is about, not the broad Space it lives under, whenever
          // it was actually tagged that specifically. Untagged Moments
          // fall back to the Space name rather than a fabricated Corner.
          const cornerLabel = post.subHobby ? subHobbyLabel(post.subHobby) ?? post.subHobby : hobby?.shortName;
          return (
            <button
              key={post.id}
              type="button"
              onClick={() => onOpen(post)}
              className="group text-left"
              aria-label={`Open: ${post.caption.slice(0, 60)}`}
            >
              <div
                className="overflow-hidden rounded-2xl border border-transparent bg-[var(--cream)] transition-colors group-hover:border-[var(--coral-deep)]"
                style={{ color: INK }}
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
                  {cornerLabel && (
                    <span
                      className="absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[10px] font-semibold text-white"
                      style={{ backgroundColor: tagTint(post.hobbySlug) }}
                    >
                      {cornerLabel}
                    </span>
                  )}
                  <span
                    className="absolute right-2.5 top-2.5 text-[11px] font-medium text-white"
                    style={{ textShadow: "0 1px 3px rgba(0,0,0,0.45)" }}
                  >
                    {dateLabel(post.createdAt)}
                  </span>
                </div>
                <div className="px-3.5 py-3">
                  <p
                    className="line-clamp-2 text-sm leading-snug sm:text-base"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {post.caption}
                  </p>
                </div>
              </div>
            </button>
          );
        })}

        {remaining === 0 && (
          <Link
            to="/create"
            className="flex h-full min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--hairline)] text-muted-foreground transition-colors hover:border-[var(--coral-deep)] hover:text-foreground"
          >
            <ImagePlus className="size-5" strokeWidth={1.7} />
            <span className="text-sm font-medium">Pin a moment</span>
          </Link>
        )}
      </div>

      {remaining > 0 && (
        <div className="mt-4 text-center">
          <Button variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE_SIZE)}>
            Show more
          </Button>
        </div>
      )}
    </div>
  );
}
