import { Link } from "react-router";
import { CORNER_CATEGORIES } from "../../data/cornerCategories";

/**
 * "Browse by": the 18 groups of Corners as one row of chips that scrolls
 * sideways, each opening its page (/browse/:slug). On /corners and Discover,
 * the same row in both places. A group is shown only by its own name.
 */
export function BrowseByChips() {
  return (
    <nav aria-label="Browse by" className="flex flex-col gap-2">
      <p className="text-small font-semibold text-foreground" aria-hidden="true">
        Browse by
      </p>
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] tab:mx-0 tab:px-0 [&::-webkit-scrollbar]:hidden">
        {CORNER_CATEGORIES.map((cat) => (
          <li key={cat.slug} className="shrink-0">
            <Link
              to={`/browse/${cat.slug}`}
              className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-small font-semibold text-foreground transition-colors duration-fast hover:border-[var(--accent)]"
            >
              {cat.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
