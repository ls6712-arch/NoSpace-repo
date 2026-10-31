import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { PageShell } from "../components/layout/PageShell";
import { useAuth } from "../context/AuthContext";
import { SignUpPrompt } from "../components/SignUpPrompt";
import { ErrorNotice } from "../components/StateViews";
import { BottomSheet } from "../components/ui/BottomSheet";
import { Skeleton } from "../components/ui/skeleton";
import { notifyError } from "../components/ui/toaster";
import { CalendarToolbar } from "../components/calendar/CalendarToolbar";
import { ListView } from "../components/calendar/ListView";
import { MonthView } from "../components/calendar/MonthView";
import { ShowPanel } from "../components/calendar/ShowPanel";
import { BlockRows, StubRows } from "../components/calendar/StubRows";
import { TimeGrid } from "../components/calendar/TimeGrid";
import { WeekExtras } from "../components/calendar/WeekExtras";
import { CalendarSheets, type SheetState } from "../components/calendar/CalendarSheets";
import type { Openers } from "../components/calendar/openers";
import type { GridHandlers } from "../components/calendar/TimeGrid";
import { DaySection } from "../components/week/DaySection";
import { DayStrip } from "../components/week/DayStrip";
import { track } from "../lib/analytics";
import {
  addDays,
  calendarDays,
  calendarRange,
  canStep,
  clampAnchor,
  dateParam,
  loadFilters,
  monthGridDays,
  noonOf,
  parseDateParam,
  parseView,
  plansToGo,
  saveFilters,
  sameDay,
  stepAnchor,
  viewSpan,
  viewSubline,
  viewTitle,
  visiblePlans,
  type CalendarView,
  type CalendarFreeSlot,
  type FilterKey,
  type Filters,
} from "../lib/calendarView";
import type { Owner } from "../lib/firstPlanRemote";
import { CALENDAR_SIGNED_OUT, WEEK_VIEW } from "../lib/homeCopy";
import { ERROR_LINE } from "../lib/stateCopy";
import type { Budget } from "../lib/tasteModel";
import { useCalendarActions } from "../lib/useCalendarActions";
import { useCalendarData } from "../lib/useCalendarData";
import { useMediaQuery, useWide } from "../lib/useMediaQuery";
import { useWeekData } from "../lib/useWeekData";
import { bringSomeone } from "../lib/weekActions";
import { monthSpend, weekDays, type WeekPlanDetail } from "../lib/weekView";

/**
 * The calendar at /calendar: Day, Week, Month and List, in New York time. It
 * shows only Soosh things: plans, Pursuit sessions, free time and the Stubs you
 * collected (more kinds arrive with their own changes). The view and the date
 * live in the URL (`?view=` and `?date=`), so Back works and a link can be shared.
 * It opens from Home's "Your week" card and the rail's Calendar item.
 */
