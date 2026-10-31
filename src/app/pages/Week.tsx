import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { PAGE_GRID, PageShell, SPAN_GRID } from "../components/layout/PageShell";
import { useAuth } from "../context/AuthContext";
import { SignUpPrompt } from "../components/SignUpPrompt";
import { ErrorNotice } from "../components/StateViews";
import { Skeleton } from "../components/ui/skeleton";
import { notifyError } from "../components/ui/toaster";
import { CityPicksRow } from "../components/week/CityPicksRow";
import { DayStrip } from "../components/week/DayStrip";
import { DaySection } from "../components/week/DaySection";
import { GlanceCard } from "../components/week/GlanceCard";
import { track } from "../lib/analytics";
import type { Owner } from "../lib/firstPlanRemote";
import { WEEK_SIGNED_OUT, WEEK_VIEW } from "../lib/homeCopy";
import { ERROR_LINE } from "../lib/stateCopy";
import type { Budget } from "../lib/tasteModel";
import { useWeekData } from "../lib/useWeekData";
import { bringSomeone } from "../lib/weekActions";
import { dayContents, monthSpend, rangeLine, weekDays, type WeekPlanDetail } from "../lib/weekView";

/**
 * Week: the next 7 days, today first, in New York time. It opens from Home's
 * "Your week" card, so it is not a tab and the tab bar keeps Home active.
 * Someone not signed in gets the same sign-up prompt as You.
 */
export function Week() {
  const { user, profile, isConfigured } = useAuth();
  const data = useWeekData(user?.id);
  const [selected, setSelected] = useState(0);

  const userId = user?.id;
  useEffect(() => {
    if (userId) track({ name: "week_opened" });
  }, [userId]);

  const days = useMemo(() => weekDays(data.now), [data.now]);
  const contents = useMemo(() => dayContents(days, data.plans, data.left, data.now), [days, data.plans, data.left, data.now]);
  const spend = useMemo(() => monthSpend(data.plans, data.passes, data.now), [data.plans, data.passes, data.now]);

  if (isConfigured && !user) {
    return <SignUpPrompt title={WEEK_SIGNED_OUT.title} body={WEEK_SIGNED_OUT.body} cta={WEEK_SIGNED_OUT.cta} />;
  }

  const owner: Owner | null = user
    ? { id: user.id, username: profile?.username ?? null, displayName: profile?.display_name?.trim() || "", avatarUrl: profile?.avatar_url ?? undefined }
    : null;

  const onSelect = (offset: number) => {
    setSelected(offset);
    track({ name: "week_day_tapped", offset });
    document.getElementById(`week-day-${offset}`)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
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

  const noWindows = data.windows.length === 0;
  const hasPlans = contents.some((c) => c.plans.length > 0);

  return (
    <PageShell title={WEEK_VIEW.title} subtitle={`${rangeLine(days, data.now)} · ${WEEK_VIEW.place}`}>
      {data.status === "loading" && <WeekSkeleton />}
      {data.status === "error" && <ErrorNotice onRetry={data.reload} />}
      {data.status === "ready" && (
        <div className={PAGE_GRID}>
          <div className={SPAN_GRID}>
            <DayStrip days={contents} selected={selected} onSelect={onSelect} />
          </div>
          <div className={SPAN_GRID}>
            <GlanceCard goodHours={data.goodHours} windows={data.windows} budget={data.budget} spend={spend} onBudget={(b) => void onBudget(b)} />
          </div>
          <div className={SPAN_GRID}>
            <CityPicksRow picks={data.picks} />
          </div>
          {noWindows && (
            <Link
              to="/week/free?from=week"
              className={`flex min-h-14 items-center rounded-card border-[1.5px] border-dashed border-border px-4 py-3 text-body font-semibold text-foreground ${SPAN_GRID}`}
            >
              {WEEK_VIEW.noFreeTitle}
            </Link>
          )}
          {noWindows && !hasPlans ? (
            <Link to="/discover" className={`inline-flex min-h-11 items-center self-start text-small font-semibold text-accent-text underline-offset-4 hover:underline ${SPAN_GRID}`}>
              {WEEK_VIEW.findSomething}
            </Link>
          ) : (
            // Days stay in one column, in date order: a second column would read across, out of order.
            <div className={`flex flex-col gap-6 ${SPAN_GRID}`}>
              {contents.map((c) => (
                <DaySection key={c.day.offset} content={c} now={data.now} passes={data.passes} onBring={(p) => void onBring(p)} />
              ))}
            </div>
          )}
          <section className={`flex flex-col gap-1 rounded-card border border-border bg-card p-4 ${SPAN_GRID}`}>
            <h2 className="text-lead">{WEEK_VIEW.flipTitle}</h2>
            <p className="text-body text-muted-foreground">{WEEK_VIEW.flipBody}</p>
          </section>
          <Link to="/week/free?from=week" className={`inline-flex min-h-11 items-center self-start text-small font-semibold text-accent-text underline-offset-4 hover:underline ${SPAN_GRID}`}>
            {WEEK_VIEW.changeFree}
          </Link>
        </div>
      )}
    </PageShell>
  );
}

/** Blocks the size of the real ones: the day strip, the glance card and two tickets. */
function WeekSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-control" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-card" />
      <Skeleton className="h-24 rounded-card" />
      <Skeleton className="h-24 rounded-card" />
    </div>
  );
}
