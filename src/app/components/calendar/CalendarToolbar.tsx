import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { STEP_LABEL, VIEWS, VIEW_LABEL, type CalendarView } from "../../lib/calendarView";
import { cn } from "../ui/utils";

const ROUND = "inline-flex size-11 items-center justify-center rounded-full border border-border bg-card text-foreground disabled:opacity-40";

/**
 * The row under the title: Today, previous and next (44px, named for the period
 * they move by), the Day, Week, Month, Year, List switch (the chosen one in the
 * foreground fill), and then Make a plan, the one coral fill on every screen size.
 * Below 1128px a Show button opens the Show panel as a sheet.
 */
export function CalendarToolbar({
  view,
  showButton,
  canPrev,
  canNext,
  onToday,
  onStep,
  onView,
  onShow,
  onMakePlan,
  years = [],
  year,
  onYear,
}: {
  view: CalendarView;
  /** Below 1128px the Show panel is a sheet, opened from here. */
  showButton: boolean;
  canPrev: boolean;
  canNext: boolean;
  onToday: () => void;
  onStep: (dir: -1 | 1) => void;
  onView: (view: CalendarView) => void;
  onShow: () => void;
  onMakePlan: () => void;
  /** The years a person can open. With more than one, Month and Year show a year switch. */
  years?: readonly number[];
  year?: number;
  onYear?: (year: number) => void;
}) {
  const yearSwitch = (view === "month" || view === "year") && years.length > 1 && year !== undefined && onYear;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onToday} className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-small font-semibold">
          Today
        </button>
        <button type="button" aria-label={STEP_LABEL[view].prev} disabled={!canPrev} onClick={() => onStep(-1)} className={ROUND}>
          <ChevronLeft aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </button>
        <button type="button" aria-label={STEP_LABEL[view].next} disabled={!canNext} onClick={() => onStep(1)} className={ROUND}>
          <ChevronRight aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </button>
      </div>
      <div role="group" aria-label="View" className="flex rounded-full border border-border bg-card p-1 max-tab:order-last max-tab:w-full">
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={v === view}
            onClick={() => onView(v)}
            className={cn(
              "min-h-11 flex-1 rounded-full px-2 text-small font-semibold tab:px-4",
              v === view ? "bg-foreground text-background" : "text-muted-foreground",
            )}
          >
            {VIEW_LABEL[v]}
          </button>
        ))}
      </div>
      {yearSwitch && (
        <div role="group" aria-label="Year" className="flex max-w-full overflow-x-auto rounded-full border border-border bg-card p-1">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              aria-pressed={y === year}
              onClick={() => onYear(y)}
              className={cn("min-h-11 shrink-0 rounded-full px-4 text-small font-semibold tabular-nums", y === year ? "bg-foreground text-background" : "text-muted-foreground")}
            >
              {y}
            </button>
          ))}
        </div>
      )}
      <div className="ml-auto flex items-center gap-2">
        {showButton && (
          <button type="button" onClick={onShow} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-small font-semibold">
            <SlidersHorizontal aria-hidden="true" strokeWidth={1.75} className="size-4" />
            Show
          </button>
        )}
        <button type="button" onClick={onMakePlan} className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-small font-semibold text-accent-foreground">
          Make a plan
        </button>
      </div>
    </div>
  );
}
