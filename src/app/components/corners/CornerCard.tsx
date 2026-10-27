import { PressLink } from "../afterhours/PressLink";
import { ImageWithFallback } from "../ImageWithFallback";
import { cornerPath } from "../../lib/cornerPath";
import { cornerPhoto, cornerPhotoAlt } from "../../lib/cornerPhoto";
import { cornerStyle } from "../../lib/categoryStyle";
import { cornerGuide } from "../../data/cornerGuides";

/**
 * A Corner as a photo card, 4:5: its photo fills the card, a dark gradient at
 * the bottom carries the name and one line under it. 240px wide from md, 70% of
 * the screen on a phone, so the next card is always cut off at the edge.
 * `subline` is empty when there is nothing to say. With a mouse, hovering or
 * focusing a card also shows what the Corner is, in a line or two, above the
 * name (from cornerGuides.ts; a Corner without one shows nothing extra).
 */
export function CornerCard({
  corner,
  subline,
}: {
  corner: { spaceSlug: string; slug: string; name: string };
  subline: string;
}) {
  const about = cornerGuide(corner.spaceSlug, corner.slug)?.about;
  return (
    <li className="w-[70vw] shrink-0 snap-start md:w-[240px]" style={cornerStyle(corner.spaceSlug, corner.slug)}>
      <PressLink
        to={cornerPath(corner.spaceSlug, corner.slug)}
        className="group relative block aspect-[4/5] overflow-hidden rounded-card bg-[var(--cat)] text-on-media shadow-card transition-shadow duration-base hover:shadow-overlay focus-visible:shadow-overlay"
      >
        <ImageWithFallback
          src={cornerPhoto(corner.spaceSlug, corner.slug, 600)}
          alt={cornerPhotoAlt(corner.slug)}
          width={240}
          tint
          className="absolute inset-0 size-full"
        />
        <span className="bg-scrim pointer-events-none absolute inset-0" aria-hidden="true" />
        {about && <span className="pointer-events-none absolute inset-0 bg-scrim-solid/25 opacity-0 transition-opacity duration-base group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:hidden" aria-hidden="true" />}
        <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-4">
          {about && (
            <span className="line-clamp-3 max-h-0 overflow-hidden text-small text-on-media/90 opacity-0 transition-[max-height,opacity,margin] duration-base group-hover:mb-1 group-hover:max-h-20 group-hover:opacity-100 group-focus-visible:mb-1 group-focus-visible:max-h-20 group-focus-visible:opacity-100 [@media(hover:none)]:hidden">
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
