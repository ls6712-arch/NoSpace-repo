import { useCallback, useEffect, useMemo, useState } from "react";
import { savePrivate } from "./onboardingRemote";
import { loadPlanInput } from "./firstPlanRemote";
import { nyParts, nyTimeToMs, windowsLeft, type WeekWindow } from "./homeWeek";
import { isBudget, type Budget, type Pass } from "./tasteModel";
import { fetchTaste } from "./tasteRemote";
import { fetchWeekDetail } from "./weekPlans";
import { fetchCityPicks, type CityPick } from "./cityPicks";
import { candidateSpans, freeSpans, goodPlanHours, type WeekPlanDetail } from "./weekView";
import type { LiveEventInput, LivePursuitInput, PlanInput } from "./firstPlan";
import { subHobbyLabel, titleCaseSlug } from "../data/hobbies";

const DAY = 86_400_000;

export interface WeekData {
  status: "loading" | "ready" | "error";
  /** When the data was read: every "tonight" and "left" on the screen is relative to it. */
  now: number;
  windows: string[];
  left: WeekWindow[];
  budget: Budget | null;
  passes: Pass[];
  /** The 7 days from today and the rest of this month, soonest first. */
  plans: WeekPlanDetail[];
  /** The hand-picked "This week in New York" cards. Empty hides the row. */
  picks: CityPick[];
  /** Hours of the person's free time that something they could go to covers. 0 hides the line. */
  goodHours: number;
  /** What Stubby's picks are made from. Left out when it could not be read. */
  stubby?: { picks: PlanInput["picks"]; events: readonly LiveEventInput[]; pursuits: readonly LivePursuitInput[]; area: string };
  reload: () => void;
  /** Saves on its own; the screen keeps showing the new amount either way. Returns whether it saved. */
  saveBudget: (b: Budget) => Promise<boolean>;
}

interface Candidates {
  events: readonly LiveEventInput[];
  pursuits: readonly LivePursuitInput[];
  picks: PlanInput["picks"];
  area: string;
}
const EMPTY: Candidates = { events: [], pursuits: [], picks: [], area: "" };

/** A Corner's name from its key ("crafts/pottery" is "Pottery"). */
const cornerName = (key: string) => {
  const slug = key.split("/")[1] ?? key;
  return subHobbyLabel(slug) ?? titleCaseSlug(slug);
};

/**
 * Everything the Week view reads, in one go. The person's own plans are the
 * one read that can fail the screen (it then offers a retry); the free time,
 * budget and good-plan candidates are best effort, so a failure there only
 * means no free slots or no "good plan hours" line.
 */
export function useWeekData(userId: string | undefined): WeekData {
  const [state, setState] = useState<Omit<WeekData, "reload" | "saveBudget" | "goodHours" | "left" | "stubby">>({
    status: "loading",
    now: Date.now(),
    windows: [],
    budget: null,
    passes: [],
    plans: [],
    picks: [],
  });
  const [candidates, setCandidates] = useState(EMPTY);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    const now = Date.now();
    setState((s) => ({ ...s, status: "loading" }));
    void (async () => {
      const p = nyParts(now);
      // From the 1st of this month, so the budget line can add up what is planned so far.
      const from = Math.min(nyTimeToMs(p.y, p.m, 1, 0), now);
      const to = Math.max(nyTimeToMs(p.y, p.m + 1, 1, 0), now + 7 * DAY);
      const [taste, plans, picks] = await Promise.all([fetchTaste(userId), fetchWeekDetail(userId, from, to), fetchCityPicks(now, now + 7 * DAY, userId)]);
      let input: Awaited<ReturnType<typeof loadPlanInput>> | null = null;
      try {
        input = await loadPlanInput({ userId, names: new Map(taste.picks.map((k) => [k, cornerName(k)])), redirectTo: "" }, now);
      } catch {
        input = null;
      }
      if (!live) return;
      setCandidates(input ? { events: input.events, pursuits: input.pursuits, picks: input.picks, area: input.area } : EMPTY);
      setState({ status: "ready", now, windows: taste.windows, budget: taste.budget, passes: input?.passes ?? [], plans, picks });
    })().catch(() => live && setState((s) => ({ ...s, status: "error" })));
    return () => {
      live = false;
    };
  }, [userId, attempt]);

  const left = useMemo(() => windowsLeft(state.windows, state.now), [state.windows, state.now]);
  const goodHours = useMemo(
    () => goodPlanHours(freeSpans(left, state.now), candidateSpans({ ...candidates, budget: state.budget, passes: state.passes })),
    [left, state.now, state.budget, state.passes, candidates],
  );
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const saveBudget = useCallback(
    async (b: Budget) => {
      if (!userId || !isBudget(b)) return false;
      setState((s) => ({ ...s, budget: b }));
      const r = await savePrivate(userId, { monthly_budget: b });
      return !r.error;
    },
    [userId],
  );

  const stubby = useMemo(() => (candidates === EMPTY ? undefined : { picks: candidates.picks, events: candidates.events, pursuits: candidates.pursuits, area: candidates.area }), [candidates]);

  return { ...state, left, goodHours, stubby, reload, saveBudget };
}
