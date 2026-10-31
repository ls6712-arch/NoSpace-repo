/**
 * The .ics format, in one place. It has no imports and uses nothing but the
 * language, so the app (`src/app/lib/calendarFile.ts`, the one event "Add to
 * calendar" downloads) and the calendar feed edge function (`calendar-feed`)
 * write exactly the same events.
 */

export interface IcsEvent {
  /** Stable, so a calendar that subscribed updates the event instead of adding a second one. */
  uid: string;
  startsAt: number;
  endsAt: number;
  title: string;
  where?: string;
  note?: string;
  /** A link back to Soosh. */
  url?: string;
  /** A display alarm this many minutes before. Left out for a feed (the person's calendar has its own defaults). */
  alarmMinutes?: number;
}

/** 20261031T190000Z */
export const utc = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** RFC 5545 text: backslash, semicolon, comma and newline are escaped. */
export const esc = (text: string) => text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Lines longer than 75 octets are folded onto a continuation line that starts with a space. */
export function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

export function vevent(e: IcsEvent, now: number): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${utc(now)}`,
    `DTSTART:${utc(e.startsAt)}`,
    `DTEND:${utc(e.endsAt)}`,
    `SUMMARY:${esc(e.title)}`,
    ...(e.where ? [`LOCATION:${esc(e.where)}`] : []),
    ...(e.note ? [`DESCRIPTION:${esc(e.note)}`] : []),
    ...(e.url ? [`URL:${e.url}`] : []),
    ...(e.alarmMinutes !== undefined
      ? ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, `TRIGGER:-PT${e.alarmMinutes % 60 === 0 ? `${e.alarmMinutes / 60}H` : `${e.alarmMinutes}M`}`, "END:VALARM"]
      : []),
    "END:VEVENT",
  ];
}

export function vcalendar(events: readonly IcsEvent[], opts: { prodid: string; now: number; name?: string; refreshHours?: number }): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${opts.prodid}`,
    "CALSCALE:GREGORIAN",
    ...(opts.name ? [`X-WR-CALNAME:${esc(opts.name)}`] : []),
    ...(opts.refreshHours ? [`REFRESH-INTERVAL;VALUE=DURATION:PT${opts.refreshHours}H`, `X-PUBLISHED-TTL:PT${opts.refreshHours}H`] : []),
    ...events.flatMap((e) => vevent(e, opts.now)),
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
