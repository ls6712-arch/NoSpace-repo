import { cornerPath } from "../../lib/cornerPath";
import { Link } from "react-router";
import { ImageWithFallback } from "../ImageWithFallback";
import { GeneratedArt } from "../GeneratedArt";
import { PressLink } from "../afterhours/PressLink";
import type { Post } from "../../data/posts";
import type { MoodCard } from "../../data/moodCards";
import { cornerStyle } from "../../lib/categoryStyle";
import { cornerPhoto, cornerPhotoAlt } from "../../lib/cornerPhoto";
import { momentAlt } from "../../lib/momentCaption";
import { tieNumbers } from "../../lib/typography";

/**
 * The cover story: the top ticket, shown big over a photo with the Corner and
 * the step on a bottom scrim, and the "Admit one" sticker top right. The photo
 * is the newest public Moment in that Corner from someone you follow, else any
 * public one; with none, the Corner's own photo (hobbyPhotos.ts). Never a flat
 * colour block.
 */
export function CoverStory({ card, photo, fading }: { card: MoodCard; photo: Post | null; fading: boolean }) {
  const to = cornerPath(card.spaceSlug, card.cornerSlug);
  const src = photo ? (photo.mediaUrls?.[0] ?? photo.media) : cornerPhoto(card.spaceSlug, card.cornerSlug, 1200);
  const alt = photo ? momentAlt(photo, card.label) : cornerPhotoAlt(card.cornerSlug) || card.label;
  return (
    <section
      className={`mb-1 transition-opacity duration-fast md:mb-12 lg:col-span-7 ${fading ? "opacity-0" : "opacity-100"}`}
      aria-label="Cover story"
      style={cornerStyle(card.spaceSlug, card.cornerSlug)}
    >
      <PressLink to={to} className="relative block aspect-[16/10] overflow-hidden rounded-card bg-[var(--cat)] text-[var(--photo-text)] lg:aspect-[16/10]">
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
        {/* A second, stronger scrim under the text: a two-line step puts the kicker well up the photo. */}
        <div
          className="absolute inset-x-0 bottom-0 h-4/5"
          style={{ backgroundImage: "linear-gradient(to top, color-mix(in srgb, var(--ink) 92%, transparent), color-mix(in srgb, var(--ink) 80%, transparent) 65%, transparent)" }}
          aria-hidden="true"
        />
        <div className="absolute inset-x-5 bottom-5 flex flex-col gap-2">
          <span className="text-small font-semibold">{`Cover story · ${card.label}`}</span>
          <span className="text-title lg:text-display">{tieNumbers(card.guide.step)}</span>
        </div>
        <span
          className="door-wobble text-lead absolute right-4 top-4 flex size-[92px] items-center justify-center rounded-full bg-[var(--accent)] text-center text-[var(--accent-foreground)]"
          aria-hidden="true"
        >
          Admit one
        </span>
      </PressLink>
      <div className="mt-3 flex items-center justify-end gap-4">
        <Link to={to} className="inline-flex min-h-11 items-center text-small font-semibold text-[var(--accent-text)] hover:underline">
          Take the ticket
        </Link>
      </div>
    </section>
  );
}
