/**
 * The one place the app turns a date into text. Every screen goes through
 * these so a date reads the same everywhere:
 *
 * - Past, under 7 days: relative and short — "now", "5m", "3h", "3d"
 *   (or "just now", "5m ago", "Yesterday" with `{ ago: true }` inside a sentence).
 * - Otherwise: "Sep 24", with the year only when it isn't this year
 *   ("Sep 24, 2025").
 * - Ranges use "to": "Oct 1 to 5", "Sep 28 to Oct 3".
 *
 * Copy is English-only, so the locale is fixed rather than taken from the
 * browser — a date in a list shouldn't change shape from one person to the
 * next. Pass `timeZone` for anything tied to a place (Space events).
 */

export type DateInput = number | string | Date;

const LOCALE = "en-US";
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function toDate(input: DateInput): Date {
  return input instanceof Date ? input : new Date(input);
}

/** Cached formatters: `Intl.DateTimeFormat` is slow to build, and a long
 * list would otherwise build one per row. */
const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(opts);
  let f = cache.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(LOCALE, opts);
    } catch {
      // An unknown time zone (bad data on an event) falls back to local time.
      const { timeZone: _ignored, ...rest } = opts;
      f = new Intl.DateTimeFormat(LOCALE, rest);
    }
    cache.set(key, f);
  }
  return f;
}

function yearIn(d: Date, timeZone?: string): number {
  return Number(fmt({ year: "numeric", timeZone }).format(d));
}

function isThisYear(d: Date, now: number, timeZone?: string): boolean {
  return yearIn(d, timeZone) === yearIn(new Date(now), timeZone);
}

export interface DateOptions {
  /** "Sep" (default) or "September". */
  month?: "short" | "long";
  /** Add the weekday: "Wed, Sep 24" or "Wednesday, September 24". */
  weekday?: "short" | "long";
  /** Always show the year, even this year. */
  year?: boolean;
  timeZone?: string;
  /** For tests. */
  now?: number;
}

/** "Sep 24" — or "Sep 24, 2025" when it isn't this year. */
export function formatDate(input: DateInput, opts: DateOptions = {}): string {
  const d = toDate(input);
  if (Number.isNaN(d.getTime())) return "";
  const now = opts.now ?? Date.now();
  const showYear = opts.year || !isThisYear(d, now, opts.timeZone);
  return fmt({
    month: opts.month ?? "short",
    day: "numeric",
    ...(opts.weekday ? { weekday: opts.weekday } : {}),
    ...(showYear ? { year: "numeric" } : {}),
    ...(opts.timeZone ? { timeZone: opts.timeZone } : {}),
  }).format(d);
}

export interface WhenOptions {
  /** Inside a sentence: "just now", "5m ago", "3d ago". Past 7 days it is
   * the plain date either way ("Updated Sep 24"). */
  ago?: boolean;
  /** For tests. */
  now?: number;
}

/**
 * The default for anything that happened: relative under 7 days ("now",
 * "5m", "3h", "3d"), then the date ("Sep 24", "Sep 24, 2025"). A future
 * time gets the plain date.
 */
export function formatWhen(input: DateInput, opts: WhenOptions = {}): string {
  const d = toDate(input);
  if (Number.isNaN(d.getTime())) return "";
  const now = opts.now ?? Date.now();
  const diff = now - d.getTime();
  if (diff < 0 || diff >= 7 * DAY) return formatDate(d, { now });
  const ago = opts.ago ? " ago" : "";
  if (diff < MINUTE) return opts.ago ? "just now" : "now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m${ago}`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h${ago}`;
  if (opts.ago && diff < 2 * DAY) return "Yesterday";
  return `${Math.floor(diff / DAY)}d${ago}`;
}

/** "September" this year, "September 2025" otherwise — month headings. */
export function formatMonth(input: DateInput, opts: { now?: number } = {}): string {
  const d = toDate(input);
  if (Number.isNaN(d.getTime())) return "";
  const now = opts.now ?? Date.now();
  return fmt(isThisYear(d, now) ? { month: "long" } : { month: "long", year: "numeric" }).format(d);
}

/** "Wed" or "Wednesday". */
export function formatWeekday(
  input: DateInput,
  style: "short" | "long" = "short",
  timeZone?: string,
): string {
  const d = toDate(input);
  if (Number.isNaN(d.getTime())) return "";
  return fmt({ weekday: style, ...(timeZone ? { timeZone } : {}) }).format(d);
}

/** "7:00 PM". */
export function formatTime(input: DateInput, timeZone?: string): string {
  const d = toDate(input);
  if (Number.isNaN(d.getTime())) return "";
  return fmt({ hour: "numeric", minute: "2-digit", ...(timeZone ? { timeZone } : {}) }).format(d);
}

/** "Sat, Oct 4, 7:00 PM" — events and scheduled sessions. */
export function formatDateTime(
  input: DateInput,
  opts: { timeZone?: string; weekday?: boolean; now?: number } = {},
): string {
  const d = toDate(input);
  if (Number.isNaN(d.getTime())) return "";
  const date = formatDate(d, {
    weekday: opts.weekday === false ? undefined : "short",
    timeZone: opts.timeZone,
    now: opts.now,
  });
  return `${date}, ${formatTime(d, opts.timeZone)}`;
}

/** "Oct 1 to 5", "Sep 28 to Oct 3", "Dec 30, 2025 to Jan 2, 2026". */
export function formatDateRange(start: DateInput, end: DateInput, opts: { now?: number } = {}): string {
  const a = toDate(start);
  const b = toDate(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "";
  const now = opts.now ?? Date.now();
  const sameYear = a.getFullYear() === b.getFullYear();
  if (!sameYear) return `${formatDate(a, { year: true })} to ${formatDate(b, { year: true })}`;
  const thisYear = isThisYear(a, now);
  const tail = thisYear ? "" : `, ${a.getFullYear()}`;
  const startText = fmt({ month: "short", day: "numeric" }).format(a);
  if (a.getMonth() === b.getMonth()) {
    if (a.getDate() === b.getDate()) return `${startText}${tail}`;
    return `${startText} to ${b.getDate()}${tail}`;
  }
  return `${startText} to ${fmt({ month: "short", day: "numeric" }).format(b)}${tail}`;
}
