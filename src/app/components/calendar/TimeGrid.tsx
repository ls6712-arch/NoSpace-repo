import { Link } from "react-router";
import { catStyle } from "../../lib/categoryStyle";
import { dayListDate, describeFree, describePlan, planHref, shortTime, sameDay, timeRange, visiblePlans, type CalendarDay, type Filters } from "../../lib/calendarView";
import { formatWeekday } from "../../lib/dates";
import { HOME_TZ, nyTimeToMs } from "../../lib/homeWeek";
import { track } from "../../lib/analytics";
import { WEEK_VIEW } from "../../lib/homeCopy";
import { FREE_LABEL, findSomethingPath, goingLine, placeLine, planSpan, type WeekPlanDetail } from "../../lib/weekView";
import type { Pass } from "../../lib/tasteModel";
import { cn } from "../ui/utils";
import { DASHED, StubChip } from "./CalendarChips";

/** The grid runs 7 AM to midnight, 48px an hour. Anything earlier is held at the top edge. */
export const GRID_START_HOUR = 7;
export const GRID_END_HOUR = 24;
const HOUR_PX = 48;
const HEIGHT = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_PX;
const MIN_BLOCK_PX = 24;

const HOURS = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => GRID_START_HOUR + i);
const hourLabel = (h: number) => shortTime(nyTimeToMs(2026, 1, 15, h));

/** Where a span sits in the column, in px, clipped to the grid. */
export function blockBox(day: { startMs: number; endMs: number }, startMs: number, endMs: number): { top: number; height: number } {
  const gridStart = day.startMs + GRID_START_HOUR * 3_600_000;
  const px = (ms: number) => ((ms - gridStart) / 3_600_000) * HOUR_PX;
  const top = Math.min(Math.max(px(startMs), 0), HEIGHT - MIN_BLOCK_PX);
  const bottom = Math.min(Math.max(px(endMs), top + MIN_BLOCK_PX), HEIGHT);
  return { top, height: Math.max(bottom - top, MIN_BLOCK_PX) };
}

