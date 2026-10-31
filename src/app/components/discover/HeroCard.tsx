import { Link } from "react-router";
import { motion } from "motion/react";
import { ImageWithFallback } from "../ImageWithFallback";
import { cornerPath } from "../../lib/cornerPath";
import { cornerPhoto, cornerPhotoAlt } from "../../lib/cornerPhoto";
import { cornerStyle } from "../../lib/categoryStyle";
import { curatedBySlug, cornerMeta } from "../../data/curatedCorners";
import type { MoodCard } from "../../data/moodCards";
import type { EventTicket } from "../../lib/eventTicket";
import { eventTime } from "../door/EventParts";
import { viewTransitionAllowed } from "../../lib/useViewTransition";
import { PAGE_FROM, PAGE_TO, page, PRESS_SCALE } from "../../lib/motionTokens";

/** The name a Corner's photo carries into its page, so one grows into the other. */
export const cornerPhotoTransitionName = (cornerSlug: string) => `corner-photo-${cornerSlug}`;

/**
 * The one featured Corner this week: a full photo under a scrim, a badge when
 * it has an event coming up, the Corner's name and the line under it. Tapping
 * opens the Corner with the photo growing into its hero (a view transition,
 * off under reduced motion).
 */
export function HeroCard({ card, ticket }: { card: MoodCard; ticket: EventTicket | null }) {
  const curated = curatedBySlug(card.cornerSlug);
  const meta = curated ? cornerMeta(curated) : "";
  const src = cornerPhoto(card.spaceSlug, card.cornerSlug, 1200);
  return (
    <motion.div initial={PAGE_FROM} animate={PAGE_TO} transition={page} whileTap={{ scale: PRESS_SCALE }} style={cornerStyle(card.spaceSlug, card.cornerSlug)}>
      <Link
        to={cornerPath(card.spaceSlug, card.cornerSlug)}
        viewTransition={viewTransitionAllowed()}
        className="relative block aspect-[4/5] overflow-hidden rounded-card bg-[var(--cat)] text-[var(--photo-text)] tab:aspect-[16/9] desk:aspect-[21/9]"
      >
        <div className="absolute inset-0" style={{ viewTransitionName: cornerPhotoTransitionName(card.cornerSlug) }}>
          <ImageWithFallback src={src} alt={cornerPhotoAlt(card.cornerSlug) || card.label} width={1200} priority className="absolute inset-0 size-full" />
          <div className="absolute inset-0 bg-[image:var(--scrim-card)]" aria-hidden="true" />
          <div
            className="absolute inset-x-0 bottom-0 h-3/4"
            style={{ backgroundImage: "linear-gradient(to top, color-mix(in srgb, var(--ink) 88%, transparent), transparent)" }}
            aria-hidden="true"
          />
        </div>
        <div className="absolute inset-x-5 bottom-5 flex flex-col items-start gap-2">
          {ticket && (
            <span className="rounded-full bg-[var(--cat-amber)] px-3 py-1.5 text-small font-semibold text-[var(--ink)]">
              <time dateTime={ticket.event.startsAt}>{eventTime(ticket)}</time>
            </span>
          )}
          <h2 className="font-[family-name:var(--font-display)] text-display font-extrabold">{card.label}</h2>
          {meta && <p className="text-body">{meta}</p>}
        </div>
      </Link>
    </motion.div>
  );
}

