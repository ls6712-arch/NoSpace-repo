import { PressLink } from "../afterhours/PressLink";
import type { CuratedCorner } from "../../data/curatedCorners";
import { CoverEmoji } from "./CoverEmoji";
import { cornerStyle } from "../../lib/categoryStyle";

/**
 * A curated Corner as a card: 16:10, the category colour with the emoji large
 * in the middle (the cover photo goes here when there is one), the name at the
 * bottom left and one live line under it. `signal` is empty while the live
 * counts load, so the line never flashes a wrong value.
 */
export function CornerCard({ corner, signal }: { corner: CuratedCorner; signal: string }) {
  return (
    <li className="w-[260px] shrink-0 snap-start sm:w-[300px]" style={cornerStyle(corner.spaceSlug, corner.slug)}>
      <PressLink
        to={`/corners/${corner.slug}`}
        className="relative block aspect-[16/10] overflow-hidden rounded-card bg-[var(--cat)] text-[var(--ink)]"
      >
        <CoverEmoji emoji={corner.emoji} size="card" className="absolute inset-0 flex items-center justify-center pb-8" />
        <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-3.5">
          <span className="truncate text-small font-semibold">{corner.name}</span>
          <span className="min-h-[1.25rem] truncate text-caption">{signal}</span>
        </span>
      </PressLink>
    </li>
  );
}
