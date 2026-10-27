import { PressLink } from "../afterhours/PressLink";
import { ImageWithFallback } from "../ImageWithFallback";
import { cornerPath } from "../../lib/cornerPath";
import { cornerPhoto } from "../../lib/cornerPhoto";

/**
 * A Corner as a photo card, 4:5: its photo fills the card, a dark gradient at
 * the bottom carries the name and one line under it. 240px wide from md, 70% of
 * the screen on a phone, so the next card is always cut off at the edge.
 * `subline` is empty when there is nothing to say.
 */
export function CornerCard({
  corner,
  subline,
}: {
  corner: { spaceSlug: string; slug: string; name: string };
  subline: string;
}) {
  return (
    <li className="w-[70vw] shrink-0 snap-start md:w-[240px]">
      <PressLink
        to={cornerPath(corner.spaceSlug, corner.slug)}
        className="relative block aspect-[4/5] overflow-hidden rounded-card bg-surface-muted text-on-media"
      >
        <ImageWithFallback
          src={cornerPhoto(corner.spaceSlug, corner.slug, 600)}
          alt=""
          width={240}
          className="absolute inset-0 size-full"
        />
        <span className="bg-scrim pointer-events-none absolute inset-0" aria-hidden="true" />
        <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-4">
          <span className="truncate text-lead font-semibold">{corner.name}</span>
          {subline && <span className="truncate text-small text-on-media/90">{subline}</span>}
        </span>
      </PressLink>
    </li>
  );
}
