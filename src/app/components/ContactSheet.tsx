import { useRef } from "react";
import { Link } from "react-router";
import { Post } from "../data/posts";
import { firstWords } from "../lib/text";

const hasRealMedia = (post: Post) => !!post.media && /^https?:\/\//.test(post.media);

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
        "flex w-full items-start gap-3 rounded-lg border p-2.5 text-left transition-colors " +
        (selected ? "border-accent" : "border-transparent hover:border-border")
      }
    >
      <span className="ns-section-kicker mt-1 w-5 shrink-0 text-muted-foreground">
        {String(index + 1).padStart(2, "0")}
      </span>
      {hasRealMedia(post) ? (
        <img
          src={post.media}
          alt=""
          className="size-12 shrink-0 rounded-md object-cover"
        />
      ) : (
        <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-card p-1 text-center text-[8px] leading-tight text-foreground" style={{ fontFamily: "var(--font-serif)" }}>
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
        <span className="mt-0.5 block break-words text-xs text-muted-foreground">
          {post.caption ? firstWords(post.caption, 8) : post.hobbySlug}
        </span>
      </span>
    </button>
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
  const rootRef = useRef<HTMLDivElement>(null);

  const move = (delta: number) => {
    const ids = moments.map((m) => m.id);
    const currentIndex = ids.indexOf(selectedId ?? ids[0]);
    const next = ids[Math.min(ids.length - 1, Math.max(0, currentIndex + delta))];
    if (next != null) onSelect(next);
  };

  return (
    <div
      ref={rootRef}
      role="listbox"
      aria-label="Contact sheet"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      <p className="ns-section-kicker text-muted-foreground">CONTACT SHEET</p>
      <h2 className="mt-1 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
        The whole day, at a glance
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {totalUnseen} {totalUnseen === 1 ? "Moment" : "Moments"} from the people and Spaces you follow.
      </p>

      <div className="mt-4 space-y-1.5">
        {moments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
            Nothing new since your last visit.
          </p>
        ) : (
          moments.map((post, i) => (
            <Frame
              key={post.id}
              post={post}
              index={i}
              selected={post.id === selectedId}
              onSelect={() => onSelect(post.id)}
            />
          ))
        )}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={onTurnPage}
          className="mt-3 text-xs text-accent hover:underline"
        >
          Turn the page
        </button>
      )}

      <div className="mt-6 border-t border-border pt-4">
        <p className="ns-section-kicker text-muted-foreground">END OF THE SHEET</p>
        <p className="mt-1 text-sm" style={{ fontFamily: "var(--font-serif)" }}>
          You're caught up
        </p>
        <Link to="/create" className="mt-2 inline-block text-xs text-accent hover:underline">
          Add a Moment
        </Link>
      </div>
    </div>
  );
}
