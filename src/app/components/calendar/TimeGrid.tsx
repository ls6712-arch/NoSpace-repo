import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { catStyle } from "../../lib/categoryStyle";
import { dragRange, isDraggable, snapMs, tapRange, timeAtRow, clockMinutes, moveToDay } from "../../lib/calendarActions";
import { SHEET } from "../../lib/calendarCopy";
import type { Occurrence } from "../../lib/calendarEntries";
import {
  dayListDate,
  describeBlock,
  describeFree,
  describePlan,
  sameDay,
  shortTime,
  timeRange,
  visiblePlans,
  type CalendarDay,
  type CalendarFreeSlot,
  type Filters,
} from "../../lib/calendarView";
import { formatWeekday } from "../../lib/dates";
import { HOME_TZ, nyTimeToMs } from "../../lib/homeWeek";
import { track } from "../../lib/analytics";
import type { StubCard } from "../../lib/stubs";
import type { Pass } from "../../lib/tasteModel";
import { FREE_LABEL, goingLine, placeLine, planSpan, type WeekPlanDetail } from "../../lib/weekView";
import { cn } from "../ui/utils";
import { DASHED, HATCH_STYLE, StubChip } from "./CalendarChips";
import { PickCard } from "./PickCard";

/** The whole day, midnight to midnight, 48px an hour. The grid scrolls inside its frame and opens near now. */
export const GRID_START_HOUR = 0;
export const GRID_END_HOUR = 24;
export const HOUR_PX = 48;
const HOUR_MS = 3_600_000;
const LABEL_PX = 64;
/** A day column never gets narrower than this; on a phone the week scrolls sideways a day at a time. */
const MIN_COL_PX = 112;
/** Where the grid opens when there is no now and no plan to aim at. */
const MORNING_HOUR = 7;
/** Below this a plan is one line: its title and its start. */
const ONE_LINE_PX = 40;
const HEIGHT = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_PX;
const MIN_BLOCK_PX = 24;
/** A pick card needs room for its label, its title, its time and its button. */
const PICK_MIN_PX = 150;
/** A pointer that moves less than this is a click, not a drag. */
const DRAG_PX = 6;

const HOURS = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => GRID_START_HOUR + i);
const hourLabel = (h: number) => shortTime(nyTimeToMs(2026, 1, 15, h));
const isWeekend = (c: CalendarDay) => c.day.dayKey === "sat" || c.day.dayKey === "sun";

/** The hour the grid scrolls to: an hour before now in a week that holds today, else just before the first plan, else the morning. */
export function openingHour(days: readonly CalendarDay[], now: number): number {
  const today = days.find((c) => sameDay(c.day, now));
  if (today) return Math.max(0, clockMinutes(today.day, now) / 60 - 1);
  const firsts = days.flatMap((c) => c.plans.map((p) => clockMinutes(c.day, p.startsAt) / 60));
  return firsts.length ? Math.max(0, Math.min(...firsts) - 0.5) : MORNING_HOUR;
}

