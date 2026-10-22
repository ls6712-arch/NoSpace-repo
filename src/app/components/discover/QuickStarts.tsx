import type { CSSProperties } from "react";
import { Link } from "react-router";
import { hobbies } from "../../data/hobbies";
import { quickGuides } from "../../data/cornerGuides";
import { cornerColorFor } from "../../lib/cornerColor";

/**
 * "Got 15 minutes?" on Discover: Corners whose first step fits in about
 * 15 minutes with what most people already have (activity library,
 * cornerGuides.ts). Each card is the step itself; tapping it opens the
 * Corner, where Start a Pursuit and Log a Moment sit under the same step.
 *
 * Trust rules: an invitation, not a claim. The heading asks a question and
 * the cards say what to try; nothing promises a result. Hidden Spaces are
 * skipped, same as every other browsable list.
 */
const MAX = 10;

export function QuickStarts() {
  const items = quickGuides()
    .map((q) => {
      const hobby = hobbies.find((h) => h.slug === q.spaceSlug);
      const label = hobby?.subItems.find((s) => s.slug === q.cornerSlug)?.label;
      return hobby && !hobby.hidden && label ? { ...q, label } : null;
    })
    .filter((q): q is NonNullable<typeof q> => q !== null)
    .slice(0, MAX);

  if (items.length === 0) return null;

  return (
    <section className="mb-12" aria-labelledby="quick-starts-title">
      <h2 id="quick-starts-title" className="mb-5 text-title" style={{ fontFamily: "var(--font-serif)" }}>
        Got 15 minutes?
      </h2>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {items.map((q) => (
          <li key={`${q.spaceSlug}-${q.cornerSlug}`} className="w-60 shrink-0 snap-start">
            <Link
              to={`/corner/${q.cornerSlug}`}
              className="flex h-full flex-col gap-3 rounded-card border border-border bg-card p-4 transition-[transform,border-color,box-shadow] duration-base ease-standard hover:-translate-y-0.5 hover:border-[var(--coral-deep)] hover:shadow-card active:scale-[0.98]"
              style={{ "--corner-color": cornerColorFor(`${q.spaceSlug}-${q.cornerSlug}`) } as CSSProperties}
            >
              <span
                className="self-start rounded-full bg-[color-mix(in_srgb,var(--card)_86%,var(--corner-color)_14%)] px-2.5 py-1 text-caption font-medium text-[var(--corner-color)]"
              >
                {q.label}
              </span>
              <span className="text-body text-foreground">{q.guide.step}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
