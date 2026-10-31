import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
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
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pb-8 pt-4 max-desk:pt-[calc(var(--safe-top)+1rem)]">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Link to="/my-space" aria-label={WEEK_VIEW.backToHome} className="-ml-2 inline-flex size-11 items-center justify-center rounded-full text-foreground">
            <ArrowLeft className="size-6" strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>
        <h1 className="text-display font-extrabold leading-tight" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
          {WEEK_VIEW.title}
        </h1>
        <p className="text-body text-muted-foreground">
          {rangeLine(days, data.now)} · {WEEK_VIEW.place}
        </p>
      </header>

      {data.status === "loading" && <WeekSkeleton />}
      {data.status === "error" && <ErrorNotice onRetry={data.reload} />}
      {data.status === "ready" && (
        <>
          <DayStrip days={contents} selected={selected} onSelect={onSelect} />
          <GlanceCard goodHours={data.goodHours} windows={data.windows} budget={data.budget} spend={spend} onBudget={(b) => void onBudget(b)} />
          <CityPicksRow picks={data.picks} />
          {noWindows && (
            <Link
              to="/week/free?from=week"
              className="flex min-h-14 items-center rounded-card border-[1.5px] border-dashed border-border px-4 py-3 text-body font-semibold text-foreground"
            >
              {WEEK_VIEW.noFreeTitle}
            </Link>
          )}
          {noWindows && !hasPlans ? (
            <Link to="/discover" className="inline-flex min-h-11 items-center self-start text-small font-semibold text-accent-text underline-offset-4 hover:underline">
              {WEEK_VIEW.findSomething}
            </Link>
          ) : (
            contents.map((c) => <DaySection key={c.day.offset} content={c} now={data.now} passes={data.passes} onBring={(p) => void onBring(p)} />)
          )}
          <section className="flex flex-col gap-1 rounded-card border border-border bg-card p-4">
            <h2 className="text-lead font-bold" style={{ fontFamily: "var(--font-display)" }}>
              {WEEK_VIEW.flipTitle}
            </h2>
            <p className="text-body text-muted-foreground">{WEEK_VIEW.flipBody}</p>
          </section>
          <Link to="/week/free?from=week" className="inline-flex min-h-11 items-center self-start text-small font-semibold text-accent-text underline-offset-4 hover:underline">
            {WEEK_VIEW.changeFree}
          </Link>
        </>
      )}
    </div>
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
