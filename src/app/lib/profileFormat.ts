import { formatDate, formatMonthYear, formatTime, formatWeekday } from "./dates";
import { plural } from "./plural";
import type { AvailabilityBlock, Day, DayPart, Membership, OwnerMoment, PlanSlot, PursuitItem, SharedMoment } from "./profileApi";

/** "2026-10-24" as a local date at noon, so no time zone can move the day. */
export function dayToDate(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

const lowerMeridiem = (t: string) => t.replace(/\s?([AP])M$/, (_, c: string) => ` ${c.toLowerCase()}m`);

/** Owner: "Oct 24 · 7:00 pm". */
export function ownerMomentMeta(m: OwnerMoment, now = Date.now()): string {
  return `${formatDate(m.occurredAt, { now })} · ${lowerMeridiem(formatTime(m.occurredAt))}`;
}

/** Everyone else: "Oct 24 · Gowanus", never a time of day. */
export function sharedMomentMeta(m: SharedMoment, now = Date.now()): string {
  const date = formatDate(dayToDate(m.date), { now });
  return m.neighborhood ? `${date} · ${m.neighborhood}` : date;
}

export function momentTitle(m: { category: string | null; caption: string | null }): string {
  return m.category || m.caption || "Moment";
}

export function momentAlt(m: { category: string | null; caption: string | null }): string {
  return [m.caption, m.category].filter(Boolean).join(", ") || "Moment";
}

/** "Visible to others at 7:42 pm". */
export function visibleAtLabel(visibleAt: string): string {
  return `Visible to others at ${lowerMeridiem(formatTime(visibleAt))}`;
}

/** The month and day block on a Stub card. */
export function stubBlock(stub: { date: string | null; day: string }): { month: string; day: string } {
  const d = stub.date ? new Date(stub.date) : dayToDate(stub.day);
  return { month: formatDate(d, { year: false }).split(" ")[0], day: String(d.getDate()) };
}

/** Status line under a Pursuit's goal. */
export function pursuitStatus(p: PursuitItem, role: "owner" | "other", now = Date.now()): string {
  if (p.finished) {
    if (role === "owner" && p.finishedAt) {
      return `Finished ${formatDate(dayToDate(p.finishedAt), { now })} · ${plural(p.stubCount, "Stub")}`;
    }
    const month = p.finishedAt ? formatMonthYear(dayToDate(`${p.finishedAt}-01`)).split(" ")[0] : "";
    return month ? `Finished in ${month}` : "Finished";
  }
  if (p.target) {
    const base = `${p.momentCount} of ${plural(p.target, "Moment")}`;
    return role === "owner" && p.lastMomentDate ? `${base} · last ${formatDate(p.lastMomentDate, { now })}` : base;
  }
  return `Ongoing · ${plural(p.momentCount, "Moment")}`;
}

export function pursuitFraction(p: PursuitItem): number | null {
  if (!p.target) return null;
  return Math.min(1, p.momentCount / p.target);
}

const DAYS: Day[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_NAMES: Record<Day, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
const PART_WORDS: Record<DayPart, string> = { morning: "mornings", afternoon: "afternoons", evening: "evenings" };

/** "Thu evenings · Weekends" from availability blocks. Empty list gives "". */
export function availabilitySummary(blocks: AvailabilityBlock[]): string {
  const bySlot = new Map<string, Set<DayPart>>();
  for (const b of blocks) {
    const set = bySlot.get(b.day) ?? new Set<DayPart>();
    set.add(b.part);
    bySlot.set(b.day, set);
  }
  const weekend = (d: Day) => d === "sat" || d === "sun";
  const parts: string[] = [];
  const weekendBoth = bySlot.has("sat") && bySlot.has("sun");
  if (weekendBoth) parts.push("Weekends");
  for (const day of DAYS) {
    const set = bySlot.get(day);
    if (!set || (weekendBoth && weekend(day))) continue;
    const words = (["morning", "afternoon", "evening"] as DayPart[]).filter((p) => set.has(p)).map((p) => PART_WORDS[p]);
    parts.push(`${DAY_NAMES[day]} ${words.join(" and ")}`);
  }
  return parts.join(" · ");
}

export function hoursSummary(hours: number | null): string {
  return hours === null ? "" : `${plural(hours, "hr")} a week`;
}

export function budgetSummary(cents: number | null): string {
  if (cents === null) return "";
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })} a month`;
}

export function membershipSummary(list: Membership[]): string {
  return list.map((m) => m.name).join(", ");
}

/** "Sat, Nov 7" for a plan slot. */
export function slotDay(slot: PlanSlot, now = Date.now()): string {
  const d = dayToDate(slot.date);
  return `${formatWeekday(d)}, ${formatDate(d, { now })}`;
}
export function slotPart(slot: PlanSlot): string {
  return slot.part.charAt(0).toUpperCase() + slot.part.slice(1);
}

export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || displayName;
}
