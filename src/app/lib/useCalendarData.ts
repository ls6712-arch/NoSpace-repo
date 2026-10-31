import { useEffect, useState } from "react";
import { formatDate } from "./dates";
import { HOME_TZ } from "./homeWeek";
import { fetchMyStubs, type StubCard } from "./stubs";
import { fetchWeekDetail } from "./weekPlans";
import type { WeekPlanDetail } from "./weekView";

export interface CalendarExtra {
  /** Plans and Pursuit sessions in the range being looked at (the month grid, a week, a day). */
  plans: WeekPlanDetail[];
  /** Every Stub the person has collected, newest first. */
  stubs: StubCard[];
  /** The range's plans could not be read. The Stubs are best effort and never cause this. */
  failed: boolean;
}

const EMPTY: CalendarExtra = { plans: [], stubs: [], failed: false };

const formatDay = (ms: number) => formatDate(ms, { timeZone: HOME_TZ });

/**
 * What the calendar reads on top of the Week view's data: the person's plans in
 * whatever range is on screen (they page back to the month they joined and 3
 * months ahead) and their Stubs. The last answer stays on screen while the next
 * one loads, so paging does not flash empty.
 */
export function useCalendarData(userId: string | undefined, fromMs: number, toMs: number, attempt = 0): CalendarExtra {
  const [stubs, setStubs] = useState<StubCard[]>([]);
  const [plans, setPlans] = useState<WeekPlanDetail[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    void fetchMyStubs(userId, formatDay).then((s) => live && setStubs(s));
    return () => {
      live = false;
    };
  }, [userId, attempt]);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    fetchWeekDetail(userId, fromMs, toMs)
      .then((p) => {
        if (!live) return;
        setPlans(p);
        setFailed(false);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [userId, fromMs, toMs, attempt]);

  return userId ? { plans, stubs, failed } : EMPTY;
}
