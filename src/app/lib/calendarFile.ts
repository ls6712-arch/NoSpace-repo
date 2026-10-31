/**
 * "Add to calendar": a one-event .ics file with an alarm an hour before. It
 * is a download, so it needs no account, no server and no permission, and it
 * opens in whichever calendar the phone or computer uses. The format itself
 * (`supabase/functions/_shared/ics.ts`) is shared with the subscribe feed.
 */

import { utc, vcalendar } from "../../../supabase/functions/_shared/ics.ts";

export interface CalendarPlan {
  title: string;
  startsAt: number;
  /** How long to block out. A listing does not say, so an hour. */
  minutes?: number;
  where?: string;
  note?: string;
}

export function buildIcs(plan: CalendarPlan, now = Date.now()): string {
  const end = plan.startsAt + (plan.minutes ?? 60) * 60_000;
  return vcalendar(
    [{ uid: `${utc(plan.startsAt)}-${Math.abs(hash(plan.title))}@soosh`, startsAt: plan.startsAt, endsAt: end, title: plan.title, where: plan.where, note: plan.note, alarmMinutes: 60 }],
    { prodid: "-//Soosh//First plan//EN", now },
  );
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
