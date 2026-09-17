import { Link } from "react-router";
import { TagTally } from "../lib/postTags";
import { tagTint } from "./WorkGrid";
import { findSpaceForInterest } from "../data/hobbies";
import { QuietMilestones } from "./QuietMilestones";

/** Same resolve-then-fall-back-to-the-palette approach as momentDisplay.ts's
 * momentTint, just starting from a bare tag string (this rail has no Post to
 * read a subHobby off of) rather than a whole Moment. */
function tagPillTint(tag: string) {
  const match = findSpaceForInterest(tag);
  return tagTint(match?.hobbySlug ?? tag);
}

/**
 * The profile's left rail — narrow, sticky, two blocks only: your tags (tap
 * one to narrow the grid beside it) and Quiet Milestones. Deliberately not a
 * per-Pursuit moment-count breakdown — every tile in the grid already
 * carries its own tag, so a second count here would just repeat it.
 */
export function ProfileRail({
  tags,
  activeTag,
  onToggleTag,
}: {
  tags: TagTally[];
  activeTag: string | null;
  onToggleTag: (tag: string) => void;
}) {
  return (
    <aside className="w-full shrink-0 sm:w-[150px] sm:self-start sm:sticky sm:top-6">
      <div className="mb-8">
        <h3 className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Tags
        </h3>
        {tags.length === 0 ? (
          <p className="text-xs text-muted-foreground">Tag a Moment and it shows up here.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {tags.map(({ tag }) => {
              const active = activeTag === tag;
              const tint = tagPillTint(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onToggleTag(tag)}
                  className="rounded-full px-2.5 py-1 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
                  style={{
                    backgroundColor: tint,
                    outline: active ? "2px solid var(--foreground)" : "none",
                    outlineOffset: "1px",
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        )}
        {activeTag && (
          <button
            type="button"
            onClick={() => onToggleTag(activeTag)}
            className="mt-2 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
          >
            Clear filter
          </button>
        )}
        <Link
          to="/create"
          className="mt-2.5 block text-[11px] text-[var(--coral-text)] hover:underline"
        >
          + Add a tag
        </Link>
      </div>

      <div>
        <h3 className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Quiet Milestones
        </h3>
        {/* Reused as-is, not rebuilt — see QuietMilestones.tsx. Its own
            horizontally-scrolling row of discs handles being squeezed into
            a ~150px rail on its own (overflow-x-auto), no adaptation
            needed here. */}
        <QuietMilestones />
      </div>
    </aside>
  );
}
