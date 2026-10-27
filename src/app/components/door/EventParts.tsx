import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Link } from "react-router";
import { motion } from "motion/react";
import type { EventTicket } from "../../lib/eventTicket";
import { eventPlace } from "../../lib/eventTicket";
import { formatStarts } from "../../lib/dates";
import { HOVER_SCALE, PRESS_SCALE, springs } from "../../lib/springs";

/** Where to open a ticket: the Space's events. */
export const ticketPath = (t: EventTicket) => `/space/${t.space.slug}?tab=events`;

/** "Starts in 4h" or "Sat, Oct 31, 7:00 PM", from the shared date helper. */
export const eventTime = (t: EventTicket) => formatStarts(t.event.startsAt, { timeZone: t.event.timezone });

/** "Clay Hands · Riverside, Portland", or just the Space when no place is given. */
export function spaceAndPlace(t: EventTicket): string {
  const place = eventPlace(t.event);
  return place ? `${t.space.name} · ${place}` : t.space.name;
}

/**
 * A card that opens its ticket when tapped anywhere, with a real button inside
 * (a button can't sit inside a link). The link is stretched over the card and under the button;
 * anything in `children` that must be tappable sets pointer-events-auto.
 */
export function TicketFrame({
  to,
  label,
  className,
  children,
}: {
  to: string;
  label: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <motion.div className={`relative ${className}`} whileTap={{ scale: PRESS_SCALE }} whileHover={{ scale: HOVER_SCALE }} transition={springs.press}>
      {children}
      <Link to={to} aria-label={label} className="absolute inset-0 z-[5] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-current" />
    </motion.div>
  );
}

/** "I’m going" (the event RSVP): a pressed state with a check once you are. */
export function GoingButton({
  going,
  busy,
  onClick,
  className,
}: {
  going: boolean;
  busy: boolean;
  onClick: () => void;
  className: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={going}
      disabled={busy}
      onClick={onClick}
      className={`pointer-events-auto relative z-10 inline-flex min-h-11 items-center justify-center self-start rounded-control px-5 text-small font-semibold disabled:opacity-60 ${className}`}
    >
      {going && <Check className="mr-2 size-4" aria-hidden="true" />}
      I’m going
    </button>
  );
}
