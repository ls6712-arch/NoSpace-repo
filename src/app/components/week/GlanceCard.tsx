import { useId } from "react";
import { Link } from "react-router";
import { WEEK_VIEW } from "../../lib/homeCopy";
import type { Budget } from "../../lib/tasteModel";
import { budgetLine, freeEvenings, goodPlanHoursLabel, type Spend } from "../../lib/weekView";
import { BudgetSlider } from "./BudgetSlider";

/**
 * The at-a-glance card: good plan hours, the evenings you said you are free,
 * and the monthly budget. One card, sections split by dividers. A section with
 * nothing true to say is left out (no made-up number, no empty chips).
 */
export function GlanceCard({
  goodHours,
  windows,
  budget,
  spend,
  onBudget,
}: {
  goodHours: number;
  windows: readonly string[];
  budget: Budget | null;
  spend: Spend;
  onBudget: (b: Budget) => void;
}) {
  const lineId = useId();
  const evenings = freeEvenings(windows);
  return (
    <section className="divide-y divide-border rounded-card border border-border bg-card" aria-label="At a glance">
      {goodHours > 0 && (
        <p className="flex items-baseline gap-3 p-4">
          <span className="text-display font-extrabold leading-none" style={{ fontFamily: "var(--font-display)" }}>
            {goodHours}
          </span>
          <span className="text-body text-muted-foreground">{goodPlanHoursLabel(goodHours)}</span>
        </p>
      )}
      {evenings.length > 0 && (
        <div className="flex flex-col gap-2 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-small font-semibold">{WEEK_VIEW.freeEvenings}</h2>
            <Link to="/week/free?from=week" className="inline-flex min-h-11 items-center text-small font-semibold text-accent-text underline-offset-4 hover:underline">
              {WEEK_VIEW.change}
            </Link>
          </div>
          <ul className="-mt-2 flex flex-wrap gap-2">
            {evenings.map((d) => (
              <li key={d} className="rounded-full border border-border px-3 py-1.5 text-small font-semibold">
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex max-w-[560px] flex-col gap-1 p-4">
        <BudgetSlider value={budget} onCommit={onBudget} describedBy={lineId} />
        <p id={lineId} className="text-small text-muted-foreground">
          {budgetLine(budget, spend)}
        </p>
      </div>
    </section>
  );
}
