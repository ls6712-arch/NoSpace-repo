import { localClock, localTimeMs } from "./preferenceTime.ts";

export const WEEKLY_HOURS_TIME_ZONE = "America/New_York";
export const WEEK_DAYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;
export type WeeklyDay = (typeof WEEK_DAYS)[number];
export interface WeeklyHours {
  key: string;
  day: WeeklyDay;
  start: number;
  end: number;
  legacy: boolean;
}
/** The old coarse keys remain readable. New keys store local minutes, not UTC. */
export function parseWeeklyHours(key: string): WeeklyHours | null {
  const old = /^(mon|tue|wed|thu|fri|sat|sun)-(day|eve)$/.exec(key);
  if (old)
    return {
      key,
      day: old[1] as WeeklyDay,
      start: old[2] === "day" ? 360 : 1080,
      end: old[2] === "day" ? 1080 : 1440,
      legacy: true,
    };
  const exact =
    /^(mon|tue|wed|thu|fri|sat|sun)@(0|[1-9]\d{0,3})-(0|[1-9]\d{0,3})$/.exec(
      key,
    );
  if (!exact) return null;
  const start = Number(exact[2]),
    end = Number(exact[3]);
  return start >= 0 && start < end && end <= 1440
    ? { key, day: exact[1] as WeeklyDay, start, end, legacy: false }
    : null;
}
export function weeklyHours(windows: readonly string[]): WeeklyHours[] {
  return [...new Set(windows)]
    .flatMap((key) => {
      const r = parseWeeklyHours(key);
      return r ? [r] : [];
    })
    .sort(
      (a, b) =>
        WEEK_DAYS.indexOf(a.day) - WEEK_DAYS.indexOf(b.day) ||
        a.start - b.start ||
        a.end - b.end,
    );
}
export function matchingHours(
  windows: readonly string[],
  starts: number,
  ends = starts + 1,
  zone = "America/New_York",
): string | null {
  if (!Number.isFinite(starts) || !Number.isFinite(ends) || ends <= starts)
    return null;
  // Exact hours belong to Calendar's displayed timezone, independently of
  // the timezone used to phrase an explicit request or a recommendation.
  if (weeklyHours(windows).some((r) => !r.legacy))
    zone = WEEKLY_HOURS_TIME_ZONE;
  const a = localClock(starts, zone),
    b = localClock(ends - 1, zone);
  const day = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][a.dow];
  if (a.year !== b.year || a.month !== b.month || a.day !== b.day) return null;
  return (
    weeklyHours(windows).find((r) => {
      if (
        r.day !== day ||
        a.hour * 60 + a.minute < r.start ||
        b.hour * 60 + b.minute >= r.end
      )
        return false;
      if (r.legacy) return true;
      const at = (minute: number) =>
        localTimeMs(a.year, a.month, a.day, Math.floor(minute / 60), zone) +
        (minute % 60) * 60_000;
      const start = at(r.start),
        end = at(r.end);
      const x = localClock(start, zone),
        y = localClock(end, zone);
      return (
        x.hour * 60 + x.minute === r.start % 1440 &&
        y.hour * 60 + y.minute === r.end % 1440 &&
        starts >= start &&
        ends <= end
      );
    })?.key ?? null
  );
}
