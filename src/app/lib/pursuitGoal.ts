import { plural } from "./plural";

/** The goal stepper's ranges: how many times, and over how many weeks. */
export const COUNT_RANGE = { min: 1, max: 30 } as const;
export const WEEK_CHOICES = [1, 2, 3, 4, 6, 8, 12] as const;

export const clampCount = (n: number) => Math.max(COUNT_RANGE.min, Math.min(COUNT_RANGE.max, Math.round(n)));

/** The next week count in the cycle, wrapping back to the first. */
export function nextWeeks(weeks: number): number {
  const i = WEEK_CHOICES.findIndex((w) => w === weeks);
  return WEEK_CHOICES[(i + 1) % WEEK_CHOICES.length];
}

/** The end of the day `weeks` weeks from `from`, in the viewer's own time zone. */
export function endsAtFor(weeks: number, from = new Date()): number {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + weeks * 7, 23, 59, 59, 999);
  return d.getTime();
}

/** "Pasta 5 times in 4 weeks": a new Pursuit's title. Corner names are never shortened. */
export function pursuitTitleFor(cornerName: string, count: number, weeks: number): string {
  return `${cornerName.trim()} ${plural(count, "time")} in ${plural(weeks, "week")}`;
}

/** "Log pasta #2": the fixed button on a Pursuit page. `done` is how many you have logged. */
export function logLabel(cornerName: string | undefined, done: number): string {
  const what = cornerName?.trim().toLowerCase();
  return what ? `Log ${what} #${done + 1}` : `Log #${done + 1}`;
}

/** Whole days between two moments, at least 1: "26 days". */
export function daysBetween(start: number, end: number): number {
  return Math.max(1, Math.round((end - start) / 86_400_000));
}
