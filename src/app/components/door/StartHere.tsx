import { useRowScrollMemory } from "../../lib/useHistoryState";
import { PressLink } from "../afterhours/PressLink";
import { Reveal } from "../afterhours/Reveal";
import type { MoodCard } from "../../data/moodCards";
import { cornerStyle } from "../../lib/categoryStyle";
import { displayStyle } from "../../lib/doorList";
import { SECTION_GAP } from "../../lib/pageGrid";
import { tieNumbers } from "../../lib/typography";
import { forwardRef } from "react";

/** The "Start here" label's hand-drawn arrow, pointing down to the row. */
function Arrow() {
  return (
    <svg width="44" height="28" viewBox="0 0 44 28" fill="none" aria-hidden="true" className="text-[var(--accent)]">
      <path
        d="M3 4 C 14 2, 26 6, 31 20"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M22 18 L31 21 L36 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A ticket: the Corner and the step on the category colour, a stub on the right behind a dashed divider. */
function Ticket({ card, serial }: { card: MoodCard; serial: string }) {
  return (
    <PressLink
      to={`/corner/${card.cornerSlug}`}
      className="flex h-[236px] w-[236px] overflow-hidden rounded-control bg-[var(--cat)] text-[var(--ink)]"
    >
      <span className="flex min-w-0 flex-1 flex-col justify-between p-4">
        <span className="truncate text-caption font-semibold">{card.label}</span>
        <span style={displayStyle(22, { lineHeight: 1.1 })}>{tieNumbers(card.guide.step)}</span>
      </span>
      <span className="flex w-[50px] shrink-0 items-center justify-center border-l-2 border-dashed border-[color-mix(in_srgb,var(--ink)_55%,transparent)]">
        <span className="text-caption font-semibold [text-orientation:mixed] [writing-mode:vertical-rl]">{`Admit one · ${serial}`}</span>
      </span>
    </PressLink>
  );
}

export const StartHere = forwardRef<HTMLUListElement, { cards: MoodCard[]; fading: boolean; firstSerial: number }>(
  function StartHere({ cards, fading, firstSerial }, ref) {
    const row = useRowScrollMemory("discover.startHere");
    if (cards.length === 0) return null;
    return (
      <section className={SECTION_GAP} aria-labelledby="start-here-title">
        <div className="mb-3 flex items-end gap-2">
          <h2 id="start-here-title" className="text-lead text-[var(--accent-text)]">
            Start here
          </h2>
          <Arrow />
        </div>
        <ul
          {...row}
          ref={(el) => {
            row.ref(el);
            if (typeof ref === "function") ref(el);
            else if (ref) ref.current = el;
          }}
          className={`-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 transition-opacity duration-fast [scrollbar-width:none] md:-mx-8 md:gap-4 md:px-8 md:scroll-px-8 ${fading ? "opacity-0" : "opacity-100"}`}
        >
          {cards.map((card, i) => (
            <li key={`${card.spaceSlug}-${card.cornerSlug}`} className="shrink-0 snap-start" style={cornerStyle(card.spaceSlug, card.cornerSlug)}>
              <Reveal index={i}>
                <Ticket card={card} serial={String(firstSerial + i).padStart(4, "0")} />
              </Reveal>
            </li>
          ))}
        </ul>
      </section>
    );
  },
);
