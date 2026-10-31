import type { Occurrence } from "../../lib/calendarEntries";
import type { CalendarFreeSlot } from "../../lib/calendarView";
import type { StubCard } from "../../lib/stubs";
import type { WeekPlanDetail } from "../../lib/weekView";

/** What the views call when something on them is tapped: each opens that thing's sheet. */
export interface Openers {
  plan: (plan: WeekPlanDetail) => void;
  stub: (stub: StubCard) => void;
  free: (slot: CalendarFreeSlot) => void;
  block: (block: Occurrence) => void;
  /** Make a plan, from a day when the view knows one. */
  makePlan: (dayMs?: number) => void;
}
