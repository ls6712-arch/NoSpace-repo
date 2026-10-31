import { Link } from "react-router";
import { track } from "../../lib/analytics";
import { agendaDays, dayListDate, dayListHeading, visiblePlans, type CalendarDay, type CalendarFreeSlot, type Filters } from "../../lib/calendarView";
import { WEEK_VIEW } from "../../lib/homeCopy";
import type { Pass } from "../../lib/tasteModel";
import { canBring } from "../../lib/weekActions";
import { findSomethingPath, FREE_LABEL, type WeekPlanDetail } from "../../lib/weekView";
import { PlanTicketRow } from "../week/PlanTicketRow";
import { DASHED } from "./CalendarChips";
import type { Openers } from "./openers";
import { BlockRows, StubRows } from "./StubRows";
import { cn } from "../ui/utils";

/** The agenda: the next 30 days, one block a day, days with nothing left out. */
export function ListView({
  days,
  now,
  filters,
  passes,
  onBring,
  open,
}: {
  days: readonly CalendarDay[];
  now: number;
  filters: Filters;
  passes: readonly Pass[];
  onBring: (plan: WeekPlanDetail) => void;
  open: Openers;
}) {
  const shown = agendaDays(days, filters);
  if (shown.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-card border border-border bg-card p-4">
        <p className="text-body font-semibold">Nothing planned in the next 30 days.</p>
        <Link to="/discover" className="inline-flex min-h-11 items-center self-start text-small font-semibold text-accent-text underline-offset-4 hover:underline">
          {WEEK_VIEW.findSomething}
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {shown.map((c) => {
        const id = `calendar-day-${c.day.offset}`;
        const plans = visiblePlans(c, filters);
        const free = filters.free ? c.free : [];
        const items = [
          ...plans.map((p) => ({ at: p.startsAt, plan: p, slot: null as null })),
          ...free.map((f) => ({ at: f.startMs, plan: null as null, slot: f })),
        ].sort((a, b) => a.at - b.at);
        return (
          <section key={c.day.offset} aria-labelledby={`${id}-h`} className="flex flex-col gap-3">
            <h2 id={`${id}-h`} className="flex items-baseline gap-2">
              <span className="text-lead">{dayListHeading(c.day, now)}</span>
              <span className="text-small font-normal text-muted-foreground">{dayListDate(c.day, now)}</span>
            </h2>
            <ul className="flex flex-col gap-3">
              {items.map((it) =>
                it.plan ? (
                  <PlanTicketRow key={it.plan.id} plan={it.plan} passes={passes} canBring={canBring(it.plan)} onBring={onBring} onOpen={open.plan} />
                ) : (
                  <li key={it.slot.keys.join("+")} className={cn("flex min-h-14 items-center justify-between gap-3 rounded-card px-4", DASHED)}>
                    <button type="button" onClick={() => open.free(it.slot as CalendarFreeSlot)} className="min-h-11 text-left text-body font-semibold">
                      {FREE_LABEL[it.slot.part]}
                    </button>
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
            {filters.blocks && <BlockRows blocks={c.blocks} onOpen={open.block} />}
            {filters.stubs && <StubRows stubs={c.stubs} onOpen={open.stub} />}
          </section>
        );
      })}
    </div>
  );
}
