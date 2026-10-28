import { Link } from "react-router";
import { Reveal } from "../afterhours/Reveal";
import { TiltedIcon } from "../ui/TiltedIcon";
import { CORNER_CATEGORIES } from "../../data/cornerCategories";
import { CATEGORY_ICON, categoryColor, catStyle } from "../../lib/categoryStyle";

/**
 * "Browse": the 18 groups of Corners as a 2-column grid of tiles in the
 * category colours, each with its line icon tilted off the corner, each
 * opening /browse/:slug. The group is shown by its own name.
 */
export function BrowseTiles() {
  return (
    <section aria-labelledby="browse-tiles" className="flex flex-col gap-4">
      <h2 id="browse-tiles" className="font-[family-name:var(--font-display)] text-title font-bold">
        Browse
      </h2>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {CORNER_CATEGORIES.map((cat, i) => (
          <li key={cat.slug}>
            <Reveal index={i}>
              <Link
                to={`/browse/${cat.slug}`}
                style={catStyle(categoryColor(cat.slug))}
                className="relative flex min-h-24 items-end rounded-card bg-[var(--cat)] p-4 text-[var(--ink)] transition-transform duration-fast active:scale-[0.97]"
              >
                {/* The icon bleeds off the corner inside its own clip, so the link itself never scrolls. */}
                <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-card" aria-hidden="true">
                  <TiltedIcon icon={CATEGORY_ICON[cat.slug]} />
                </span>
                <span className="relative font-[family-name:var(--font-display)] text-lead leading-tight font-extrabold">{cat.name}</span>
              </Link>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}
