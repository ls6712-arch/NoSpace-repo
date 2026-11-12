export { matchingHours } from "../../../supabase/functions/_shared/weeklyHours";
import {
  weeklyHours,
  WEEK_DAYS,
  type WeeklyDay,
} from "../../../supabase/functions/_shared/weeklyHours";
import { formatTime } from "./dates";
import { HOME_TZ, nyTimeToMs } from "./homeWeek";
export type { WeeklyDay };
export interface HourDraft {
  id: string;
  day: WeeklyDay;
  from: string;
  to: string;
}
export const clockValue = (minute: number) =>
  `${String(Math.floor((minute % 1440) / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
export const hourLabel = (minute: number) =>
  formatTime(
    nyTimeToMs(2026, 1, 1, Math.floor(minute / 60)) + (minute % 60) * 60_000,
    HOME_TZ,
  );
export function hourDrafts(windows: readonly string[]): HourDraft[] {
  return weeklyHours(windows).map((r, i) => ({
    id: `loaded-${i}`,
    day: r.day,
    from: clockValue(r.start),
    to: clockValue(r.end),
  }));
}
export function draftWindows(ranges: readonly HourDraft[]): {
  windows: string[];
  error: string | null;
} {
  if (ranges.length > 56)
    return { windows: [], error: "Keep up to eight time ranges per day." };
  const out: { day: WeeklyDay; start: number; end: number }[] = [];
  for (const r of ranges) {
    const minutes = (s: string) =>
      /^([01]\d|2[0-3]):[0-5]\d$/.test(s)
        ? Number(s.slice(0, 2)) * 60 + Number(s.slice(3))
        : NaN;
    const start = minutes(r.from),
      end = r.to === "00:00" ? 1440 : minutes(r.to);
    if (
      !WEEK_DAYS.includes(r.day) ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start
    )
      return {
        windows: [],
        error:
          "Choose an end time after the start. Split overnight hours between two days.",
      };
    out.push({ day: r.day, start, end });
  }
  for (const day of WEEK_DAYS) {
    const sorted = out
      .filter((r) => r.day === day)
      .sort((a, b) => a.start - b.start);
    if (sorted.length > 8)
      return { windows: [], error: "Keep up to eight time ranges per day." };
    if (sorted.some((r, i) => i > 0 && r.start < sorted[i - 1].end))
      return {
        windows: [],
        error: "These hours overlap. Adjust or remove a time range.",
      };
  }
  return {
    windows: weeklyHours(out.map((r) => `${r.day}@${r.start}-${r.end}`)).map(
      (r) => r.key,
    ),
    error: null,
  };
}
/** Copy adds hours; it never silently replaces hours already on another day. */
export function copyHours(
  ranges: readonly HourDraft[],
  source: WeeklyDay,
  targets: readonly WeeklyDay[],
): HourDraft[] {
  if (draftWindows(ranges).error) return [...ranges];
  let next = [...ranges];
  const sourceHours = weeklyHours(
    draftWindows(ranges.filter((r) => r.day === source)).windows,
  );
  for (const day of targets.filter((d) => d !== source)) {
    const all = [
      ...weeklyHours(draftWindows(next.filter((r) => r.day === day)).windows),
      ...sourceHours,
    ].sort((a, b) => a.start - b.start);
    const merged: { start: number; end: number }[] = [];
    for (const r of all) {
      const last = merged.at(-1);
      if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
      else merged.push({ start: r.start, end: r.end });
    }
    next = [
      ...next.filter((r) => r.day !== day),
      ...merged.map((r, i) => ({
        id: `copy-${day}-${i}`,
        day,
        from: clockValue(r.start),
        to: clockValue(r.end),
      })),
    ];
  }
  return next;
}
