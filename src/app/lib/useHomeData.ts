import { useEffect, useState } from "react";
import { fetchAffinity } from "./recommend";
import { privatePlace } from "./firstPlanRemote";
import { fetchHomeSuggestions } from "./homeSuggestions";
import { buildHomeItems, type HomeItem } from "./homeItems";
import { windowsLeft, type WeekPlan, type WeekWindow } from "./homeWeek";
import { fetchWeekPlans } from "./weekPlans";
import { fetchTaste } from "./tasteRemote";

export interface HomeData {
  status: "loading" | "ready";
  items: HomeItem[];
  /** The free windows the person saved. Empty when they have not. */
  windows: string[];
  left: WeekWindow[];
  plans: WeekPlan[];
  place: { city: string; area: string };
}

const EMPTY: HomeData = { status: "loading", items: [], windows: [], left: [], plans: [], place: { city: "", area: "" } };

/**
 * Everything the top of Home reads, in one go. Each read is best effort and
 * none can fail the page: no suggestions from the database just means the list
 * is filled with first steps from the person's picks.
 */
export function useHomeData(userId: string | undefined): HomeData {
  const [data, setData] = useState<HomeData>(EMPTY);
  useEffect(() => {
    if (!userId) return;
    let live = true;
    const now = Date.now();
    void (async () => {
      const [suggestions, taste, place, affinity, plans] = await Promise.all([
        fetchHomeSuggestions(8),
        fetchTaste(userId),
        privatePlace(userId),
        fetchAffinity(),
        fetchWeekPlans(userId, now),
      ]);
      const left = windowsLeft(taste.windows, now);
      const items = buildHomeItems(suggestions, { picks: taste.picks, affinity, windows: left });
      if (live) setData({ status: "ready", items, windows: taste.windows, left, plans, place });
    })().catch(() => live && setData({ ...EMPTY, status: "ready", items: buildHomeItems([], { picks: [], affinity: null, windows: [] }) }));
    return () => {
      live = false;
    };
  }, [userId]);
  return data;
}
