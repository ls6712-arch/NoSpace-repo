import { dayMark, tileLabel, tileParts, type DayContent } from "../../lib/weekView";
import { WEEK_VIEW } from "../../lib/homeCopy";
import { cn } from "../ui/utils";

/**
 * The seven days as equal tiles: weekday, then date, with a mark under it. A
 * dot in the accent colour when the day has a plan, a ring when it only has
 * free time, nothing otherwise. Tapping a tile highlights it and the screen
 * scrolls to that day.
 */
export function DayStrip({ days, selected, onSelect }: { days: readonly DayContent[]; selected: number; onSelect: (offset: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <ul className="grid grid-cols-7 gap-1.5">
        {days.map((c) => {
          const { weekday, date } = tileParts(c.day);
          const mark = dayMark(c);
          const on = selected === c.day.offset;
          return (
            <li key={c.day.offset}>
              <button
                type="button"
                aria-label={tileLabel(c)}
                aria-pressed={on}
                onClick={() => onSelect(c.day.offset)}
                className={cn(
                  "flex min-h-16 w-full flex-col items-center justify-center gap-0.5 rounded-control border border-border py-2 transition-transform active:scale-[0.97]",
                  on ? "bg-foreground text-background" : "bg-card text-foreground",
                )}
              >
                <span className={cn("text-caption font-semibold", on ? "opacity-80" : "text-muted-foreground")}>{weekday}</span>
                <span className="text-lead font-bold leading-none" style={{ fontFamily: "var(--font-display)" }}>
                  {date}
                </span>
                <span aria-hidden="true" className="flex h-2 items-center">
                  {mark === "plan" && <span className="size-2 rounded-full bg-accent" />}
                  {mark === "free" && <span className={cn("size-2 rounded-full border-[1.5px]", on ? "border-background" : "border-muted-foreground")} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="flex items-center gap-4 text-caption text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
          {WEEK_VIEW.keyPlan}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full border-[1.5px] border-muted-foreground" />
          {WEEK_VIEW.keyFree}
        </span>
      </p>
    </div>
  );
}
