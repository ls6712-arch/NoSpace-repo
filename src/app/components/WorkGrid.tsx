import { useState } from "react";
import { getHobby } from "../data/hobbies";
import { Post } from "../data/posts";
import { PostMedia } from "./PostMedia";
import { Button } from "./ui/button";

const PAGE_SIZE = 9;

function dateLabel(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * The photo-forward grid on a profile's "Work" tab — a Space label, the
 * maker's own caption, and the date, under each photo. Deliberately not
 * ContentCard: no reaction grid here, and no counts next to the photo. This
 * is a record of what got made, not a place to keep score.
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visible.map((post) => {
          const hobby = getHobby(post.hobbySlug);
          return (
            <button
              key={post.id}
              type="button"
              onClick={() => onOpen(post)}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-left transition-transform duration-200 hover:-translate-y-0.5"
              aria-label={`Open: ${post.caption.slice(0, 60)}`}
            >
              <PostMedia
                media={post.media}
                type={post.type}
                hobbySlug={post.hobbySlug}
                seed={post.id}
                preview
                className="aspect-square w-full transition-transform duration-500 group-hover:scale-[1.04]"
              />
              <span className="flex flex-1 flex-col gap-1 p-3">
                {hobby && (
                  <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--coral-text)]">
                    {hobby.shortName}
                  </span>
                )}
                <span className="line-clamp-2 text-sm text-foreground/90">{post.caption}</span>
                <span className="mt-auto pt-1 text-[11px] text-muted-foreground">
                  {dateLabel(post.createdAt)}
                </span>
              </span>
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
