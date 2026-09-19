import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { Post } from "../data/posts";
import { firstWords } from "../lib/text";

const hasRealMedia = (post: Post) => !!post.media && /^https?:\/\//.test(post.media);

function FrameContent({ post, selected }: { post: Post; selected: boolean }) {
  return (
    <>
      {hasRealMedia(post) ? (
        <img src={post.media} alt="" className="size-12 shrink-0 rounded-md object-cover" />
      ) : (
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-md bg-card p-1 text-center text-[8px] leading-tight text-foreground"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {firstWords(post.caption, 5)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span
          className={"block break-words text-sm " + (selected ? "text-accent" : "text-foreground")}
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {post.creator}
        </span>
        <span className="mt-0.5 block break-words text-xs text-muted-foreground lg:line-clamp-none">
          {post.caption ? firstWords(post.caption, 8) : post.hobbySlug}
        </span>
      </span>
    </>
  );
}

function Frame({
  post,
  index,
  selected,
  onSelect,
}: {
  post: Post;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      data-frame-id={post.id}
      aria-current={selected}
      onClick={onSelect}
      className={
        "myspace-sheet-frame flex w-[200px] shrink-0 snap-start items-start gap-3 rounded-lg border p-2.5 text-left transition-colors lg:w-full lg:shrink lg:snap-align-none " +
        (selected ? "border-accent" : "border-transparent hover:border-border")
      }
    >
      <span className="ns-section-kicker mt-1 w-5 shrink-0 text-muted-foreground">
        {String(index + 1).padStart(2, "0")}
      </span>
      <FrameContent post={post} selected={selected} />
    </button>
  );
}

function EndOfSheetCard({ strip }: { strip?: boolean }) {
  return (
    <div
      className={
        strip
          ? "myspace-sheet-frame w-[200px] shrink-0 snap-start rounded-lg border border-dashed border-border p-3 lg:hidden"
          : "hidden rounded-lg border-t border-border pt-4 lg:block"
      }
    >
      <p className="ns-section-kicker text-muted-foreground">END OF THE SHEET</p>
      <p className="mt-1 text-sm" style={{ fontFamily: "var(--font-serif)" }}>
        You're caught up
      </p>
      <Link to="/create" className="mt-2 inline-block text-xs text-accent hover:underline">
        Add a Moment
      </Link>
    </div>
  );
}

export function ContactSheet({
  moments,
  totalUnseen,
  selectedId,
  onSelect,
  onTurnPage,
  hasMore,
}: {
  moments: Post[];
  /** The real unseen count, for the subtitle — "the number reflects the real count." */
  totalUnseen: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onTurnPage: () => void;
  hasMore: boolean;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(0, moments.findIndex((m) => m.id === selectedId));

  // Keeps the selected frame scrolled into view in strip mode when
  // selection changes via keyboard rather than a click/tap.
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-frame-id="${selectedId}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedId]);

  const move = (delta: number) => {
    const ids = moments.map((m) => m.id);
    const currentIndex = ids.indexOf(selectedId ?? ids[0]);
    const next = ids[Math.min(ids.length - 1, Math.max(0, currentIndex + delta))];
    if (next != null) onSelect(next);
  };

  return (
    <div>
      <p className="ns-section-kicker text-muted-foreground">CONTACT SHEET</p>
      <h2 className="mt-1 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
        The whole day, at a glance
      </h2>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {totalUnseen} {totalUnseen === 1 ? "Moment" : "Moments"} from the people and Spaces you follow.
        </p>
        {moments.length > 0 && (
          <p className="ns-section-kicker shrink-0 text-muted-foreground lg:hidden">
            {String(selectedIndex + 1).padStart(2, "0")} / {String(moments.length).padStart(2, "0")}
          </p>
        )}
      </div>

      <div className="myspace-sheet-strip-wrap relative mt-4">
        <div
          ref={stripRef}
          role="listbox"
          aria-label="Contact sheet"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowRight") {
              e.preventDefault();
              move(1);
            } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
              e.preventDefault();
              move(-1);
            } else if (e.key === "Enter" && selectedId != null) {
              onSelect(selectedId);
            }
          }}
          className="myspace-sheet-strip hide-scrollbar flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:pb-0"
        >
          {moments.length === 0 ? (
            <p className="w-full rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
              Nothing new since your last visit.
            </p>
          ) : (
            <>
              {moments.map((post, i) => (
                <Frame
                  key={post.id}
                  post={post}
                  index={i}
                  selected={post.id === selectedId}
                  onSelect={() => onSelect(post.id)}
                />
              ))}
              <EndOfSheetCard strip />
            </>
          )}
        </div>
        {moments.length > 0 && (
          <div
            aria-hidden="true"
            className="myspace-sheet-fade pointer-events-none absolute inset-y-0 right-0 w-10 lg:hidden"
          />
        )}
      </div>

      {hasMore && (
        <button type="button" onClick={onTurnPage} className="mt-3 text-xs text-accent hover:underline">
          Turn the page
        </button>
      )}

      {moments.length > 0 && <EndOfSheetCard />}
    </div>
  );
}