export function Calendar() {
  const { user, profile, isConfigured } = useAuth();
  const [params, setParams] = useSearchParams();
  const wide = useWide();
  // The Show panel sits beside the calendar from 1128px and is a sheet below it.
  const panel = useMediaQuery("(min-width: 1128px)");
  const data = useWeekData(user?.id);
  const [attempt, setAttempt] = useState(0);
  const [filtersByView, setFiltersByView] = useState<Partial<Record<CalendarView, Filters>>>({});
  const [showOpen, setShowOpen] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [sheet, setSheet] = useState<SheetState | null>(null);

  const now = data.now;
  const view = parseView(params.get("view"));
  const signedUp = user?.created_at ? Date.parse(user.created_at) : null;
  const range = useMemo(() => calendarRange(now, signedUp), [now, signedUp]);
  const anchor = clampAnchor(parseDateParam(params.get("date")) ?? noonOf(now), range);

  const userId = user?.id;
  useEffect(() => {
    if (userId) track({ name: "calendar_opened", view });
    // Once per visit: changing the view is its own event.
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const days = useMemo(() => {
    if (view === "month") return monthGridDays(anchor);
    if (view === "week") return weekDays(anchor, 7);
    if (view === "list") return weekDays(anchor, 30);
    return weekDays(anchor, 1);
  }, [view, anchor]);
  const fetchFrom = days[0].startMs;
  const fetchTo = days[days.length - 1].endMs;
  const extra = useCalendarData(userId, fetchFrom, fetchTo, attempt);
  const owner: Owner | null = user
    ? { id: user.id, username: profile?.username ?? null, displayName: profile?.display_name?.trim() || "", avatarUrl: profile?.avatar_url ?? undefined }
    : null;
  // A change reloads the range's plans only, never the whole screen.
  const reloadPlans = useCallback(() => setAttempt((n) => n + 1), []);
  const actions = useCalendarActions({ owner, usualWindows: data.windows, reloadPlans });

  const plans = useMemo(() => {
    const byId = new Map<string, WeekPlanDetail>();
    for (const p of [...data.plans, ...extra.plans]) byId.set(p.id, p);
    return actions.applyToPlans([...byId.values()]).sort((a, b) => a.startsAt - b.startsAt);
  }, [data.plans, extra.plans, actions.applyToPlans]); // eslint-disable-line react-hooks/exhaustive-deps
  const calDays = useMemo(() => calendarDays(days, plans, extra.stubs, actions.windows, now, actions.entries), [days, plans, extra.stubs, actions.windows, now, actions.entries]);
  const stripDays = useMemo(
    () => (view === "day" ? calendarDays(weekDays(addDays(anchor, -3), 7), plans, extra.stubs, actions.windows, now, actions.entries) : []),
    [view, anchor, plans, extra.stubs, actions.windows, now, actions.entries],
  );
  const spend = useMemo(() => monthSpend(data.plans, data.passes, now), [data.plans, data.passes, now]);

  const filters = filtersByView[view] ?? loadFilters(view);

  if (isConfigured && !user) {
    return <SignUpPrompt title={CALENDAR_SIGNED_OUT.title} body={CALENDAR_SIGNED_OUT.body} cta={CALENDAR_SIGNED_OUT.cta} />;
  }

  const go = (next: { view?: CalendarView; anchor?: number }) => {
    const v = next.view ?? view;
    const a = clampAnchor(next.anchor ?? anchor, range);
    const p = new URLSearchParams(params);
    p.set("view", v);
    if (sameDay(weekDays(a, 1)[0], now)) p.delete("date");
    else p.set("date", dateParam(a));
    setParams(p);
    setPicked(null);
  };
  const onView = (v: CalendarView) => {
    track({ name: "calendar_view_changed", view: v });
    go({ view: v });
  };
  const onFilter = (key: FilterKey, on: boolean) => {
    const next = { ...filters, [key]: on };
    setFiltersByView((s) => ({ ...s, [view]: next }));
    saveFilters(view, next);
    track({ name: "calendar_filter_changed", row: key, on });
  };
  const onBudget = async (b: Budget) => {
    track({ name: "week_budget_changed" });
    if (!(await data.saveBudget(b))) notifyError(ERROR_LINE);
  };
  const onBring = async (plan: WeekPlanDetail) => {
    if (!owner) return;
    const r = await bringSomeone(plan, owner);
    if (!r.ok) notifyError(r.error ?? ERROR_LINE);
  };
  const retry = () => {
    data.reload();
    setAttempt((n) => n + 1);
  };

  const open: Openers = {
    plan: (plan) => setSheet({ type: "plan", plan }),
    stub: (stub) => setSheet({ type: "stub", stub }),
    free: (slot: CalendarFreeSlot) => setSheet({ type: "free", slot }),
    block: (occurrence) => setSheet({ type: "block", occurrence }),
    makePlan: (dayMs) => setSheet({ type: "plan-form", dayMs }),
  };
  const handlers: GridHandlers = {
    onEmpty: (range) => setSheet({ type: "slot", ...range }),
    onPlan: open.plan,
    onFree: open.free,
    onBlock: open.block,
    onStub: open.stub,
    onMovePlan: (plan, startsAt) => void actions.changePlanTime(plan, startsAt),
    onChangeBlock: (b, startMs, endMs) => {
      const startsAt = b.entry.startsAt + (startMs - b.startMs);
      void actions.changeEntry(b.entry, { startsAt, endsAt: startsAt + (endMs - startMs) });
    },
    onDeletePlan: actions.cancelPlan,
    onDeleteBlock: (b) => actions.removeBlock(b.entry),
  };

  const span = viewSpan(view, anchor);
  const inSpan = (ms: number) => ms >= span.startMs && ms < span.endMs;
  const subline = viewSubline(view, {
    stubs: extra.stubs.filter((s) => inSpan(s.issuedAt)).length,
    plans: view === "month" ? plansToGo(plans.filter((p) => inSpan(p.startsAt)), now) : plans.filter((p) => inSpan(p.startsAt)).length,
    startsToday: sameDay(days[0], now),
  });

  const noWindows = data.windows.length === 0;
  const body = () => {
    if (view === "month") {
      return (
        <MonthView
          days={calDays}
          anchor={anchor}
          now={now}
          wide={wide}
          filters={filters}
          selected={picked ?? (sameDay(days[0], now) || calDays.some((c) => sameDay(c.day, now)) ? noonOf(now) : anchor)}
          passes={data.passes}
          onSelect={setPicked}
          onOpenDay={(ms) => go({ view: "day", anchor: ms })}
          onBring={(p) => void onBring(p)}
          open={open}
        />
      );
    }
    if (view === "list") return <ListView days={calDays} now={now} filters={filters} passes={data.passes} onBring={(p) => void onBring(p)} open={open} />;
    if (view === "day" || wide) {
      return (
        <div className="flex flex-col gap-4">
          {view === "day" && (
            <DayStrip days={stripDays.map((c) => ({ ...c, plans: visiblePlans(c, filters), free: filters.free ? c.free : [] }))} selected={3} now={now} onSelect={(i) => go({ anchor: addDays(anchor, i - 3) })} />
          )}
          <TimeGrid days={calDays} now={now} filters={filters} passes={data.passes} handlers={handlers} />
        </div>
      );
    }
    // Week on a phone: the seven days as a strip and a list, as the Week view always was.
    const contents = calDays.map((c) => ({ ...c, plans: visiblePlans(c, filters), free: filters.free ? c.free : [] }));
    const hasPlans = contents.some((c) => c.plans.length > 0);
    if (noWindows && !hasPlans && sameDay(days[0], now)) {
      return (
        <Link to="/discover" className="inline-flex min-h-11 items-center self-start text-small font-semibold text-accent-text underline-offset-4 hover:underline">
          {WEEK_VIEW.findSomething}
        </Link>
      );
    }
    return (
      <div className="flex flex-col gap-6">
        <DayStrip
          days={contents}
          selected={contents.find((c) => sameDay(c.day, picked ?? now))?.day.offset ?? -1}
          now={now}
          onSelect={(offset) => {
            setPicked(contents[offset].day.noonMs);
            track({ name: "week_day_tapped", offset });
            document.getElementById(`week-day-${offset}`)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
          }}
        />
        {/* Days stay in one column, in date order: a second column would read across, out of order. */}
        <div className="flex flex-col gap-6">
          {contents.map((c) => (
            <div key={c.day.offset} className="flex flex-col gap-3">
              <DaySection content={c} now={now} passes={data.passes} onBring={(p) => void onBring(p)} onOpenPlan={open.plan} onOpenFree={(f) => open.free(f as CalendarFreeSlot)} />
              {filters.blocks && <BlockRows blocks={c.blocks} onOpen={open.block} />}
              {filters.stubs && <StubRows stubs={c.stubs} onOpen={open.stub} />}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const showWeekExtras = view === "week" && sameDay(days[0], now);
  return (
    <PageShell title={viewTitle(view, anchor, now)} subtitle={subline}>
      <CalendarToolbar
        view={view}
        showButton={!panel}
        canPrev={canStep(view, anchor, -1, range)}
        canNext={canStep(view, anchor, 1, range)}
        onToday={() => go({ anchor: noonOf(now) })}
        onStep={(dir) => go({ anchor: stepAnchor(view, anchor, dir) })}
        onView={onView}
        onShow={() => setShowOpen(true)}
        onMakePlan={() => open.makePlan()}
      />
      {data.status === "loading" && <CalendarSkeleton />}
      {data.status === "error" && <ErrorNotice onRetry={retry} />}
      {data.status === "ready" && extra.failed && <ErrorNotice onRetry={retry} />}
      {data.status === "ready" && !extra.failed && (
        <div className="flex flex-col gap-6 desk:flex-row desk:items-start">
          {panel && (
            <aside className="flex shrink-0 flex-col gap-4 desk:w-60">
              <ShowPanel filters={filters} onChange={onFilter} />
            </aside>
          )}
          <div className="min-w-0 flex-1">
            {body()}
            {showWeekExtras && (
              <WeekExtras goodHours={data.goodHours} windows={data.windows} budget={data.budget} spend={spend} picks={data.picks} noWindows={noWindows} onBudget={(b) => void onBudget(b)} />
            )}
          </div>
        </div>
      )}
      {sheet && <CalendarSheets sheet={sheet} onClose={() => setSheet(null)} now={now} actions={actions} passes={data.passes} onBring={(p) => void onBring(p)} />}
      {!panel && (
        <BottomSheet open={showOpen} onOpenChange={setShowOpen} title="Show">
          <ShowPanel filters={filters} onChange={onFilter} className="border-0 p-0" />
        </BottomSheet>
      )}
    </PageShell>
  );
}

/** Blocks the size of the real ones: the switch row and the grid. */
function CalendarSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-96 rounded-card" />
      <Skeleton className="h-24 rounded-card" />
    </div>
  );
}
