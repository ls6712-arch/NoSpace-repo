/**
 * "Add to calendar": a one-event .ics file with an alarm an hour before. It
 * is a download, so it needs no account, no server and no permission, and it
 * opens in whichever calendar the phone or computer uses.
 */

export interface CalendarPlan {
  title: string;
  startsAt: number;
  /** How long to block out. A listing does not say, so an hour. */
  minutes?: number;
  where?: string;
  note?: string;
}

/** 20261031T190000Z */
const utc = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** RFC 5545 text: backslash, semicolon, comma and newline are escaped. */
const esc = (text: string) => text.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Lines longer than 75 octets are folded onto a continuation line that starts with a space. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

export function buildIcs(plan: CalendarPlan, now = Date.now()): string {
  const end = plan.startsAt + (plan.minutes ?? 60) * 60_000;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Soosh//First plan//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${utc(plan.startsAt)}-${Math.abs(hash(plan.title))}@soosh`,
    `DTSTAMP:${utc(now)}`,
    `DTSTART:${utc(plan.startsAt)}`,
    `DTEND:${utc(end)}`,
    `SUMMARY:${esc(plan.title)}`,
    ...(plan.where ? [`LOCATION:${esc(plan.where)}`] : []),
    ...(plan.note ? [`DESCRIPTION:${esc(plan.note)}`] : []),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(plan.title)}`,
    "TRIGGER:-PT1H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return h;
}

/** A file name from the title: "bouldering-night.ics". */
export const icsFileName = (title: string) => `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "plan"}.ics`;

/** Hands the file to the browser as a download. */
export function downloadIcs(plan: CalendarPlan): void {
  const blob = new Blob([buildIcs(plan)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = icsFileName(plan.title);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