/** Side by side lanes for plans that overlap in time: each gets a lane and how many lanes its cluster has. */
export function lanes(items: readonly { startMs: number; endMs: number }[]): { lane: number; of: number }[] {
  const order = items.map((_, i) => i).sort((a, b) => items[a].startMs - items[b].startMs);
  const out = items.map(() => ({ lane: 0, of: 1 }));
  let group: number[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -Infinity;
  const close = () => {
    for (const i of group) out[i].of = laneEnds.length;
    group = [];
    laneEnds = [];
  };
  for (const i of order) {
    if (group.length > 0 && items[i].startMs >= groupEnd) close();
    let lane = laneEnds.findIndex((end) => end <= items[i].startMs);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = items[i].endMs;
    out[i].lane = lane;
    group.push(i);
    groupEnd = Math.max(groupEnd, items[i].endMs);
  }
  close();
  return out;
}

/**
 * Week and Day as a time grid: one column a day, hours down the side. Plans and
 * Pursuit sessions are blocks in the Corner's colour; free time is a dashed
 * block behind them with its Find something link; Stubs sit in a row above the
 * hours. The line marks now in today's column.
 */
export function TimeGrid({
  days,
  now,
  filters,
  passes,
}: {
  days: readonly CalendarDay[];
  now: number;
  filters: Filters;
  passes: readonly Pass[];
}) {
  const template = `3.5rem repeat(${days.length}, minmax(0, 1fr))`;
  const anyStubs = filters.stubs && days.some((c) => c.stubs.length > 0);
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-card">
      <div className="min-w-[320px]">
        <div className="grid border-b border-border" style={{ gridTemplateColumns: template }}>
          <span aria-hidden="true" className="px-2 py-2 text-caption text-muted-foreground">
            ET
          </span>
          {days.map((c) => {
            const today = sameDay(c.day, now);
            return (
              <div key={c.day.offset} className="flex flex-col items-center gap-0.5 py-2">
                <span className="text-caption font-semibold text-muted-foreground">{formatWeekday(c.day.noonMs, "short", HOME_TZ)}</span>
                <span
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded-full text-lead font-bold leading-none",
                    today && "border-[1.5px] border-accent-text text-accent-text",
                  )}
                  style={{ fontFamily: "var(--font-display)" }}
                  aria-label={`${formatWeekday(c.day.noonMs, "long", HOME_TZ)} ${dayListDate(c.day, now)}${today ? ", today" : ""}`}
                >
                  {c.day.d}
                </span>
              </div>
            );
          })}
        </div>
        {anyStubs && (
          <div className="grid border-b border-border" style={{ gridTemplateColumns: template }}>
            <span aria-hidden="true" className="px-2 py-1 text-caption text-muted-foreground">
              Stubs
            </span>
            {days.map((c) => (
              <ul key={c.day.offset} className="flex min-w-0 flex-col gap-1 p-1">
                {c.stubs.map((s) => (
                  <li key={s.id}>
                    <StubChip stub={s} />
                  </li>
                ))}
              </ul>
            ))}
          </div>
        )}
        <div className="grid" style={{ gridTemplateColumns: template }}>
          <div aria-hidden="true" className="relative" style={{ height: HEIGHT }}>
            {HOURS.slice(1).map((h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-caption text-muted-foreground" style={{ top: (h - GRID_START_HOUR) * HOUR_PX }}>
                {hourLabel(h)}
              </span>
            ))}
          </div>
          {days.map((c) => (
            <DayColumn key={c.day.offset} content={c} now={now} filters={filters} passes={passes} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayColumn({ content, now, filters, passes }: { content: CalendarDay; now: number; filters: Filters; passes: readonly Pass[] }) {
  const { day } = content;
  const plans = visiblePlans(content, filters);
  const free = filters.free ? content.free : [];
  const placed = lanes(plans.map((p) => planSpan(p.startsAt, p.endsAt)));
  const today = sameDay(day, now);
  const nowTop = ((now - (day.startMs + GRID_START_HOUR * 3_600_000)) / 3_600_000) * HOUR_PX;
  return (
    <div className="relative border-l border-border" style={{ height: HEIGHT }}>
      {HOURS.slice(1).map((h) => (
        <span key={h} aria-hidden="true" className="absolute inset-x-0 border-t border-border/60" style={{ top: (h - GRID_START_HOUR) * HOUR_PX }} />
      ))}
      {free.map((f) => {
        const box = blockBox(day, f.startMs, f.endMs);
        return (
          <div
            key={f.keys.join("+")}
            role="group"
            aria-label={describeFree(f)}
            className={cn("absolute inset-x-1 flex flex-col gap-0.5 rounded-control p-1.5", DASHED)}
            style={box}
          >
            <span className="text-caption text-muted-foreground">{FREE_LABEL[f.part]}</span>
            <Link
              to={findSomethingPath(f)}
              onClick={() => track({ name: "week_find_something", window: f.keys[0] })}
              className="inline-flex min-h-6 items-center self-start text-caption font-semibold text-accent-text underline-offset-4 hover:underline"
            >
              {WEEK_VIEW.findSomething}
            </Link>
          </div>
        );
      })}
      {plans.map((p, i) => {
        const span = planSpan(p.startsAt, p.endsAt);
        const box = blockBox(day, span.startMs, span.endMs);
        return <PlanBlock key={p.id} plan={p} box={box} lane={placed[i]} passes={passes} />;
      })}
      {today && nowTop >= 0 && nowTop <= HEIGHT && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-accent-text" style={{ top: nowTop }} />
      )}
    </div>
  );
}

function PlanBlock({ plan, box, lane, passes }: { plan: WeekPlanDetail; box: { top: number; height: number }; lane: { lane: number; of: number }; passes: readonly Pass[] }) {
  const href = planHref(plan);
  const span = planSpan(plan.startsAt, plan.endsAt);
  const who = goingLine(plan.going);
  const where = placeLine(plan, passes);
  const style = {
    ...catStyle(plan.color),
    top: box.top,
    height: box.height,
    left: `calc(${(lane.lane / lane.of) * 100}% + 4px)`,
    width: `calc(${100 / lane.of}% - 8px)`,
  };
  const body = (
    <>
      <span className="line-clamp-2 text-small font-bold leading-tight">{plan.title}</span>
      {box.height >= 44 && <span className="truncate text-caption">{timeRange(span.startMs, span.endMs)}</span>}
      {box.height >= 72 && where && <span className="line-clamp-2 text-caption">{where}</span>}
      {box.height >= 96 && who && <span className="line-clamp-2 text-caption">{who}</span>}
    </>
  );
  const cls = "absolute z-[1] flex flex-col gap-0.5 overflow-hidden rounded-control bg-[var(--cat)] p-1.5 text-left text-[var(--ink)]";
  return href ? (
    <Link to={href} aria-label={describePlan(plan)} style={style} className={cls}>
      {body}
    </Link>
  ) : (
    <div role="group" aria-label={describePlan(plan)} style={style} className={cls}>
      {body}
    </div>
  );
}
