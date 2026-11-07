import { Link } from "react-router";
import type { HomeCorner } from "../../data/homeCorners";

export const NOT_STARTED_TITLE = "Not started here yet";
export const NOT_STARTED_SUBLINE = "Tap one to be the first.";

/** On /corners each group shows this many chips, then "See all" to its page, where every chip is. */
export const NOT_STARTED_PREVIEW = 6;
export const previewOf = <T,>(corners: T[]): T[] => corners.slice(0, NOT_STARTED_PREVIEW);

/**
 * Catalog Corners that have no guide, curated entry or photo yet, as text chips under the full
 * Corners: no photos, no guide lines. Each opens its Corner page, where the first Moment is
 * the first one. A Corner leaves this list on its own once it is complete (homeCorners.ts).
 */
export function NotStartedChips({ corners, label }: { corners: HomeCorner[]; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {corners.map((c) => (
        <li key={`${c.spaceSlug}/${c.slug}`}>
          <Link
            to={`/corners/${c.slug}`}
            className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-small font-semibold text-foreground transition-colors duration-fast hover:border-[var(--accent)]"
          >
            {c.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
