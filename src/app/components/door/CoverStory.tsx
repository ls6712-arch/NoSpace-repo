import { Link } from "react-router";
import { ImageWithFallback } from "../ImageWithFallback";
import { GeneratedArt } from "../GeneratedArt";
import { hasRealMedia } from "../MomentCard";
import { PressLink } from "../afterhours/PressLink";
import { postCorner, type Post } from "../../data/posts";
import type { MoodCard } from "../../data/moodCards";
import { cornerStyle } from "../../lib/categoryStyle";
import { displayStyle } from "../../lib/doorList";
import { tieNumbers } from "../../lib/typography";
import { SECTION_GAP } from "../../lib/pageGrid";

/**
 * The cover story: the top ticket, shown big. A 4:5 photo with the Corner and
 * the step over a bottom scrim and the "Admit one" sticker top right. The photo
 * is the newest public Moment in that Corner from someone you follow, else any
 * public one; with none, the category colour fills the frame.
 */
export function pickCoverPhoto(posts: readonly Post[], card: MoodCard, followingIds: ReadonlySet<string>): Post | null {
  const here = posts
    .filter(
      (p) =>
        p.visibility === "public" &&
        p.type === "photo" &&
        hasRealMedia(p) &&
        p.hobbySlug === card.spaceSlug &&
        postCorner(p) === card.cornerSlug,
    )
    .sort((a, b) => b.createdAt - a.createdAt);
  return here.find((p) => p.userId && followingIds.has(p.userId)) ?? here[0] ?? null;
}

export function CoverStory({ card, photo, fading }: { card: MoodCard; photo: Post | null; fading: boolean }) {
  const to = `/corner/${card.cornerSlug}`;
  return (
    <section
      className={`${SECTION_GAP} max-w-[520px] transition-opacity duration-fast ${fading ? "opacity-0" : "opacity-100"}`}
      aria-label="Cover story"
      style={cornerStyle(card.spaceSlug, card.cornerSlug)}
    >
      <PressLink
        to={to}
        className={`relative block aspect-[4/5] overflow-hidden rounded-card ${photo ? "bg-surface-muted" : "bg-[var(--cat)]"}`}
      >
        {photo && (
          <>
            <ImageWithFallback
              src={photo.mediaUrls?.[0] ?? photo.media}
              alt=""
              width={720}
              priority
              className="absolute inset-0 size-full"
              fallback={<GeneratedArt hobbySlug={photo.hobbySlug} seed={photo.id} className="size-full" />}
            />
            <div className="absolute inset-0 bg-[image:var(--scrim-card)]" aria-hidden="true" />
          </>
        )}
        <div className="absolute inset-x-5 bottom-5 flex flex-col gap-2">
          <span className={`text-caption font-semibold ${photo ? "text-[var(--cat)]" : "text-[var(--ink)]"}`}>
            {`Cover story · ${card.label}`}
          </span>
          <span
            style={displayStyle(44, { lineHeight: 1.02 })}
            className={photo ? "text-[var(--photo-text)]" : "text-[var(--ink)]"}
          >
            {tieNumbers(card.guide.step)}
          </span>
        </div>
        <span
          className="door-wobble absolute right-4 top-4 flex size-[92px] items-center justify-center rounded-full bg-[var(--accent)] text-center text-[var(--accent-foreground)]"
          style={displayStyle(18, { lineHeight: 1 })}
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
