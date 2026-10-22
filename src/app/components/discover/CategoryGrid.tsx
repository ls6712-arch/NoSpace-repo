import { useHistoryState } from "../../lib/useHistoryState";
import { BlurFade } from "../afterhours/BlurFade";
import { PressLink } from "../afterhours/PressLink";
import { CORNER_CATEGORIES } from "../../data/cornerCategories";
import { CATEGORY_ICON, categoryExamples, categoryStyle, categoryTransitionName } from "../../lib/categoryStyle";
import { viewTransitionAllowed } from "../../lib/useViewTransition";

/** How many show before "See all". */
const FIRST = 8;

/**
 * The Corners tab: the 18 categories as a grid, the first 8 and then "See all".
 * Each tile is the category's own name (set large), a few examples, a simple
 * line icon and a short rule in its colour. Tapping one opens its page, and the
 * tile grows into that page's header (a view transition, off for reduced
 * motion). A category with no Corners would never show; all 18 have some.
 */
export function CategoryGrid() {
  const [showAll, setShowAll] = useHistoryState("discover.categoriesAll", false);
  const shown = showAll ? CORNER_CATEGORIES : CORNER_CATEGORIES.slice(0, FIRST);

  return (
    <div className="mb-14">
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
                  className="group flex h-full min-h-[10.5rem] flex-col justify-between gap-6 rounded-card bg-card p-4 transition-[translate] duration-base ease-standard hover:-translate-y-0.5"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="mt-2 block h-1 w-10 bg-[var(--field)]" aria-hidden="true" />
                    {Icon && <Icon className="size-6 text-[var(--field-text)]" strokeWidth={1.5} aria-hidden="true" />}
                  </span>
                  <span>
                    <span className="block text-display leading-none text-foreground" style={{ fontFamily: "var(--font-poster)" }}>
                      {c.name}
                    </span>
                    <span className="mt-2 block text-small text-muted-foreground">{categoryExamples(c)}</span>
                  </span>
                </PressLink>
              </BlurFade>
            </li>
          );
        })}
      </ul>
      {!showAll && CORNER_CATEGORIES.length > FIRST && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-4 min-h-11 border-t border-border pt-3 text-small font-medium text-[var(--coral-text)] underline-offset-4 hover:underline"
        >
          See all
        </button>
      )}
    </div>
  );
}
