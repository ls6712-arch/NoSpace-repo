import { useState } from "react";
import { Bookmark } from "lucide-react";
import { toggleSaved, useJournalSlice } from "../lib/journal";

/**
 * Try This, split out of PostReactions — it's for the viewer, and the maker
 * never sees it, so it never really belonged in the row of things a maker
 * gets to see. Saves the moment to the viewer's own Space (the same journal
 * "saved" list — see lib/journal.ts) so it turns up under "Ready When You
 * Are" on My Space. An invitation to go make the thing, not a task: clicking
 * it never creates a deadline, streak, or to-do — just a brief,
 * dismissing-itself confirmation.
 *
 * Icon-only, styled as a translucent circle badge on the media itself — the
 * same language ContentCard already uses for its video-play badge — rather
 * than a new pattern bolted on. `className` positions it within a relative
 * media wrapper; defaults to the corner opposite the label badge.
 */
export function PostBookmark({
  postId,
  className = "top-3 right-3",
}: {
  postId: string | number;
  className?: string;
}) {
  const saved = useJournalSlice((s) => s.saved.includes(Number(postId)));
  const [justAdded, setJustAdded] = useState(false);

  function handleClick() {
    const wasSaved = saved;
    toggleSaved(Number(postId));
    if (!wasSaved) {
      setJustAdded(true);
      window.setTimeout(() => setJustAdded(false), 2200);
    }
  }

  return (
    <div className={`absolute ${className}`}>
      {justAdded && (
        <span
          role="status"
          className="pointer-events-none absolute -top-9 right-0 z-10 whitespace-nowrap rounded-full bg-[var(--void)] px-2.5 py-1 text-[11px] text-[var(--offwhite)] shadow-md animate-in fade-in slide-in-from-bottom-1"
        >
          Added to your Space
        </span>
      )}
      <button
        type="button"
        aria-pressed={saved}
        aria-label={saved ? "Added to your Space. Try This again to remove it" : "Try This: save it to come back to"}
        title={saved ? "Added to your Space" : "Try This"}
        onClick={handleClick}
        className="flex size-9 items-center justify-center rounded-full bg-[var(--void)]/55 backdrop-blur-md transition-colors hover:bg-[var(--void)]/75"
      >
        <Bookmark
          className="size-4"
          strokeWidth={1.9}
          style={{ color: "var(--offwhite)", fill: saved ? "var(--offwhite)" : "none" }}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
