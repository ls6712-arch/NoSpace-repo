import { cornerPath } from "../../lib/cornerPath";
import { ImageWithFallback } from "../ImageWithFallback";
import { GeneratedArt } from "../GeneratedArt";
import { PressLink } from "../afterhours/PressLink";
import { GoingButton, TicketFrame, eventTime, spaceAndPlace, ticketPath } from "./EventParts";
import type { Post } from "../../data/posts";
import type { MoodCard } from "../../data/moodCards";
import { cornerStyle } from "../../lib/categoryStyle";
import { cornerPhoto, cornerPhotoAlt } from "../../lib/cornerPhoto";
import type { EventTicket } from "../../lib/eventTicket";
import { momentAlt } from "../../lib/momentCaption";
import { tieNumbers } from "../../lib/typography";

/**
 * The cover story: the top card, shown big over a photo with the text on a
 * bottom scrim. The photo is the newest public Moment in that Corner from
 * someone you follow, else any public one; with none, the Corner's own photo
 * (hobbyPhotos.ts). Never a flat colour block.
 *
 * With an upcoming event in an Open Space it is a ticket to that event: the
 * event, its Space, time and place, "I’m going", and the "Admit one" sticker;
 * tapping the card or the sticker opens it. With none it is a plain "How to
 * start" card, with no sticker, that links to the Corner.
 */
export function CoverStory({
  card,
  photo,
  ticket,
  going,
  busy,
  onGoing,
  fading,
}: {
  card: MoodCard;
  photo: Post | null;
  ticket: EventTicket | null;
  going: boolean;
  busy: boolean;
  onGoing: () => void;
  fading: boolean;
}) {
  const src = photo ? (photo.mediaUrls?.[0] ?? photo.media) : cornerPhoto(card.spaceSlug, card.cornerSlug, 1200);
  const alt = photo ? momentAlt(photo, card.label) : cornerPhotoAlt(card.cornerSlug) || card.label;
  const frame = `relative block overflow-hidden rounded-card bg-[var(--cat)] text-[var(--photo-text)] ${ticket ? "aspect-[4/3] sm:aspect-[16/10]" : "aspect-[16/10]"}`;
  const art = (
    <>
      <ImageWithFallback
        src={src}
        alt={alt}
        width={photo ? 720 : 1200}
        priority
        tint
        className="absolute inset-0 size-full"
        fallback={photo ? <GeneratedArt hobbySlug={photo.hobbySlug} seed={photo.id} className="size-full" /> : undefined}
      />
      <div className="absolute inset-0 bg-[image:var(--scrim-card)]" aria-hidden="true" />
      {/* A second, stronger scrim under the text: a two-line title puts the kicker well up the photo. */}
      <div
        className="absolute inset-x-0 bottom-0 h-full"
        style={{ backgroundImage: "linear-gradient(to top, color-mix(in srgb, var(--ink) 92%, transparent), color-mix(in srgb, var(--ink) 80%, transparent) 65%, transparent)" }}
        aria-hidden="true"
      />
    </>
  );
  return (
    <section
      className={`mb-1 transition-opacity duration-fast md:mb-12 lg:col-span-7 ${fading ? "opacity-0" : "opacity-100"}`}
      aria-label="Cover story"
      style={cornerStyle(card.spaceSlug, card.cornerSlug)}
    >
      {ticket ? (
        <TicketFrame to={ticketPath(ticket)} label={`${ticket.event.title}, ${ticket.space.name}`} className={frame}>
          {art}
          <div className="pointer-events-none absolute inset-x-5 bottom-5 flex flex-col items-start gap-2">
            <span className="text-small font-semibold">{`Cover story · ${card.label}`}</span>
            <span className="line-clamp-2 break-words text-title lg:text-display">{ticket.event.title}</span>
            <span className="text-body tabular-nums">
              <time dateTime={ticket.event.startsAt}>{eventTime(ticket)}</time>
              {` · ${spaceAndPlace(ticket)}`}
            </span>
            <GoingButton going={going} busy={busy} onClick={onGoing} className="mt-1 bg-[var(--accent)] text-[var(--accent-foreground)]" />
          </div>
          {/* The sticker is decoration over the card's own link, so tapping it opens the ticket too. */}
          <span
            className="door-wobble pointer-events-none absolute right-3 top-3 flex size-14 items-center justify-center rounded-full bg-[var(--accent)] text-center text-caption font-semibold text-[var(--accent-foreground)] lg:right-4 lg:top-4 lg:size-[92px] lg:text-lead"
            aria-hidden="true"
          >
            Admit one
          </span>
        </TicketFrame>
      ) : (
        <PressLink to={cornerPath(card.spaceSlug, card.cornerSlug)} className={frame}>
          {art}
          <div className="absolute inset-x-5 bottom-5 flex flex-col gap-2">
            <span className="text-small font-semibold">{`Cover story · ${card.label}`}</span>
            <span className="text-small font-semibold">How to start</span>
            <span className="text-title lg:text-display">{tieNumbers(card.guide.step)}</span>
          </div>
        </PressLink>
      )}
    </section>
  );
}
