import { useMemo } from "react";
import { SHEET } from "../../lib/calendarCopy";
import type { DayPart } from "../../lib/calendarActions";
import { dateParam, dayListDate, dayListHeading, parseDateParam } from "../../lib/calendarView";
import { weekDays } from "../../lib/weekView";
import type { WhenChoice } from "../../lib/startWhen";
import { cn } from "../ui/utils";

const CHIPS: { id: WhenChoice; label: string }[] = [
  { id: "now", label: "Now" },
  { id: "tonight", label: "Tonight" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "day", label: "Pick a day" },
];

const FIELD = "min-h-11 w-full rounded-control border border-border bg-card px-3 text-body text-foreground";
const chip = (on: boolean) => cn("min-h-11 rounded-full border px-4 text-small font-semibold", on ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground");

/**
 * When: one choice. Now needs nothing more. The day choices add Daytime or
 * Evening (and an exact time if the person wants one), the same fields the
 * calendar's plan form uses.
 */
export function WhenSection({
  choice,
  onChoice,
  part,
  onPart,
  day,
  onDay,
  exact,
  onExact,
  now,
  past,
}: {
  choice: WhenChoice | null;
  onChoice: (c: WhenChoice) => void;
  part: DayPart;
  onPart: (p: DayPart) => void;
  day: string;
  onDay: (d: string) => void;
  exact: string;
  onExact: (t: string) => void;
  now: number;
  /** The chosen time has already gone by. */
  past: boolean;
}) {
  const days = useMemo(() => weekDays(now, 14), [now]);
  const dayValue = parseDateParam(day) ?? now;
  const options = days.some((d) => dateParam(d.noonMs) === day) ? days : [...weekDays(dayValue, 1), ...days];
  return (
    <section aria-labelledby="start-when" className="mt-8">
      <h2 id="start-when" className="text-lead" style={{ fontFamily: "var(--font-display)" }}>
        {SHEET.when}
      </h2>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby="start-when">
        {CHIPS.map((c) => (
          <button key={c.id} type="button" aria-pressed={choice === c.id} onClick={() => onChoice(c.id)} className={chip(choice === c.id)}>
            {c.label}
          </button>
        ))}
      </div>
      {choice && choice !== "now" && (
        <div className="mt-3 flex flex-col gap-3">
          {choice === "day" && (
            <div className="flex flex-col gap-1">
              <label htmlFor="start-day" className="text-small font-semibold text-muted-foreground">
                {SHEET.day}
              </label>
              <select id="start-day" className={FIELD} value={day} onChange={(e) => onDay(e.target.value)}>
                {options.map((d) => (
                  <option key={d.offset + dateParam(d.noonMs)} value={dateParam(d.noonMs)}>
                    {`${dayListHeading(d, now)} ${dayListDate(d, now)}`}
                  </option>
                ))}
              </select>
            </div>
          )}
          {choice !== "tonight" && (
            <div className="flex gap-2" role="group" aria-label={SHEET.when}>
              {(["day", "eve"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={part === p}
                  onClick={() => {
                    onPart(p);
                    onExact("");
                  }}
                  className={cn(chip(part === p), "flex-1")}
                >
                  {p === "day" ? SHEET.daytime : SHEET.evening}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label htmlFor="start-exact" className="text-small font-semibold text-muted-foreground">
              {SHEET.exactTime}
            </label>
            <input id="start-exact" type="time" aria-invalid={past || undefined} className={FIELD} value={exact} onChange={(e) => onExact(e.target.value)} />
          </div>
        </div>
      )}
    </section>
  );
}
