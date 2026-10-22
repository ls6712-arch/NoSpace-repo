import { hobbies } from "../../data/hobbies";
import { quickGuides } from "../../data/cornerGuides";
import { cornerStyle } from "../../lib/categoryStyle";
import { useRowScrollMemory } from "../../lib/useHistoryState";
import { PressLink } from "../afterhours/PressLink";

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
  const row = useRowScrollMemory("discover.quickStarts");
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
    <section className="mb-10" aria-labelledby="quick-starts-title">
      <h2 id="quick-starts-title" className="mb-5 text-display" style={{ fontFamily: "var(--font-poster)" }}>
        Got 15 minutes?
      </h2>
      <ul {...row} className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {items.map((q) => (
          <li key={`${q.spaceSlug}-${q.cornerSlug}`} className="w-64 shrink-0 snap-start" style={cornerStyle(q.spaceSlug, q.cornerSlug)}>
            {/* The page's one bold colour moment: each step on its Space's colour. */}
            <PressLink
              to={`/corner/${q.cornerSlug}`}
              className="group flex h-full min-h-[11rem] flex-col justify-between gap-6 rounded-card bg-[var(--field)] p-4 text-[var(--on-field)]"
            >
              <span className="text-small font-medium">{q.label}</span>
              <span className="text-title leading-snug" style={{ fontFamily: "var(--font-serif)" }}>
                {q.guide.step}
              </span>
            </PressLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
