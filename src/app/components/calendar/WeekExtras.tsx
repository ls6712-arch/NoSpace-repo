import { Link } from "react-router";
import { WEEK_VIEW } from "../../lib/homeCopy";
import type { Budget } from "../../lib/tasteModel";
import type { Spend } from "../../lib/weekView";
import type { CityPick } from "../../lib/cityPicks";
import { SPAN_GRID } from "../layout/PageShell";
import { CityPicksSection } from "../week/AskStubby";
import { GlanceCard } from "../week/GlanceCard";

/**
 * What the Week view adds under the days when it is the week that starts today:
 * the at-a-glance card (good plan hours, free evenings, monthly budget), "This
 * week in New York" with a way to ask Stubby for something else, the Sunday night card and the link to change free time.
 */
export function WeekExtras({
  goodHours,
  windows,
  budget,
  spend,
  picks,
  noWindows,
  onBudget,
}: {
  goodHours: number;
  windows: readonly string[];
  budget: Budget | null;
  spend: Spend;
  picks: readonly CityPick[];
  noWindows: boolean;
  onBudget: (b: Budget) => void;
}) {
  return (
    <div className="mt-6 flex flex-col gap-6">
      <GlanceCard goodHours={goodHours} windows={windows} budget={budget} spend={spend} onBudget={onBudget} />
      <CityPicksSection picks={picks} />
      {noWindows && (
        <Link to="/week/free?from=week" className={`flex min-h-14 items-center rounded-card border-[1.5px] border-dashed border-border px-4 py-3 text-body font-semibold text-foreground ${SPAN_GRID}`}>
          {WEEK_VIEW.noFreeTitle}
        </Link>
      )}
      <section className="flex flex-col gap-1 rounded-card border border-border bg-card p-4">
        <h2 className="text-lead">{WEEK_VIEW.flipTitle}</h2>
        <p className="text-body text-muted-foreground">{WEEK_VIEW.flipBody}</p>
      </section>
      <Link to="/week/free?from=week" className="inline-flex min-h-11 items-center self-start text-small font-semibold text-accent-text underline-offset-4 hover:underline">
        {WEEK_VIEW.changeFree}
      </Link>
    </div>
  );
}
