import { motion } from "motion/react";
import { catStyle } from "../../lib/categoryStyle";
import { dayListDate, inRange, sameDay, stubColor, visiblePlans, type CalendarDay, type CalendarRange, type Filters } from "../../lib/calendarView";
import { formatMonth, formatWeekday } from "../../lib/dates";
import { HOME_TZ, nyParts } from "../../lib/homeWeek";
import { page, staggerDelay } from "../../lib/motionTokens";
import { plural } from "../../lib/plural";
import { cn } from "../ui/utils";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6].map((i) => formatWeekday(Date.UTC(2026, 10, 1 + i, 12), "short", "UTC").slice(0, 1));

/** "November": the 15th is the same date in every time zone, so the month never slips; the year is the page title. */
function monthName(first: number): string {
  const { y, m } = nyParts(first);
  const mid = Date.UTC(y, m - 1, 15, 12);
  return formatMonth(mid, { now: mid });
}

/** "3 Stubs, 2 plans": what a month or a day holds, for screen readers. Empty parts are left out. */
function holds(stubs: number, plans: number): string {
  return [stubs > 0 ? plural(stubs, "Stub") : null, plans > 0 ? plural(plans, "plan") : null].filter(Boolean).join(", ");
}

/**
 * Year: twelve small months, Sunday first. A day you collected a Stub is filled
 * with its Corner's colour and a plan is an accent dot, the same marks as Month,
 * so a year reads as the things you went and did. It counts nothing in a row.
 * On a phone each month is one button that opens it; from 744px each day opens too.
 * Days outside what a person may page through are faded and do nothing.
 */
export function YearView({
  days,
  months,
  now,
  wide,
  filters,
  range,
  onOpenMonth,
  onOpenDay,
}: {
  /** Every day of the year (yearDays). */
  days: readonly CalendarDay[];
  /** Noon on the 1st of each month (yearMonths). */
  months: readonly number[];
  now: number;
  wide: boolean;
  filters: Filters;
  range: CalendarRange;
  onOpenMonth: (ms: number) => void;
  onOpenDay: (ms: number) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ol className="grid grid-cols-2 gap-3 tab:grid-cols-3 desk:grid-cols-4">
        {months.map((first, i) => {
          const m = nyParts(first).m;
          const inThisMonth = days.filter((c) => c.day.m === m);
          const lead = nyParts(first).dow;
          const stubs = filters.stubs ? inThisMonth.reduce((n, c) => n + c.stubs.length, 0) : 0;
          const plans = inThisMonth.reduce((n, c) => n + visiblePlans(c, filters).length, 0);
          const open = inThisMonth.some((c) => inRange(c.day, range));
          const name = monthName(first);
          const label = [name, holds(stubs, plans)].filter(Boolean).join(", ");
          const grid = (
            <div className="grid grid-cols-7 gap-0.5" aria-hidden={!wide || undefined}>
              {WEEKDAYS.map((w, k) => (
                <span key={`h${k}`} aria-hidden="true" className="text-center text-caption text-muted-foreground">
                  {w}
                </span>
              ))}
              {Array.from({ length: lead }, (_, k) => (
                <span key={`b${k}`} aria-hidden="true" />
              ))}
              {inThisMonth.map((c) => (
                <YearDay key={c.day.offset} c={c} now={now} filters={filters} enabled={wide && inRange(c.day, range)} onOpenDay={onOpenDay} />
              ))}
            </div>
          );
          return (
            <motion.li key={first} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...page, delay: staggerDelay(i) }}>
              {wide ? (
                <section aria-label={label} className={cn("flex h-full flex-col gap-2 rounded-card border border-border bg-card p-3", !open && "opacity-50")}>
                  <button
                    type="button"
                    disabled={!open}
                    onClick={() => onOpenMonth(first)}
                    className="self-start rounded-full text-small font-bold text-foreground underline-offset-4 hover:underline disabled:no-underline"
                  >
                    {name}
                  </button>
                  {grid}
                </section>
              ) : (
                <button
                  type="button"
                  disabled={!open}
                  aria-label={label}
                  onClick={() => onOpenMonth(first)}
                  className={cn("flex h-full w-full flex-col gap-2 rounded-card border border-border bg-card p-2 text-left", !open && "opacity-50")}
                >
                  <span className="text-small font-bold text-foreground">{name}</span>
                  {grid}
                </button>
              )}
            </motion.li>
          );
        })}
      </ol>
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
    </div>
  );
}

function YearDay({ c, now, filters, enabled, onOpenDay }: { c: CalendarDay; now: number; filters: Filters; enabled: boolean; onOpenDay: (ms: number) => void }) {
  const stub = filters.stubs ? c.stubs[0] : undefined;
  const plans = visiblePlans(c, filters).length;
  const today = sameDay(c.day, now);
  const look = cn(
    "relative flex aspect-square items-center justify-center rounded-full text-caption leading-none",
    stub ? "bg-[var(--cat)] font-bold text-[var(--ink)]" : "text-foreground",
    today && !stub && "font-bold text-accent-text outline outline-[1.5px] outline-accent-text",
    today && stub && "outline outline-2 outline-offset-1 outline-foreground",
  );
  const dot = plans > 0 && <span aria-hidden="true" className="absolute bottom-0.5 size-1 rounded-full bg-accent" />;
  if (!enabled) {
    return (
      <span aria-hidden="true" style={stub ? catStyle(stubColor(stub)) : undefined} className={look}>
        {c.day.d}
        {dot}
      </span>
    );
  }
  const label = [`${formatWeekday(c.day.noonMs, "long", HOME_TZ)} ${dayListDate(c.day, now)}`, today ? "today" : null, holds(filters.stubs ? c.stubs.length : 0, plans)].filter(Boolean).join(", ");
  return (
    <button type="button" aria-label={label} onClick={() => onOpenDay(c.day.noonMs)} style={stub ? catStyle(stubColor(stub)) : undefined} className={cn(look, !stub && "hover:bg-muted")}>
      {c.day.d}
      {dot}
    </button>
  );
}
