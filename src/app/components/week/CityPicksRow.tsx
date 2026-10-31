import { Landmark } from "lucide-react";
import { CATEGORY_ICON, catStyle } from "../../lib/categoryStyle";
import { pickCategorySlug, pickPill, type CityPick } from "../../lib/cityPicks";
import { WEEK_VIEW } from "../../lib/homeCopy";
import { HorizontalRow } from "../HorizontalRow";
import { TiltedIcon } from "../ui/TiltedIcon";

/**
 * "This week in New York": hand-picked cards in a snap row, 260 by 156. Each
 * takes its colour, with the Corner's icon at 22% ink bleeding off a corner, a
 * dark pill with the day, time and price, then the title and place. A pick
 * with a link opens it in a new tab. With no picks the whole row is gone.
 */
export function CityPicksRow({ picks }: { picks: readonly CityPick[] }) {
  if (picks.length === 0) return null;
  return (
    <section aria-labelledby="city-picks-h" className="flex flex-col gap-3">
      <div>
        <h2 id="city-picks-h" className="text-lead">
          {WEEK_VIEW.cityPicks}
        </h2>
        <p className="text-small text-muted-foreground">{WEEK_VIEW.pickedBy}</p>
      </div>
      <HorizontalRow name="week.cityPicks" label={WEEK_VIEW.cityPicks} contentKey={picks.map((p) => p.id).join("|")}>
        {picks.map((p) => {
          const Icon = CATEGORY_ICON[pickCategorySlug(p) ?? ""] ?? Landmark;
          const body = (
            <>
              <TiltedIcon icon={Icon} />
              <span className="relative inline-flex w-fit max-w-full self-start rounded-full bg-[var(--ink)] px-3 py-1 text-caption font-semibold text-[var(--photo-text)]">
                <span className="truncate">{pickPill(p)}</span>
              </span>
              <span className="relative mt-auto flex flex-col gap-0.5">
                <span className="line-clamp-2 text-title font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                  {p.title}
                </span>
                {p.place && <span className="truncate text-small opacity-80">{p.place}</span>}
              </span>
            </>
          );
          const cls = "relative flex h-[156px] w-[260px] shrink-0 snap-start flex-col overflow-hidden rounded-card bg-[var(--cat)] p-4 text-[var(--ink)]";
          return (
            <li key={p.id} style={catStyle(p.color)} className="shrink-0 snap-start">
              {p.url ? (
                <a href={p.url} target="_blank" rel="noopener noreferrer" className={cls}>
                  {body}
                </a>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </HorizontalRow>
    </section>
  );
}
