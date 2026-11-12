import { Chip } from "../ui/Chip";
import { EmptyState, ErrorNotice } from "../StateViews";
import { Moment } from "../moment/Moment";
import { MomentListSkeleton } from "../moment/MomentSkeleton";
import type { Post } from "../../data/posts";
import { cornerName } from "../../lib/discoverCorners";
import { useLoadMore } from "../../lib/useLoadMore";
import { useShownOnce } from "../../lib/useShownOnce";

/** Approved Oct 31, 2026 (docs/glossary.md, Discover v2). */
export const CITY_FEED_EMPTY_LINE = "Nothing new nearby yet";

function ShownWrap({ children, onShown }: { children: React.ReactNode; onShown: () => void }) {
  const ref = useShownOnce<HTMLDivElement>(onShown);
  return <div ref={ref}>{children}</div>;
}

export const FeedSkeleton = MomentListSkeleton;

/**
 * What {city} is making: Corner filter chips (All, then the busiest Corners today)
 * above Moments from people you do not follow yet. The same Moment as everywhere
 * else: its header carries Follow, since nobody here is followed yet. More Moments
 * load as you scroll.
 */
export function CityFeed({
  posts,
  chips,
  corner,
  onCorner,
  loading,
  failed = false,
  onRetry,
  hasMore,
  onMore,
  onFollowed,
  onOpen,
  onShown,
}: {
  posts: readonly Post[];
  chips: readonly string[];
  corner: string | null;
  onCorner: (key: string | null) => void;
  loading: boolean;
  /** The last load failed: show the retry line instead of the empty state, or under the Moments already shown. */
  failed?: boolean;
  onRetry?: () => void;
  hasMore: boolean;
  onMore: () => void;
  /** After the person asks to follow a Moment's author from this page. */
  onFollowed: (post: Post) => void;
  onOpen: (post: Post) => void;
  onShown: (post: Post, position: number) => void;
}) {
  const sentinel = useLoadMore<HTMLDivElement>(onMore, hasMore && !loading);
  return (
    <div className="flex flex-col gap-4">
      {chips.length > 0 && (
        <div role="group" aria-label="Corners" className="-mx-4 flex gap-2 overflow-x-auto px-4 tab:-mx-6 tab:px-6 desk:-mx-8 desk:px-8 [scrollbar-width:none]">
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
      ) : posts.length === 0 && failed ? (
        <ErrorNotice onRetry={onRetry} />
      ) : posts.length === 0 ? (
        <EmptyState line={CITY_FEED_EMPTY_LINE} action={{ label: "Log a Moment", to: "/create" }} />
      ) : (
        <div className="flex flex-col">
          {posts.map((post, i) => (
            <ShownWrap key={post.id} onShown={() => onShown(post, i)}>
              <Moment post={post} onOpen={onOpen} priority={i === 0} onFollowed={onFollowed} />
            </ShownWrap>
          ))}
          {loading && <FeedSkeleton />}
          {failed && <ErrorNotice onRetry={onRetry} />}
          <div ref={sentinel} aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
