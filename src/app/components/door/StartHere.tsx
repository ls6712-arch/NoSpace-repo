import { Link } from "react-router";
import { forwardRef } from "react";
import { HorizontalRow } from "../HorizontalRow";
import { PressLink } from "../afterhours/PressLink";
import { Reveal } from "../afterhours/Reveal";
import type { MoodCard } from "../../data/moodCards";
import type { EventTicket } from "../../lib/eventTicket";
import { GoingButton, TicketFrame, eventTime, spaceAndPlace, ticketPath } from "./EventParts";
import { cornerPath } from "../../lib/cornerPath";
import { cornerStyle } from "../../lib/categoryStyle";
import { SECTION_GAP } from "../../lib/pageGrid";
import { tieNumbers } from "../../lib/typography";

/** The "Start here" label's hand-drawn arrow (the path from the approved design, docs/design/door-list). */
function Arrow() {
  return (
    <svg width="64" height="26" viewBox="0 0 64 26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-accent-text">
      <path d="M2 6c14 14 30 16 54 10" />
      <path d="M48 9l9 7-10 4" />
    </svg>
  );
}

/** A plain "How to start" card: the Corner and its first step on the category colour. No stamp, serial or stub. */
function HowToStart({ card }: { card: MoodCard }) {
  return (
    <PressLink
      to={cornerPath(card.spaceSlug, card.cornerSlug)}
      className="flex h-[236px] w-[236px] flex-col justify-between overflow-hidden rounded-control bg-[var(--cat)] p-4 text-[var(--ink)]"
    >
      <span className="truncate text-small font-semibold">{card.label}</span>
      <span className="flex flex-col gap-1">
        <span className="text-small font-semibold">How to start</span>
        <span className="text-lead">{tieNumbers(card.guide.step)}</span>
      </span>
    </PressLink>
  );
}

/** A ticket to an event: the Corner, the event, its Space, time and place, "I’m going", and a stub edge behind a dashed divider. */
function EventCard({
  card,
  ticket,
  serial,
  going,
  busy,
  onGoing,
}: {
  card: MoodCard;
  ticket: EventTicket;
  serial: string;
  going: boolean;
  busy: boolean;
  onGoing: () => void;
}) {
  return (
    <TicketFrame
      to={ticketPath(ticket)}
      label={`${ticket.event.title}, ${ticket.space.name}`}
      className="flex h-[236px] w-[300px] overflow-hidden rounded-control bg-[var(--cat)] text-[var(--ink)]"
    >
      <span className="pointer-events-none relative flex min-w-0 flex-1 flex-col gap-1 p-4">
        <span className="truncate text-small font-semibold">{card.label}</span>
        <span className="line-clamp-2 break-words text-lead">{ticket.event.title}</span>
        <span className="truncate text-small">{spaceAndPlace(ticket)}</span>
        <span className="truncate text-small tabular-nums">
          <time dateTime={ticket.event.startsAt}>{eventTime(ticket)}</time>
        </span>
        <GoingButton going={going} busy={busy} onClick={onGoing} className="mt-auto bg-[var(--ink)] text-[var(--cat)]" />
      </span>
      {/* The stamp is decoration; the event carries the meaning. */}
      <span aria-hidden="true" className="pointer-events-none relative flex w-[50px] shrink-0 items-center justify-center border-l-2 border-dashed border-[color-mix(in_srgb,var(--ink)_55%,transparent)]">
        <span className="text-caption font-semibold [text-orientation:mixed] [writing-mode:vertical-rl]">{`Admit one · ${serial}`}</span>
      </span>
    </TicketFrame>
  );
}

/**
 * "Start here": the row of cards. A Corner with an upcoming event in an Open
 * Space gets a ticket to it; any other gets a "How to start" card. `moodLine`
 * names the chosen mood over the row ("Things to make tonight") so a pick is
 * answered by what is below it.
 */
export const StartHere = forwardRef<
  HTMLUListElement,
  {
    cards: { card: MoodCard; serial: number }[];
    ticketFor: (card: MoodCard) => EventTicket | null;
    going: ReadonlySet<number>;
    busyEvent: number | null;
    onGoing: (eventId: number) => void;
    moodLine: string;
    /** Where "See all" goes: every Corner for the chosen mood. Null when the mood has no full list. */
    seeAllTo?: string | null;
    fading: boolean;
  }
>(
  function StartHere({ cards, ticketFor, going, busyEvent, onGoing, moodLine, seeAllTo, fading }, ref) {
    if (cards.length === 0) return null;
    return (
      <section className={SECTION_GAP} aria-labelledby="start-here-title">
        <div className="mb-1 flex items-center gap-2 text-small font-semibold text-accent-text">
          <span>Start here</span>
          <Arrow />
        </div>
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 id="start-here-title" className={`text-title transition-opacity duration-fast ${fading ? "opacity-0" : "opacity-100"}`}>
            {moodLine}
          </h2>
          {seeAllTo && (
            <Link to={seeAllTo} className="inline-flex min-h-11 shrink-0 items-center text-small font-semibold text-accent-text hover:underline">
              See all
            </Link>
          )}
        </div>
        <div className={`transition-opacity duration-fast ${fading ? "opacity-0" : "opacity-100"}`}>
          <HorizontalRow name="discover.startHere" label={moodLine} listRef={ref}>
            {cards.map(({ card, serial }, i) => (
              <li key={`${card.spaceSlug}-${card.cornerSlug}`} className="shrink-0 snap-start" style={cornerStyle(card.spaceSlug, card.cornerSlug)}>
                <Reveal index={i}>
                  {(() => {
                    const ticket = ticketFor(card);
                    return ticket ? (
                      <EventCard
                        card={card}
                        ticket={ticket}
                        serial={String(serial).padStart(4, "0")}
                        going={going.has(ticket.event.id)}
                        busy={busyEvent === ticket.event.id}
                        onGoing={() => onGoing(ticket.event.id)}
                      />
                    ) : (
                      <HowToStart card={card} />
                    );
                  })()}
                </Reveal>
              </li>
            ))}
          </HorizontalRow>
        </div>
      </section>
    );
  },
);
