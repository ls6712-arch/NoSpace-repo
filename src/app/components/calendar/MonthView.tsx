import { catStyle } from "../../lib/categoryStyle";
import { dayListDate, dayListHeading, inMonth, makePlanFor, sameDay, stubColor, visiblePlans, type CalendarDay, type CalendarFreeSlot, type Filters } from "../../lib/calendarView";
import { formatWeekday } from "../../lib/dates";
import { HOME_TZ } from "../../lib/homeWeek";
import { plural } from "../../lib/plural";
import type { Pass } from "../../lib/tasteModel";
import { FREE_LABEL, type WeekPlanDetail } from "../../lib/weekView";
import { DaySection } from "../week/DaySection";
import { cn } from "../ui/utils";
import { BlockChip, FreeChip, PlanChip, StubChip } from "./CalendarChips";
import type { Openers } from "./openers";
import { PickCard, PickChip } from "./PickCard";
import { BlockRows, StubRows } from "./StubRows";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6].map((i) => formatWeekday(Date.UTC(2026, 10, 1 + i, 12), "short", "UTC"));
const MAX_CHIPS = 3;

/** What a day shows after the Show filters: its plans, free slots and Stubs. */
function shown(c: CalendarDay, f: Filters) {
  return { plans: visiblePlans(c, f), free: f.free ? c.free : [], stubs: f.stubs ? c.stubs : [], blocks: f.blocks ? c.blocks : [] };
}

/**
 * Month: Sunday first, 6 rows. From 744px a cell holds up to 3 chips and
 * "{k} more", which opens that day. On a phone a cell is a number: a Stub day
 * is filled with its Corner's colour, a plan is an accent dot; tapping a day
 * lists it under the grid (announced politely).
 */
export function MonthView({
  days,
  anchor,
  now,
  wide,
  filters,
  selected,
  passes,
  onSelect,
  onOpenDay,
  onBring,
  open,
}: {
  days: readonly CalendarDay[];
  anchor: number;
  now: number;
  wide: boolean;
  filters: Filters;
  selected: number;
  passes: readonly Pass[];
  onSelect: (ms: number) => void;
  onOpenDay: (ms: number) => void;
  onBring: (plan: WeekPlanDetail) => void;
  open: Openers;
}) {
  return wide ? (
    <MonthWide days={days} anchor={anchor} now={now} filters={filters} onOpenDay={onOpenDay} open={open} />
  ) : (
    <MonthPhone days={days} anchor={anchor} now={now} filters={filters} selected={selected} passes={passes} onSelect={onSelect} onBring={onBring} open={open} />
  );
}

