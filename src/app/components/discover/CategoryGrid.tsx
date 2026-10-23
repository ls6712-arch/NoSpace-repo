import { useHistoryState } from "../../lib/useHistoryState";
import { PressLink } from "../afterhours/PressLink";
import { Reveal } from "../afterhours/Reveal";
import { CORNER_CATEGORIES } from "../../data/cornerCategories";
import { CATEGORY_ICON, categoryStyle, categoryTransitionName } from "../../lib/categoryStyle";
import { SECTION_GAP, TITLE_GAP } from "../../lib/pageGrid";
import { viewTransitionAllowed } from "../../lib/useViewTransition";

/** How many show before "See all". */
const FIRST = 8;

/**
 * "Browse" on Discover's Corners tab (spec v1): the 18 categories as solid
 * colour tiles, the first 8 and then "See all" (on the right of the heading,
 * like Spotlight's). A tile is 112px tall on a phone and 132px on a wide
 * screen, the same for all: the category's own name top-left in `--ink`, and
 * its icon at 64px, `--ink` at 22%, turned 15 degrees and bleeding off the
 * bottom-right corner. Nothing else. Tapping one opens its page, and the tile
 * grows into that page's header (a view transition, off for reduced motion).
 */
export function CategoryGrid() {
  const [showAll, setShowAll] = useHistoryState("discover.categoriesAll", false);
  const shown = showAll ? CORNER_CATEGORIES : CORNER_CATEGORIES.slice(0, FIRST);

  return (
    <section className={SECTION_GAP} aria-labelledby="browse-title">
      <div className={`${TITLE_GAP} flex items-center justify-between gap-4`}>
        <h2 id="browse-title" className="text-title">
          Browse
        </h2>
        {!showAll && CORNER_CATEGORIES.length > FIRST && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="inline-flex min-h-11 shrink-0 items-center text-small text-[var(--accent-text)] hover:underline"
          >
            See all
          </button>
        )}
      </div>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {shown.map((c, i) => {
          const Icon = CATEGORY_ICON[c.slug];
          return (
            <li key={c.slug} style={categoryStyle(c.slug)}>
              <Reveal index={Math.min(i, 7)}>
                <PressLink
                  to={`/browse/${c.slug}`}
                  viewTransition={viewTransitionAllowed()}
                  style={{ viewTransitionName: categoryTransitionName(c.slug) }}
                  className="relative block h-28 overflow-hidden rounded-card bg-[var(--cat)] p-4 text-[var(--ink)] md:h-[132px]"
                >
                  <span className="relative z-10 line-clamp-2 block text-lead">{c.name}</span>
                  {Icon && (
                    <Icon
                      size={64}
                      strokeWidth={1.5}
                      aria-hidden="true"
                      className="absolute -bottom-3 -right-3 rotate-[15deg] opacity-[0.22]"
                    />
                  )}
                </PressLink>
              </Reveal>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
