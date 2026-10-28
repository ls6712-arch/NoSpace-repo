import { PressLink } from "../afterhours/PressLink";
import { ImageWithFallback } from "../ImageWithFallback";
import { cornerPath } from "../../lib/cornerPath";
import { cornerPhoto, cornerPhotoAlt } from "../../lib/cornerPhoto";
import { cornerStyle } from "../../lib/categoryStyle";
import { cornerAbout } from "../../data/curatedCorners";

/**
 * A Corner as a landscape photo card, 16:9: its photo fills the card, a dark
 * gradient at the bottom carries the name and one line under it. 288px wide
 * from md, 240px on a phone, so the next card is always cut off at the edge.
 * `subline` is empty when there is nothing to say. With a mouse, the card
 * grows a little and glows; hovering or focusing it also shows what the Corner
 * is, in a line or two, above the name (from cornerGuides.ts; a Corner without
 * one shows nothing extra).
 */
export function CornerCard({
  corner,
  subline,
  fluid = false,
}: {
  corner: { spaceSlug: string; slug: string; name: string };
  subline: string;
  /** Fill the width it is given (a grid cell) instead of the fixed width a row uses. */
  fluid?: boolean;
}) {
  const about = cornerAbout(corner.spaceSlug, corner.slug);
  return (
    <li className={fluid ? "w-full" : "w-60 shrink-0 snap-start md:w-72"} style={cornerStyle(corner.spaceSlug, corner.slug)}>
      <PressLink
        to={cornerPath(corner.spaceSlug, corner.slug)}
        className="group relative block aspect-video overflow-hidden rounded-card bg-[var(--cat)] text-on-media shadow-card transition-shadow duration-base hover:z-10 hover:shadow-glow focus-visible:shadow-glow"
      >
        <ImageWithFallback
          src={cornerPhoto(corner.spaceSlug, corner.slug, 600)}
          alt={cornerPhotoAlt(corner.slug)}
          width={288}
          tint
          className="absolute inset-0 size-full"
        />
        <span className="bg-scrim pointer-events-none absolute inset-0" aria-hidden="true" />
        {about && <span className="pointer-events-none absolute inset-0 bg-scrim-solid/25 opacity-0 transition-opacity duration-base group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:hidden" aria-hidden="true" />}
        <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-3">
          {about && (
            <span className="line-clamp-2 max-h-0 overflow-hidden text-small text-on-media/90 opacity-0 transition-[max-height,opacity,margin] duration-base group-hover:mb-1 group-hover:max-h-12 group-hover:opacity-100 group-focus-visible:mb-1 group-focus-visible:max-h-12 group-focus-visible:opacity-100 [@media(hover:none)]:hidden">
              {about}
            </span>
          )}
          <span className="truncate text-lead font-semibold">{corner.name}</span>
          {subline && <span className="truncate text-small text-on-media/90">{subline}</span>}
        </span>
      </PressLink>
    </li>
  );
}
