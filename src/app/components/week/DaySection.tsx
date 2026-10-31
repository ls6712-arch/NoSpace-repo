import { Link } from "react-router";
import { track } from "../../lib/analytics";
import { WEEK_VIEW } from "../../lib/homeCopy";
import type { Pass } from "../../lib/tasteModel";
import { canBring } from "../../lib/weekActions";
import { dayDate, dayHeading, findSomethingPath, FREE_LABEL, nothingOnLine, type DayContent, type WeekPlanDetail } from "../../lib/weekView";
import { PlanTicketRow } from "./PlanTicketRow";

/**
 * One day. The heading is Tonight or Today, Tomorrow, then the weekday, with
 * the date beside it. Inside, in time order: plans as tickets and free windows
 * with no plan as dashed slots. A day with neither shrinks to one row.
 */
export function DaySection({
  content,
  now,
  passes,
  onBring,
  heading,
}: {
  content: DayContent;
  now: number;
  passes: readonly Pass[];
  onBring: (plan: WeekPlanDetail) => void;
  /** Overrides the heading and date (the calendar's own wording, with no "Tonight"). */
  heading?: { title: string; date: string };
}) {
  const { day, plans, free } = content;
  const id = `week-day-${day.offset}`;
  if (plans.length === 0 && free.length === 0) {
    return (
      <section id={id} aria-label={nothingOnLine(day)} className="flex h-12 scroll-mt-4 items-center rounded-control px-1 text-small text-muted-foreground">
        {nothingOnLine(day)}
      </section>
    );
  }
  const items = [
    ...plans.map((p) => ({ at: p.startsAt, plan: p, slot: null as null })),
    ...free.map((f) => ({ at: f.startMs, plan: null as null, slot: f })),
  ].sort((a, b) => a.at - b.at);
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="flex scroll-mt-4 flex-col gap-3">
      <h2 id={`${id}-h`} className="flex items-baseline gap-2">
        <span className="text-lead">{heading?.title ?? dayHeading(day, now)}</span>
        <span className="text-small font-normal text-muted-foreground">{heading?.date ?? dayDate(day, now)}</span>
      </h2>
      <ul className="flex flex-col gap-3">
        {items.map((it) =>
          it.plan ? (
            <PlanTicketRow key={it.plan.id} plan={it.plan} passes={passes} canBring={canBring(it.plan)} onBring={onBring} />
          ) : (
            <li
              key={it.slot.keys.join("+")}
              className="flex min-h-14 items-center justify-between gap-3 rounded-card border-[1.5px] border-dashed border-border px-4"
            >
              <span className="text-body font-semibold">{FREE_LABEL[it.slot.part]}</span>
              <Link
                to={findSomethingPath(it.slot)}
                onClick={() => track({ name: "week_find_something", window: it.slot.keys[0] })}
                className="inline-flex min-h-11 items-center text-small font-semibold text-accent-text underline-offset-4 hover:underline"
              >
                {WEEK_VIEW.findSomething}
              </Link>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
