import { ResponsiveSheet } from "../profile/ResponsiveSheet";
import { useState } from "react";
import { DAYS } from "../../lib/tasteModel";
import {
  copyHours,
  draftWindows,
  hourLabel,
  type HourDraft,
  type WeeklyDay,
} from "../../lib/weeklyHours";
const field =
  "min-h-11 w-full min-w-0 rounded-control border border-border bg-card px-3 text-body text-foreground";
export function WeeklyHoursEditor({
  ranges,
  onChange,
  disabled = false,
}: {
  ranges: HourDraft[];
  onChange: (next: HourDraft[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState<WeeklyDay>(ranges[0]?.day ?? "mon");
  const [copying, setCopying] = useState(false);
  const [targets, setTargets] = useState<WeeklyDay[]>([]);
  const issue = draftWindows(ranges).error;
  const update = (id: string, patch: Partial<HourDraft>) =>
    onChange(ranges.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
    <fieldset
      disabled={disabled}
      className="flex flex-col divide-y divide-border rounded-card border border-border bg-card px-4"
    >
      {DAYS.map((day) => {
        const rows = ranges.filter((r) => r.day === day.key);
        const summary = [...rows]
          .sort((a, b) => a.from.localeCompare(b.from))
          .map((r) => {
            const value = draftWindows([r]);
            if (value.error) return `${r.from} to ${r.to}`;
            const [a, b] = value.windows[0]
              .split("@")[1]
              .split("-")
              .map(Number);
            return `${hourLabel(a)} to ${hourLabel(b)}`;
          })
          .join(", ");
        return (
          <section key={day.key} className="py-3">
            <button
              type="button"
              aria-expanded={open === day.key}
              onClick={() => {
                setOpen(day.key);
                setCopying(false);
                setTargets([]);
              }}
              className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
            >
              <span className="text-body font-semibold">{day.label}</span>
              <span className="text-right text-small text-muted-foreground">
                {summary || "No times added"}
              </span>
            </button>
            {open === day.key && (
              <div className="flex flex-col gap-3 pb-2 pt-2">
                {rows.map((r, i) => (
                  <div key={r.id} className="flex items-end gap-2">
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-small text-muted-foreground">
                      From
                      <input
                        aria-label={`${day.label} from ${i + 1}`}
                        type="time"
                        required
                        className={field}
                        value={r.from}
                        onChange={(e) => update(r.id, { from: e.target.value })}
                      />
                    </label>
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-small text-muted-foreground">
                      To
                      <input
                        aria-label={`${day.label} to ${i + 1}`}
                        type="time"
                        required
                        className={field}
                        value={r.to}
                        onChange={(e) => update(r.id, { to: e.target.value })}
                      />
                    </label>
                    <button
                      type="button"
                      aria-label={`Remove ${day.label} time ${i + 1}`}
                      className="min-h-11 px-1 text-small underline"
                      onClick={() =>
                        onChange(ranges.filter((x) => x.id !== r.id))
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  <button
                    type="button"
                    className="min-h-11 text-small font-semibold underline"
                    disabled={rows.length >= 8}
                    onClick={() =>
                      onChange([
                        ...ranges,
                        {
                          id: crypto.randomUUID(),
                          day: day.key,
                          from: "18:00",
                          to: "19:00",
                        },
                      ])
                    }
                  >
                    Add time
                  </button>
                  {rows.length > 0 && (
                    <button
                      type="button"
                      disabled={!!issue}
                      className="min-h-11 text-small font-semibold underline"
                      onClick={() => setCopying(!copying)}
                    >
                      Copy to other days
                    </button>
                  )}
                </div>
                {copying && (
                  <ResponsiveSheet
                    open
                    title="Copy to other days"
                    onOpenChange={setCopying}
                  >
                    <div className="flex flex-col gap-3">
                      <p className="text-small text-muted-foreground">
                        Adds these hours without removing existing times.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {DAYS.filter((d) => d.key !== day.key).map((d) => (
                          <label
                            key={d.key}
                            className="flex min-h-11 items-center gap-2 pr-3 text-small"
                          >
                            <input
                              type="checkbox"
                              checked={targets.includes(d.key)}
                              onChange={(e) =>
                                setTargets((t) =>
                                  e.target.checked
                                    ? [...t, d.key]
                                    : t.filter((k) => k !== d.key),
                                )
                              }
                            />
                            {d.label}
                          </label>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="min-h-12 w-full rounded-full bg-accent px-6 text-body font-semibold text-accent-foreground disabled:opacity-50"
                        disabled={!targets.length}
                        onClick={() => {
                          onChange(copyHours(ranges, day.key, targets));
                          setCopying(false);
                          setTargets([]);
                        }}
                      >
                        Copy hours
                      </button>
                    </div>
                  </ResponsiveSheet>
                )}
              </div>
            )}
          </section>
        );
      })}
      <button
        type="button"
        disabled={!ranges.length}
        className="min-h-11 self-start py-3 text-small underline"
        onClick={() => onChange([])}
      >
        Clear usual free times
      </button>
      {issue && (
        <p role="alert" className="py-3 text-small text-destructive">
          {issue}
        </p>
      )}
    </fieldset>
  );
}
