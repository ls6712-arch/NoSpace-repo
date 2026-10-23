import { useHistoryState } from "../../lib/useHistoryState";
import { BlurFade } from "../afterhours/BlurFade";
import { PressLink } from "../afterhours/PressLink";
import { CORNER_CATEGORIES } from "../../data/cornerCategories";
import { CATEGORY_ICON, categoryStyle, categoryTransitionName } from "../../lib/categoryStyle";
import { viewTransitionAllowed } from "../../lib/useViewTransition";

/** How many show before "See all". */
const FIRST = 8;

/**
 * "Browse" on Discover's Corners tab: the 18 categories as tiles, the first 8
 * and then "See all" (on the right of the heading, like Spotlight's). A tile is
 * small and the same height as every other: a short rule and a line icon in the
 * category's colour, its own name right under the rule, and one line of what's
 * in it (cut off with an ellipsis if it is long). The tile is tinted with the
 * category's colour in both themes. Tapping one opens its page, and the tile
 * grows into that page's header (a view transition, off for reduced motion).
 */
export function CategoryGrid() {
  const [showAll, setShowAll] = useHistoryState("discover.categoriesAll", false);
  const shown = showAll ? CORNER_CATEGORIES : CORNER_CATEGORIES.slice(0, FIRST);

  return (
    <section className="mb-10" aria-labelledby="browse-title">
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 id="browse-title" className="text-display" style={{ fontFamily: "var(--font-poster)" }}>
          Browse
        </h2>
        {!showAll && CORNER_CATEGORIES.length > FIRST && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="inline-flex min-h-11 shrink-0 items-center text-caption text-[var(--coral-text)] hover:underline"
          >
            See all →
          </button>
        )}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {shown.map((c, i) => {
          const Icon = CATEGORY_ICON[c.slug];
          return (
            <li key={c.slug} style={categoryStyle(c.slug)}>
              <BlurFade inView delay={Math.min(i, 7) * 0.04} className="h-full">
                <PressLink
                  to={`/browse/${c.slug}`}
                  viewTransition={viewTransitionAllowed()}
                  style={{ viewTransitionName: categoryTransitionName(c.slug) }}
                  className="group relative block h-[7.25rem] overflow-hidden rounded-card bg-[color-mix(in_srgb,var(--card)_86%,var(--field)_14%)] p-3 transition-[translate,box-shadow] duration-base ease-standard hover:-translate-y-0.5 hover:shadow-card"
                >
                  <span className="block h-1 w-8 bg-[var(--field)]" aria-hidden="true" />
                  {Icon && (
                    <Icon className="absolute right-3 top-3 size-5 text-[var(--field-text)]" strokeWidth={1.5} aria-hidden="true" />
                  )}
                  <span
                    className="mt-2 line-clamp-2 block pr-6 text-title leading-tight text-foreground"
                    style={{ fontFamily: "var(--font-poster)" }}
                  >
                    {c.name}
                  </span>
                  <span className="mt-1 block truncate text-small text-muted-foreground">{c.about}</span>
                </PressLink>
              </BlurFade>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
