import { PressLink } from "../afterhours/PressLink";
import { CORNER_CATEGORIES } from "../../data/cornerCategories";
import { categoryStyle } from "../../lib/categoryStyle";
import { displayStyle } from "../../lib/doorList";
import { SECTION_GAP } from "../../lib/pageGrid";
import { useHistoryState } from "../../lib/useHistoryState";

/** How many rooms show before "See all rooms". */
const FIRST = 6;

/**
 * "Rooms": the 18 groups of Corners as 64px rows, each a dot in its colour and
 * its name. Six show, then "See all rooms". Each row opens that group's page.
 */
export function Rooms() {
  const [showAll, setShowAll] = useHistoryState("discover.roomsAll", false);
  const shown = showAll ? CORNER_CATEGORIES : CORNER_CATEGORIES.slice(0, FIRST);
  return (
    <section className={SECTION_GAP} aria-labelledby="rooms-title">
      <div className="mb-2 flex items-baseline justify-between gap-4 border-t-2 border-foreground pt-3">
        <h2 id="rooms-title" style={displayStyle(34, { lineHeight: 1.05 })}>
          Rooms
        </h2>
        <span className="text-small text-muted-foreground">Who’s in where</span>
      </div>
      <ul>
        {shown.map((c) => (
          <li key={c.slug} style={categoryStyle(c.slug)} className="border-b border-border">
            <PressLink to={`/browse/${c.slug}`} className="flex h-16 items-center gap-3">
              <span className="size-3 shrink-0 rounded-full bg-[var(--cat)]" aria-hidden="true" />
              <span style={displayStyle(26, { lineHeight: 1.1 })} className="truncate">
                {c.name}
              </span>
            </PressLink>
          </li>
        ))}
      </ul>
      {!showAll && CORNER_CATEGORIES.length > FIRST && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2 inline-flex min-h-11 items-center text-small text-[var(--accent-text)] hover:underline"
        >
          See all rooms
        </button>
      )}
    </section>
  );
}