/** Where a span sits in the column, in px, clipped to the grid. */
export function blockBox(day: { startMs: number; endMs: number }, startMs: number, endMs: number): { top: number; height: number } {
  const px = (ms: number) => ((clockMinutes(day, ms) - GRID_START_HOUR * 60) / 60) * HOUR_PX;
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

export interface GridHandlers {
  /** A tap or a drag on empty hours. */
  onEmpty: (range: { startMs: number; endMs: number }) => void;
  onPlan: (plan: WeekPlanDetail) => void;
  onFree: (slot: CalendarFreeSlot) => void;
  onBlock: (block: Occurrence) => void;
  onStub: (stub: StubCard) => void;
  onPick: (slot: CalendarFreeSlot) => void;
  onKeep: (slot: CalendarFreeSlot) => void;
  /** Dragged to a new start. Only a plan only you are in is ever dragged. */
  onMovePlan: (plan: WeekPlanDetail, startsAt: number) => void;
  /** Dragged to a new place (moves) or by its bottom edge (changes the end). */
  onChangeBlock: (block: Occurrence, startMs: number, endMs: number) => void;
  onDeletePlan: (plan: WeekPlanDetail) => void;
  onDeleteBlock: (block: Occurrence) => void;
}

interface Drag {
  kind: "select" | "move" | "resize";
  id: string;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  /** Which column a selection started in. */
  col: number;
  moved: boolean;
}

/**
 * Week and Day as a time grid: one column a day, hours down the side. Plans and
 * Pursuit sessions are blocks in the Corner's colour; free time is a tinted,
 * dashed block behind them (tap it for its sheet); your blocks are hatched; Stubs
 * sit in a row above the hours. The line marks now in today's column.
 *
 * With a mouse: click or drag across empty hours to start a plan, free time or a
 * block there; drag a plan only you are in, or a block, to move it; drag a block's
 * bottom edge to change its end. Every one of those is also a sheet, so keyboard
 * and screen reader users never need to drag, and a touch screen only taps.
 */
export function TimeGrid({ days, now, filters, passes, handlers }: { days: readonly CalendarDay[]; now: number; filters: Filters; passes: readonly Pass[]; handlers: GridHandlers }) {
  const template = `${LABEL_PX}px repeat(${days.length}, minmax(${MIN_COL_PX}px, 1fr))`;
  const anyStubs = filters.stubs && days.some((c) => c.stubs.length > 0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const suppress = useRef(false);
  const todayCol = days.findIndex((c) => sameDay(c.day, now));
  const nowTop = todayCol >= 0 ? ((clockMinutes(days[todayCol].day, now) - GRID_START_HOUR * 60) / 60) * HOUR_PX : -1;

  // Open near now (or the first plan) each time the period changes, not on every render.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = Math.max(0, (openingHour(days, now) - GRID_START_HOUR) * HOUR_PX);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days[0]?.day.startMs, days.length]);

  /** The column width, for turning a sideways drag into days. */
  const colWidth = () => ((bodyRef.current?.getBoundingClientRect().width ?? LABEL_PX + days.length * MIN_COL_PX) - LABEL_PX) / days.length;

  return (
    <div className="overflow-hidden rounded-card border border-border bg-card">
      <div ref={scrollRef} className="relative snap-x snap-proximity overflow-auto overscroll-contain" style={{ maxHeight: "min(72dvh, 720px)", scrollPaddingLeft: LABEL_PX }}>
        <div className="sticky top-0 z-30 border-b border-border bg-card">
          <div className="grid" style={{ gridTemplateColumns: template }}>
            <span aria-hidden="true" className="sticky left-0 z-10 flex items-end bg-card px-2 pb-2 text-caption text-muted-foreground">
              ET
            </span>
            {days.map((c) => {
              const today = sameDay(c.day, now);
              return (
                <div key={c.day.offset} className={cn("flex snap-start flex-col items-center gap-1 py-2", isWeekend(c) && "bg-foreground/[0.03]")}>
                  <span className={cn("text-caption font-semibold", today ? "text-accent-text" : "text-muted-foreground")}>{formatWeekday(c.day.noonMs, "short", HOME_TZ)}</span>
                  <span
                    className={cn("inline-flex size-9 items-center justify-center rounded-full text-lead font-bold leading-none", today && "bg-accent text-accent-foreground")}
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
            <div className="grid border-t border-border" style={{ gridTemplateColumns: template }}>
              <span aria-hidden="true" className="sticky left-0 z-10 bg-card px-2 py-1 text-caption text-muted-foreground">
                Stubs
              </span>
              {days.map((c) => (
                <ul key={c.day.offset} className="flex min-w-0 flex-col gap-1 p-1">
                  {c.stubs.map((s) => (
                    <li key={s.id}>
                      <StubChip stub={s} onOpen={handlers.onStub} />
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          )}
        </div>
        <div ref={bodyRef} className="grid" style={{ gridTemplateColumns: template }}>
          {/* The hour rail: stays put while the days scroll sideways. */}
          <div aria-hidden="true" className="sticky left-0 z-20 bg-card" style={{ height: HEIGHT }}>
            {HOURS.slice(1).map((h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-caption text-muted-foreground" style={{ top: (h - GRID_START_HOUR) * HOUR_PX }}>
                {hourLabel(h)}
              </span>
            ))}
            {nowTop >= 0 && nowTop <= HEIGHT && (
              <span className="absolute right-1 z-10 -translate-y-1/2 whitespace-nowrap rounded-full bg-accent px-1.5 py-0.5 text-caption font-semibold text-accent-foreground" style={{ top: nowTop }}>
                {shortTime(now)}
              </span>
            )}
          </div>
          {days.map((c, col) => (
            <DayColumn
              key={c.day.offset}
              col={col}
              days={days}
              content={c}
              now={now}
              nowTop={todayCol >= 0 ? nowTop : -1}
              filters={filters}
              passes={passes}
              handlers={handlers}
              drag={drag}
              setDrag={setDrag}
              suppress={suppress}
              colWidth={colWidth}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayColumn({
  col,
  days,
  content,
  now,
  nowTop,
  filters,
  passes,
  handlers,
  drag,
  setDrag,
  suppress,
  colWidth,
}: {
  col: number;
  days: readonly CalendarDay[];
  content: CalendarDay;
  now: number;
  /** Where now sits, in px, when today is in view; -1 when it isn't. */
  nowTop: number;
  filters: Filters;
  passes: readonly Pass[];
  handlers: GridHandlers;
  drag: Drag | null;
  setDrag: (d: Drag | null) => void;
  suppress: { current: boolean };
  colWidth: () => number;
}) {
  const { day } = content;
  const ref = useRef<HTMLDivElement>(null);
  const plans = visiblePlans(content, filters);
  const free = filters.free ? content.free : [];
  const blocks = filters.blocks ? content.blocks : [];
  const placed = lanes(plans.map((p) => planSpan(p.startsAt, p.endsAt)));
  const today = sameDay(day, now);
  const rowOf = (clientY: number) => clientY - (ref.current?.getBoundingClientRect().top ?? 0);
  const onItem = (e: { target: EventTarget }) => !!(e.target as HTMLElement).closest("[data-hit]");

  // Empty hours: a click, or a mouse drag across them.
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.pointerType !== "mouse" || onItem(e)) return;
    suppress.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ kind: "select", id: "select", x0: e.clientX, y0: rowOf(e.clientY), dx: 0, dy: 0, col, moved: false });
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const dy = rowOf(e.clientY) - drag.y0;
    setDrag({ ...drag, dy, dx: e.clientX - drag.x0, moved: drag.moved || Math.abs(dy) > DRAG_PX });
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag || drag.kind !== "select") return;
    setDrag(null);
    if (!drag.moved) return;
    suppress.current = true;
    const a = timeAtRow(day, drag.y0, HOUR_PX, GRID_START_HOUR);
    const b = timeAtRow(day, rowOf(e.clientY), HOUR_PX, GRID_START_HOUR);
    track({ name: "calendar_slot_tapped", kind: "empty" });
    handlers.onEmpty(dragRange(a, b));
  };
  const click = (e: React.MouseEvent<HTMLDivElement>) => {
    if (suppress.current) {
      suppress.current = false;
      return;
    }
    if (onItem(e)) return;
    track({ name: "calendar_slot_tapped", kind: "empty" });
    handlers.onEmpty(tapRange(day, timeAtRow(day, rowOf(e.clientY), HOUR_PX, GRID_START_HOUR)));
  };
  const selecting = drag?.kind === "select" && drag.col === col && drag.moved ? drag : null;

  // Moving or resizing something you own.
  const startItemDrag = (e: PointerEvent<HTMLElement>, kind: "move" | "resize", id: string) => {
    if (e.button !== 0 || e.pointerType !== "mouse") return;
    e.stopPropagation();
    suppress.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ kind, id, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, col, moved: false });
  };
  const moveItemDrag = (e: PointerEvent<HTMLElement>, id: string) => {
    if (!drag || drag.id !== id) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    setDrag({ ...drag, dx, dy, moved: drag.moved || Math.abs(dy) > DRAG_PX || Math.abs(dx) > DRAG_PX });
  };
  /** The shift a finished drag stands for: minutes down the column (snapped) and whole days sideways. */
  const shiftOf = (d: Drag) => ({ ms: snapMs((d.dy / HOUR_PX) * HOUR_MS), cols: Math.round(d.dx / colWidth()) });
  const target = (cols: number) => days[Math.min(days.length - 1, Math.max(0, col + cols))];

  const finishPlan = (plan: WeekPlanDetail) => {
    if (!drag || !drag.moved) return setDrag(null);
    const s = shiftOf(drag);
    setDrag(null);
    suppress.current = true;
    const t = target(s.cols);
    handlers.onMovePlan(plan, moveToDay(plan.startsAt, t.day, s.ms));
  };
  const finishBlock = (b: Occurrence) => {
    if (!drag || !drag.moved) return setDrag(null);
    const s = shiftOf(drag);
    setDrag(null);
    suppress.current = true;
    if (drag.kind === "resize") return handlers.onChangeBlock(b, b.startMs, Math.max(b.startMs + 15 * 60_000, snapMs(b.endMs + s.ms)));
    const t = target(s.cols);
    const start = moveToDay(b.startMs, t.day, s.ms);
    handlers.onChangeBlock(b, start, start + (b.endMs - b.startMs));
  };
  const offsetStyle = (id: string) => (drag && drag.id === id && drag.moved && drag.kind === "move" ? { transform: `translate(${drag.dx}px, ${drag.dy}px)`, zIndex: 20 } : undefined);

  const deleteKey = (e: KeyboardEvent, run: () => void) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      run();
    }
  };

  return (
    <div
      ref={ref}
      className={cn("relative cursor-cell border-l border-border", isWeekend(content) && "bg-foreground/[0.03]")}
      style={{ height: HEIGHT }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onClick={click}
    >
      {HOURS.slice(1).map((h) => (
        <span key={h} aria-hidden="true" className="absolute inset-x-0 border-t border-border/60" style={{ top: (h - GRID_START_HOUR) * HOUR_PX }} />
      ))}
      {HOURS.map((h) => (
        <span key={`half-${h}`} aria-hidden="true" className="absolute inset-x-0 border-t border-dashed border-border/30" style={{ top: (h - GRID_START_HOUR + 0.5) * HOUR_PX }} />
      ))}
      {free.map((f) => {
        const box = blockBox(day, f.startMs, f.endMs);
        return (
          <div key={f.keys.join("+") + f.startMs} className={cn("absolute inset-x-1 flex flex-col items-start gap-0.5 rounded-control p-1", DASHED)} style={box}>
            <button
              type="button"
              data-hit
              aria-label={describeFree(f)}
              onClick={() => {
                track({ name: "calendar_slot_tapped", kind: "free" });
                handlers.onFree(f);
              }}
              className="min-h-6 text-left text-caption font-medium text-muted-foreground"
            >
              {FREE_LABEL[f.part]}
            </button>
          </div>
        );
      })}
      {filters.picks &&
        free.map((f) => {
          if (!f.pick) return null;
          // Where the thing is, inside the stretch: tall enough for its card even when it is short.
          const box = blockBox(day, f.pick.startsAt, f.pick.endsAt);
          const height = Math.max(box.height, PICK_MIN_PX);
          return (
            <div key={`pick-${f.slotKey}`} className="absolute inset-x-1 z-[1]" style={{ top: Math.min(box.top, HEIGHT - height), height }}>
              <PickCard slot={f} onOpen={handlers.onPick} onKeep={handlers.onKeep} className="h-full w-full" />
            </div>
          );
        })}
      {blocks.map((b) => {
        const box = blockBox(day, b.startMs, b.endMs);
        const id = `block-${b.entry.id}-${b.startMs}`;
        return (
          <div
            key={id}
            data-hit
            style={{ ...box, ...HATCH_STYLE, ...offsetStyle(id) }}
            className="absolute inset-x-1 z-[1] overflow-hidden rounded-control border border-border"
            onPointerMove={(e) => moveItemDrag(e, id)}
            onPointerUp={() => finishBlock(b)}
          >
            <button
              type="button"
              aria-label={describeBlock(b)}
              onPointerDown={(e) => startItemDrag(e, "move", id)}
              onClick={() => {
                if (suppress.current) return void (suppress.current = false);
                track({ name: "calendar_slot_tapped", kind: "block" });
                handlers.onBlock(b);
              }}
              onKeyDown={(e) => deleteKey(e, () => handlers.onDeleteBlock(b))}
              className="flex size-full cursor-grab flex-col items-start gap-0.5 p-1.5 text-left text-caption font-semibold text-foreground"
            >
              <span className="line-clamp-2">{b.entry.note ?? SHEET.yourBlock}</span>
              {box.height >= 44 && <span className="font-normal">{timeRange(b.startMs, b.endMs)}</span>}
            </button>
            <span
              aria-hidden="true"
              onPointerDown={(e) => startItemDrag(e, "resize", id)}
              className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
              style={drag && drag.id === id && drag.kind === "resize" ? { height: 8 + Math.max(0, drag.dy) } : undefined}
            />
          </div>
        );
      })}
      {plans.map((p, i) => {
        const span = planSpan(p.startsAt, p.endsAt);
        return (
          <PlanBlock
            key={p.id}
            plan={p}
            box={blockBox(day, span.startMs, span.endMs)}
            lane={placed[i]}
            passes={passes}
            style={offsetStyle(p.id)}
            onOpen={() => {
              if (suppress.current) return void (suppress.current = false);
              track({ name: "calendar_slot_tapped", kind: "plan" });
              handlers.onPlan(p);
            }}
            draggable={isDraggable(p)}
            onPointerDown={(e) => isDraggable(p) && startItemDrag(e, "move", p.id)}
            onPointerMove={(e) => moveItemDrag(e, p.id)}
            onPointerUp={() => finishPlan(p)}
            onKeyDown={(e) => isDraggable(p) && deleteKey(e, () => handlers.onDeletePlan(p))}
          />
        );
      })}
      {selecting && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-1 z-10 rounded-control border-[1.5px] border-accent-text bg-accent/15"
          style={{ top: Math.min(selecting.y0, selecting.y0 + selecting.dy), height: Math.max(MIN_BLOCK_PX, Math.abs(selecting.dy)) }}
        />
      )}
      {nowTop >= 0 && nowTop <= HEIGHT && (
        <span
          aria-hidden="true"
          className={cn("pointer-events-none absolute inset-x-0 z-10 border-t", today ? "border-t-2 border-accent-text" : "border-accent-text/30")}
          style={{ top: nowTop }}
        >
          {today && <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-accent-text" />}
        </span>
      )}
    </div>
  );
}

function PlanBlock({
  plan,
  box,
  lane,
  passes,
  style: extra,
  draggable,
  onOpen,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onKeyDown,
}: {
  plan: WeekPlanDetail;
  box: { top: number; height: number };
  lane: { lane: number; of: number };
  passes: readonly Pass[];
  style?: React.CSSProperties;
  draggable: boolean;
  onOpen: () => void;
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
}) {
  const span = planSpan(plan.startsAt, plan.endsAt);
  const who = goingLine(plan.going);
  const where = placeLine(plan, passes);
  const oneLine = box.height < ONE_LINE_PX;
  return (
    <button
      type="button"
      data-hit
      aria-label={describePlan(plan)}
      onClick={onOpen}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
      style={{ ...catStyle(plan.color), top: box.top, height: box.height, ...stack(lane), ...extra }}
      className={cn(
        "absolute flex overflow-hidden rounded-control bg-[var(--cat)] px-2 text-left text-[var(--ink)] shadow-card ring-2 ring-card",
        oneLine ? "items-center gap-1.5 py-0.5" : "flex-col gap-0.5 py-1.5",
        draggable && "cursor-grab",
      )}
    >
      {oneLine ? (
        <>
          <span className="min-w-0 truncate text-caption font-bold">{plan.title}</span>
          <span className="shrink-0 text-caption">{shortTime(span.startMs)}</span>
        </>
      ) : (
        <>
          <span className="truncate text-caption font-medium">{timeRange(span.startMs, span.endMs)}</span>
          <span className={cn("text-small font-bold leading-tight", box.height >= 64 ? "line-clamp-2" : "truncate")}>{plan.title}</span>
          {box.height >= 84 && where && <span className="truncate text-caption">{where}</span>}
          {box.height >= 104 && who && <span className="truncate text-caption">{who}</span>}
        </>
      )}
    </button>
  );
}

/**
 * Plans that overlap stack with an offset instead of splitting the column into
 * slivers: each later one starts a little further right and sits on top, so
 * every title keeps most of the column's width.
 */
export function stack(lane: { lane: number; of: number }): { left: string; width: string; zIndex: number } {
  if (lane.of <= 1) return { left: "4px", width: "calc(100% - 8px)", zIndex: 1 };
  const step = Math.min(28, 60 / (lane.of - 1));
  const left = lane.lane * step;
  return { left: `calc(${left}% + 4px)`, width: `calc(${100 - left - (lane.lane === lane.of - 1 ? 0 : step / 2)}% - 8px)`, zIndex: 1 + lane.lane };
}
