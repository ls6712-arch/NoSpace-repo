import { Chip } from "../ui/Chip";
import { EmptyState } from "../StateViews";
import { Skeleton } from "../ui/skeleton";
import { FeedCard } from "../home/FeedCard";
import type { Post } from "../../data/posts";
import { cornerPath } from "../../lib/cornerPath";
import { cornerName } from "../../lib/discoverCorners";
import { postCornerKey } from "../../lib/discoverFeed";
import { useLoadMore } from "../../lib/useLoadMore";
import { useShownOnce } from "../../lib/useShownOnce";

/** Approved Oct 31, 2026 (docs/glossary.md, Discover v2). */
export const CITY_FEED_EMPTY_LINE = "Nothing new nearby yet";

/** "Try pottery", but "Try D&D" and "Try 3D printing": the first letter drops to lower case only for an ordinary word. */
export function tryName(name: string): string {
  return /^[A-Z][a-z]/.test(name) ? name[0].toLowerCase() + name.slice(1) : name;
}

function ShownWrap({ children, onShown }: { children: React.ReactNode; onShown: () => void }) {
  const ref = useShownOnce<HTMLDivElement>(onShown);
  return <div ref={ref}>{children}</div>;
}

export function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-3 border-b border-border pb-5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-10 flex-1 rounded-card" />
          </div>
          <Skeleton className="aspect-[4/3] w-full rounded-card" />
          <Skeleton className="h-11 w-2/3 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * What {city} is making: Corner filter chips (All, then the busiest Corners today)
 * above Moments from people you do not follow yet. Home's own card, with a Follow
 * button on the author row and a Try pill next to Love this. More Moments load as
 * you scroll.
 */
export function CityFeed({
  posts,
  chips,
  corner,
  onCorner,
  loading,
  hasMore,
  onMore,
  followed,
  onFollow,
  onOpen,
  onTry,
  onShown,
}: {
  posts: readonly Post[];
  chips: readonly string[];
  corner: string | null;
  onCorner: (key: string | null) => void;
  loading: boolean;
  hasMore: boolean;
  onMore: () => void;
  /** Author ids the person has asked to follow from this page. */
  followed: ReadonlySet<string>;
  onFollow: (post: Post) => void;
  onOpen: (post: Post) => void;
  onTry: (post: Post, position: number) => void;
  onShown: (post: Post, position: number) => void;
}) {
  const sentinel = useLoadMore<HTMLDivElement>(onMore, hasMore && !loading);
  return (
    <div className="flex flex-col gap-4">
      {chips.length > 0 && (
        <div role="group" aria-label="Corners" className="-mx-4 flex gap-2 overflow-x-auto px-4 md:-mx-8 md:px-8 [scrollbar-width:none]">
          <Chip selected={corner === null} className="shrink-0" onClick={() => onCorner(null)}>
            All
          </Chip>
          {chips.map((key) => (
            <Chip key={key} selected={corner === key} className="shrink-0" onClick={() => onCorner(corner === key ? null : key)}>
              {cornerName(key.split("/")[1])}
            </Chip>
          ))}
        </div>
      )}

      {posts.length === 0 && loading ? (
        <FeedSkeleton />
      ) : posts.length === 0 ? (
        <EmptyState line={CITY_FEED_EMPTY_LINE} action={{ label: "Log a Moment", to: "/create" }} />
      ) : (
        <div className="flex flex-col">
          {posts.map((post, i) => {
            const key = postCornerKey(post);
            const [space, slug] = key.split("/");
            const name = slug ? cornerName(slug) : "";
            return (
              <ShownWrap key={post.id} onShown={() => onShown(post, i)}>
                <FeedCard
                  post={post}
                  source="discover"
                  onOpen={onOpen}
                  priority={i === 0}
                  discover={
                    name
                      ? {
                          following: post.userId && followed.has(post.userId) ? "requested" : "none",
                          onFollow: () => onFollow(post),
                          tryName: tryName(name),
                          tryTo: cornerPath(space, slug),
                          onTry: () => onTry(post, i),
                        }
                      : undefined
                  }
                />
              </ShownWrap>
            );
          })}
          {loading && <FeedSkeleton />}
          <div ref={sentinel} aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
