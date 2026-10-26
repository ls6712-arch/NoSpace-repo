import { cornerPath } from "../../lib/cornerPath";
import { useRowScrollMemory } from "../../lib/useHistoryState";
import { PressLink } from "../afterhours/PressLink";
import { Reveal } from "../afterhours/Reveal";
import type { MoodCard } from "../../data/moodCards";
import { cornerStyle } from "../../lib/categoryStyle";
import { displayStyle } from "../../lib/doorList";
import { SECTION_GAP } from "../../lib/pageGrid";
import { tieNumbers } from "../../lib/typography";
import { forwardRef } from "react";

/** The "Start here" label's hand-drawn arrow (the path from the approved design, docs/design/door-list). */
function Arrow() {
  return (
    <svg width="64" height="26" viewBox="0 0 64 26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-[var(--accent)]">
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
        <span className="truncate text-caption font-semibold">{card.label}</span>
        <span style={displayStyle(22, { lineHeight: 1.1 })}>{tieNumbers(card.guide.step)}</span>
      </span>
      <span className="flex w-[50px] shrink-0 items-center justify-center border-l-2 border-dashed border-[color-mix(in_srgb,var(--ink)_55%,transparent)]">
        <span className="text-caption font-semibold [text-orientation:mixed] [writing-mode:vertical-rl]">{`Admit one · ${serial}`}</span>
      </span>
    </PressLink>
  );
}

export const StartHere = forwardRef<HTMLUListElement, { cards: { card: MoodCard; serial: number }[]; fading: boolean }>(
  function StartHere({ cards, fading }, ref) {
    const row = useRowScrollMemory("discover.startHere");
    if (cards.length === 0) return null;
    return (
      <section className={SECTION_GAP} aria-labelledby="start-here-title">
        <div className="mb-3 flex items-center gap-2">
          <h2 id="start-here-title" className="text-lead text-[var(--accent-text)]" style={displayStyle(18, { fontWeight: 700, letterSpacing: "0" })}>
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
          {cards.map(({ card, serial }, i) => (
            <li key={`${card.spaceSlug}-${card.cornerSlug}`} className="shrink-0 snap-start" style={cornerStyle(card.spaceSlug, card.cornerSlug)}>
              <Reveal index={i}>
                <Ticket card={card} serial={String(serial).padStart(4, "0")} />
              </Reveal>
            </li>
          ))}
        </ul>
      </section>
    );
  },
);