function MonthWide({ days, anchor, now, filters, onOpenDay, open }: { days: readonly CalendarDay[]; anchor: number; now: number; filters: Filters; onOpenDay: (ms: number) => void; open: Openers }) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-card">
      <div aria-hidden="true" className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((w) => (
          <span key={w} className="px-2 py-2 text-caption font-semibold text-muted-foreground">
            {w}
          </span>
        ))}
      </div>
      <ol className="grid grid-cols-7">
        {days.map((c) => {
          const s = shown(c, filters);
          const chips = [
            ...s.plans.map((p) => ({ key: p.id, node: <PlanChip plan={p} onOpen={open.plan} /> })),
            ...s.blocks.map((b) => ({ key: `block-${b.entry.id}-${b.startMs}`, node: <BlockChip block={b} onOpen={open.block} /> })),
            ...s.stubs.map((st) => ({ key: `stub-${st.id}`, node: <StubChip stub={st} onOpen={open.stub} /> })),
            ...s.free.map((f) => ({ key: f.keys.join("+") + f.startMs, node: filters.picks && f.pick ? <PickChip slot={f} onOpen={open.pick} /> : <FreeChip slot={f} onOpen={open.free} /> })),
          ];
          const extra = Math.max(0, chips.length - MAX_CHIPS);
          const shownChips = extra > 0 ? chips.slice(0, MAX_CHIPS - 1) : chips;
          const hidden = chips.length - shownChips.length;
          const today = sameDay(c.day, now);
          return (
            <li key={c.day.offset} className={cn("flex min-h-28 flex-col gap-1 border-b border-r border-border p-1.5", !inMonth(c.day, anchor) && "bg-background/60")}>
              <button
                type="button"
                onClick={() => onOpenDay(c.day.noonMs)}
                aria-label={`${formatWeekday(c.day.noonMs, "long", HOME_TZ)} ${dayListDate(c.day, now)}${today ? ", today" : ""}`}
                className={cn(
                  "inline-flex min-h-6 min-w-6 items-center justify-center self-start rounded-full px-1 text-small font-bold",
                  today ? "border-[1.5px] border-accent-text text-accent-text" : inMonth(c.day, anchor) ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {c.day.d}
              </button>
              <ul className="flex flex-col gap-1">
                {shownChips.map((x) => (
                  <li key={x.key}>{x.node}</li>
                ))}
              </ul>
              {hidden > 0 && (
                <button type="button" onClick={() => onOpenDay(c.day.noonMs)} className="min-h-6 self-start px-1 text-caption font-semibold text-accent-text underline-offset-4 hover:underline">
                  {hidden} more
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function MonthPhone({
  days,
  anchor,
  now,
  filters,
  selected,
  passes,
  onSelect,
  onBring,
  open,
}: {
  days: readonly CalendarDay[];
  anchor: number;
  now: number;
  filters: Filters;
  selected: number;
  passes: readonly Pass[];
  onSelect: (ms: number) => void;
  onBring: (plan: WeekPlanDetail) => void;
  open: Openers;
}) {
  const current = days.find((c) => sameDay(c.day, selected)) ?? days.find((c) => sameDay(c.day, now)) ?? days[0];
  const s = shown(current, filters);
  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Month" className="flex flex-col gap-1">
        <div aria-hidden="true" className="grid grid-cols-7">
          {WEEKDAYS.map((w) => (
            <span key={w} className="py-1 text-center text-caption font-semibold text-muted-foreground">
              {w.slice(0, 1)}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((c) => {
            const x = shown(c, filters);
            const stub = x.stubs[0];
            const on = sameDay(c.day, current.day.noonMs);
            const today = sameDay(c.day, now);
            const parts = [`${formatWeekday(c.day.noonMs, "long", HOME_TZ)} ${dayListDate(c.day, now)}`];
            if (x.stubs.length > 0) parts.push(plural(x.stubs.length, "Stub"));
            if (x.plans.length > 0) parts.push(plural(x.plans.length, "plan"));
            if (x.blocks.length > 0) parts.push(plural(x.blocks.length, "block"));
            if (x.free.length > 0) parts.push(FREE_LABEL[x.free[0].part].toLowerCase());
            return (
              <button
                key={c.day.offset}
                type="button"
                aria-label={parts.join(", ")}
                aria-pressed={on}
                onClick={() => onSelect(c.day.noonMs)}
                style={stub ? catStyle(stubColor(stub)) : undefined}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-control border text-small font-bold",
                  stub ? "border-transparent bg-[var(--cat)] text-[var(--ink)]" : "border-border bg-card",
                  !stub && !inMonth(c.day, anchor) && "text-muted-foreground",
                  today && !stub && "text-accent-text",
                  on && "outline outline-2 outline-offset-1 outline-foreground",
                )}
              >
                <span>{c.day.d}</span>
                <span aria-hidden="true" className="flex h-1.5 items-center">
                  {x.plans.length > 0 && <span className="size-1.5 rounded-full bg-accent" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-control bg-[var(--cat-violet)]" />
          Stub you collected
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
          Plan
        </span>
      </p>
      <section aria-live="polite" className="flex flex-col gap-3">
        <DaySection
          content={{ day: current.day, plans: s.plans, free: s.free }}
          now={now}
          passes={passes}
          onBring={onBring}
          onOpenPlan={open.plan}
          onOpenFree={(f) => open.free(f as CalendarFreeSlot)}
          renderPick={(f) => (filters.picks && (f as CalendarFreeSlot).pick ? <PickCard slot={f as CalendarFreeSlot} onOpen={open.pick} onKeep={open.keep} className="w-full" /> : null)}
          heading={{ title: dayListHeading(current.day, now), date: dayListDate(current.day, now) }}
        />
        <BlockRows blocks={s.blocks} onOpen={open.block} />
        <StubRows stubs={s.stubs} onOpen={open.stub} />
        <button
          type="button"
          onClick={() => open.makePlan(current.day.noonMs)}
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-card px-6 text-body font-semibold text-foreground"
        >
          {makePlanFor(current.day, now)}
        </button>
      </section>
    </div>
  );
}
