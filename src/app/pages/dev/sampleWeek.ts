import type { GridHandlers } from "../../components/calendar/TimeGrid";
import { calendarDays, type CalendarDay } from "../../lib/calendarView";
import { nyParts, nyTimeToMs } from "../../lib/homeWeek";
import { weekDays, type WeekPlanDetail } from "../../lib/weekView";

/** A made-up week for the dev kit's calendar: plans across the next seven days, two of them overlapping. */
export function sampleWeek(now: number): CalendarDay[] {
  const days = weekDays(now, 7);
  const at = (offset: number, hour: number, minute = 0) => {
    const { y, m, d } = nyParts(days[offset].noonMs);
    return nyTimeToMs(y, m, d, hour) + minute * 60_000;
  };
  const plan = (id: string, title: string, color: WeekPlanDetail["color"], offset: number, from: number, to: number, place?: string): WeekPlanDetail => ({
    id,
    kind: "event",
    title,
    startsAt: at(offset, Math.floor(from), (from % 1) * 60),
    endsAt: at(offset, Math.floor(to), (to % 1) * 60),
    place,
    color,
    going: { friends: [{ id: "f1", name: "Priya" }], total: 3 },
  });
  const plans = [
    plan("event-1", "Sunrise run club", "lime", 0, 7, 8, "McCarren Park"),
    plan("event-2", "Wheel night", "orange", 0, 19, 21.5, "Clay Corner, Gowanus"),
    plan("event-3", "Pasta from scratch", "amber", 1, 18.5, 20.5, "Priya's kitchen"),
    plan("event-4", "Bouldering", "blue", 2, 12, 13.5, "Brooklyn Boulders"),
    plan("event-5", "Film club", "violet", 2, 20, 22.5, "Nitehawk"),
    plan("event-6", "Board games", "teal", 3, 19, 22),
    plan("event-7", "Karaoke", "pink", 3, 21, 23.5, "Gagopa"),
    plan("event-8", "Life drawing", "rose", 5, 10, 12, "Spring Studios"),
    plan("event-9", "Sauna and cold plunge", "blue", 6, 16, 18),
  ];
  return calendarDays(days, plans, [], ["sat-eve", "sun-day"], now);
}

export const noopHandlers: GridHandlers = {
  onEmpty: () => undefined,
  onPlan: () => undefined,
  onFree: () => undefined,
  onBlock: () => undefined,
  onStub: () => undefined,
  onPick: () => undefined,
  onKeep: () => undefined,
  onMovePlan: () => undefined,
  onChangeBlock: () => undefined,
  onDeletePlan: () => undefined,
  onDeleteBlock: () => undefined,
};
