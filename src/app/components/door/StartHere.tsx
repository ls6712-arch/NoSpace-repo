import { forwardRef } from "react";
import { HorizontalRow } from "../HorizontalRow";
import { PressLink } from "../afterhours/PressLink";
import { Reveal } from "../afterhours/Reveal";
import type { MoodCard } from "../../data/moodCards";
import { cornerPath } from "../../lib/cornerPath";
import { cornerStyle } from "../../lib/categoryStyle";
import { SECTION_GAP } from "../../lib/pageGrid";
import { tieNumbers } from "../../lib/typography";

/** The "Start here" label's hand-drawn arrow (the path from the approved design, docs/design/door-list). */
function Arrow() {
  return (
    <svg width="64" height="26" viewBox="0 0 64 26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-[var(--accent-text)]">
      <path d="M2 6c14 14 30 16 54 10" />
      <path d="M48 9l9 7-10 4" />
    </svg>
  );
}

/** A ticket: the Corner and the step on the category colour, a stub on the right behind a dashed divider. */
function Ticket({ card, serial }: { card: MoodCard; serial: string }) {
  return (
    <PressLink
      to={cornerPath(card.spaceSlug, card.cornerSlug)}
      className="flex h-[236px] w-[236px] overflow-hidden rounded-control bg-[var(--cat)] text-[var(--ink)]"
    >
      <span className="flex min-w-0 flex-1 flex-col justify-between p-4">
        <span className="truncate text-small font-semibold">{card.label}</span>
        <span className="text-lead">{tieNumbers(card.guide.step)}</span>
      </span>
      {/* The stamp is decoration; the Corner and step carry the meaning. */}
      <span aria-hidden="true" className="flex w-[50px] shrink-0 items-center justify-center border-l-2 border-dashed border-[color-mix(in_srgb,var(--ink)_55%,transparent)]">
        <span className="text-caption font-semibold [text-orientation:mixed] [writing-mode:vertical-rl]">{`Admit one · ${serial}`}</span>
      </span>
    </PressLink>
  );
}

/**
 * "Start here": the row of tickets. `moodLine` names the chosen mood over the
 * row ("Things to make tonight") so a pick is answered by what is below it.
 */
export const StartHere = forwardRef<HTMLUListElement, { cards: { card: MoodCard; serial: number }[]; moodLine: string; fading: boolean }>(
  function StartHere({ cards, moodLine, fading }, ref) {
    if (cards.length === 0) return null;
    return (
      <section className={SECTION_GAP} aria-labelledby="start-here-title">
        <div className="mb-1 flex items-center gap-2 text-small font-semibold text-[var(--accent-text)]">
          <span>Start here</span>
          <Arrow />
        </div>
        <h2 id="start-here-title" className={`mb-3 text-title transition-opacity duration-fast ${fading ? "opacity-0" : "opacity-100"}`}>
          {moodLine}
        </h2>
        <div className={`transition-opacity duration-fast ${fading ? "opacity-0" : "opacity-100"}`}>
          <HorizontalRow name="discover.startHere" label={moodLine} listRef={ref}>
            {cards.map(({ card, serial }, i) => (
              <li key={`${card.spaceSlug}-${card.cornerSlug}`} className="shrink-0 snap-start" style={cornerStyle(card.spaceSlug, card.cornerSlug)}>
                <Reveal index={i}>
                  <Ticket card={card} serial={String(serial).padStart(4, "0")} />
                </Reveal>
              </li>
            ))}
          </HorizontalRow>
        </div>
      </section>
    );
  },
);
