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
 * Your Moments, as a personal visual journal rather than a feed: every tile
 * the same square shape, so the grid reads as a calm, even record rather
 * than an editorial collage — real photos crop to fill their tile; seed
 * content and anything without an upload keeps NoSpace's own illustrated
 * look. No counts anywhere on it.
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
          return (
            <button
              key={post.id}
              type="button"
              onClick={() => onOpen(post)}
              className="group text-left"
              aria-label={`Open: ${post.caption.slice(0, 60)}`}
            >
              <div className="aspect-square overflow-hidden rounded-lg border border-[var(--hairline)] transition-colors group-hover:border-[var(--coral-deep)]">
                <PostMedia
                  media={post.media}
                  type={post.type}
                  hobbySlug={post.hobbySlug}
                  seed={post.id}
                  preview
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="mt-2">
                {hobby && (
                  <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[10px]">
                    {hobby.shortName}
                  </span>
                )}
                <p className="line-clamp-2 text-xs text-foreground sm:text-sm">{post.caption}</p>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">{dateLabel(post.createdAt)}</span>
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
