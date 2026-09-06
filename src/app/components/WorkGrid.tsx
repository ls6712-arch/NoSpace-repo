import { useState } from "react";
import { getHobby } from "../data/hobbies";
import { Post } from "../data/posts";
import { PostMedia } from "./PostMedia";
import { Button } from "./ui/button";

const PAGE_SIZE = 15;

function dateLabel(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * A repeating rhythm of tile shapes, not a uniform grid — a feature moment,
 * tall ones, wide ones, small ones, in a sequence that (with grid-auto-flow:
 * dense) tessellates into an editorial composition rather than rows. Mobile
 * gets its own, simpler rhythm on a 2-column base rather than the desktop
 * shapes just shrinking in place.
 */
const TILE_SHAPES = [
  "col-span-2 row-span-2 sm:col-span-2 sm:row-span-2",
  "row-span-2 sm:row-span-2",
  "row-span-1",
  "col-span-2 row-span-1 sm:col-span-1 sm:row-span-1",
  "row-span-1 sm:col-span-2 sm:row-span-1",
  "row-span-2 sm:row-span-1",
  "col-span-2 row-span-1 sm:col-span-1 sm:row-span-2",
  "row-span-1",
];

/**
 * Your Moments, as a personal visual journal rather than a feed: a large
 * feature piece, tall ones, wide ones, mixed freely across hobbies — not
 * grouped into rows by category, and never a same-size Instagram grid. Real
 * photos crop to fill their tile; seed content and anything without an
 * upload keeps NoSpace's own illustrated look. No counts anywhere on it.
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
      <div className="grid grid-cols-2 [grid-auto-flow:dense] auto-rows-[120px] gap-1.5 sm:grid-cols-4 sm:auto-rows-[150px]">
        {visible.map((post, i) => {
          const hobby = getHobby(post.hobbySlug);
          return (
            <button
              key={post.id}
              type="button"
              onClick={() => onOpen(post)}
              className={`group relative overflow-hidden rounded-lg border border-[var(--hairline)] text-left ${TILE_SHAPES[i % TILE_SHAPES.length]}`}
              aria-label={`Open: ${post.caption.slice(0, 60)}`}
            >
              <PostMedia
                media={post.media}
                type={post.type}
                hobbySlug={post.hobbySlug}
                seed={post.id}
                preview
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--forest-ink)]/85 via-[var(--forest-ink)]/5 to-transparent opacity-90" />
              <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3">
                {hobby && (
                  <span className="text-[9px] font-medium uppercase tracking-wide text-white/75 sm:text-[10px]">
                    {hobby.shortName}
                  </span>
                )}
                <p className="line-clamp-2 text-xs text-white sm:text-sm">{post.caption}</p>
                <span className="mt-0.5 block text-[10px] text-white/65">{dateLabel(post.createdAt)}</span>
              </div>
            </button>
          );
        })}
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
