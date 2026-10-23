import { Link } from "react-router";
import { ImageWithFallback } from "../ImageWithFallback";
import { GeneratedArt } from "../GeneratedArt";
import { PressLink } from "../afterhours/PressLink";
import type { Post } from "../../data/posts";
import type { MoodCard } from "../../data/moodCards";
import { cornerStyle } from "../../lib/categoryStyle";
import { displayStyle } from "../../lib/doorList";
import { tieNumbers } from "../../lib/typography";
import { SECTION_GAP } from "../../lib/pageGrid";

/**
 * The cover story: the top ticket with a public photo, shown big. A 4:5 photo with the Corner and
 * the step over a bottom scrim and the "Admit one" sticker top right. The photo
 * is the newest public Moment in that Corner from someone you follow, else any
 * public one; with none, the category colour fills the frame.
 */
export function CoverStory({ card, photo, fading }: { card: MoodCard; photo: Post | null; fading: boolean }) {
  const to = `/corner/${card.cornerSlug}`;
  const sticker = (
    <span
      className={`door-wobble absolute flex size-[92px] items-center justify-center rounded-full bg-[var(--accent)] text-center text-[var(--accent-foreground)] ${photo ? "right-4 top-4" : "bottom-4 right-4"}`}
      style={displayStyle(18, { lineHeight: 1 })}
      aria-hidden="true"
    >
      Admit one
    </span>
  );
  return (
    <section
      className={`${SECTION_GAP} transition-opacity duration-fast lg:col-span-7 ${fading ? "opacity-0" : "opacity-100"}`}
      aria-label="Cover story"
      style={cornerStyle(card.spaceSlug, card.cornerSlug)}
    >
      {photo ? (
        <PressLink to={to} className="relative block aspect-[4/5] overflow-hidden rounded-card bg-surface-muted lg:max-h-[80vh] lg:w-full">
          <ImageWithFallback
            src={photo.mediaUrls?.[0] ?? photo.media}
            alt=""
            width={720}
            priority
            className="absolute inset-0 size-full"
            fallback={<GeneratedArt hobbySlug={photo.hobbySlug} seed={photo.id} className="size-full" />}
          />
          <div className="absolute inset-0 bg-[image:var(--scrim-card)]" aria-hidden="true" />
          <div className="absolute inset-x-5 bottom-5 flex flex-col gap-2">
            <span className="text-caption font-semibold text-[var(--cat)]">{`Cover story · ${card.label}`}</span>
            <span style={displayStyle(44, { lineHeight: 1.02 })} className="text-[var(--photo-text)]">
              {tieNumbers(card.guide.step)}
            </span>
          </div>
          {sticker}
        </PressLink>
      ) : (
        // No Corner has a public photo yet: a typographic cover, the step set large at the top left.
        <PressLink to={to} className="relative block aspect-[4/3] overflow-hidden rounded-card bg-[var(--cat)] p-5 lg:aspect-auto lg:min-h-[320px] text-[var(--ink)]">
          <span className="block text-caption font-semibold">{`Cover story · ${card.label}`}</span>
          <span className="mt-2 block" style={displayStyle(40, { lineHeight: 1.02 })}>
            {tieNumbers(card.guide.step)}
          </span>
          {sticker}
        </PressLink>
      )}
      <div className="mt-3 flex items-center justify-end gap-4">
        <Link to={to} className="inline-flex min-h-11 items-center text-small font-semibold text-[var(--accent-text)] hover:underline">
          Take the ticket
        </Link>
      </div>
    </section>
  );
}
