import { hobbies } from "../../data/hobbies";
import { quickGuides } from "../../data/cornerGuides";
import { categoryOfCorner } from "../../data/cornerCategories";
import { cornerStyle } from "../../lib/categoryStyle";
import { SECTION_GAP, TITLE_GAP } from "../../lib/pageGrid";
import { spreadByKey } from "../../lib/spreadByKey";
import { tieNumbers } from "../../lib/typography";
import { useRowScrollMemory } from "../../lib/useHistoryState";
import { PressLink } from "../afterhours/PressLink";
import { Reveal } from "../afterhours/Reveal";

/**
 * "Got 15 minutes?" on Discover (spec v1): Corners whose first step fits in
 * about 15 minutes with what most people already have (cornerGuides.ts). A row
 * of fixed-size cards, the last one peeking in. Each card is the Corner's name
 * with a dot in its category colour, and the step itself in the display face;
 * tapping it opens the Corner.
 *
 * A step must fit its card in 3 lines without being cut off, so only steps of
 * MAX_STEP characters or fewer are used. Two cards from the same category never
 * sit side by side. Trust rules: an invitation, not a claim; nothing promises
 * a result.
 */
const MAX = 10;
/** About what fits in 3 lines of the card (checked in the browser at 390 and 1440). */
const MAX_STEP = 60;

export function QuickStarts() {
  const row = useRowScrollMemory("discover.quickStarts");
  const items = spreadByKey(
    quickGuides()
      .map((q) => {
        const hobby = hobbies.find((h) => h.slug === q.spaceSlug);
        const label = hobby?.subItems.find((s) => s.slug === q.cornerSlug)?.label;
        return hobby && !hobby.hidden && label && q.guide.step.length <= MAX_STEP ? { ...q, label } : null;
      })
      .filter((q): q is NonNullable<typeof q> => q !== null)
      .slice(0, MAX),
    (q) => categoryOfCorner(q.spaceSlug, q.cornerSlug)?.slug ?? q.spaceSlug,
  );

  if (items.length === 0) return null;

  return (
    <section className={SECTION_GAP} aria-labelledby="quick-starts-title">
      <h2 id="quick-starts-title" className={`${TITLE_GAP} text-title`}>
        Got 15 minutes?
      </h2>
      <ul
        {...row}
        className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:-mx-8 md:gap-4 md:px-8 md:scroll-px-8"
      >
        {items.map((q, i) => (
          <li key={`${q.spaceSlug}-${q.cornerSlug}`} className="shrink-0 snap-start" style={cornerStyle(q.spaceSlug, q.cornerSlug)}>
            <Reveal index={i}>
              <PressLink
                to={`/corner/${q.cornerSlug}`}
                className="relative flex h-[176px] w-[248px] flex-col justify-between overflow-hidden rounded-card border border-border bg-card p-5 shadow-card md:h-[184px] md:w-[280px]"
              >
                <span className="absolute inset-x-0 top-0 h-1 bg-[var(--cat)]" aria-hidden="true" />
                <span className="flex items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full bg-[var(--cat)]" aria-hidden="true" />
                  <span className="truncate text-caption text-foreground">{q.label}</span>
                </span>
                <span className="text-lead text-foreground">{tieNumbers(q.guide.step)}</span>
              </PressLink>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}
