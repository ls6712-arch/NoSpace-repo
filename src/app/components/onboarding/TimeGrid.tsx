import { formatTime } from "../../lib/dates";
import { HOME_TZ, nyTimeToMs } from "../../lib/homeWeek";
import { Check } from "lucide-react";
import { DAYS, SLOTS, windowKey, windowLabel } from "../../lib/tasteModel";

const timeRanges = Object.fromEntries(SLOTS.map((slot) => {
  const start = nyTimeToMs(2026, 1, 1, slot.key === "day" ? 6 : 18);
  const end = nyTimeToMs(2026, 1, slot.key === "day" ? 1 : 2, slot.key === "day" ? 18 : 0);
  return [slot.key, `${formatTime(start, HOME_TZ)} to ${formatTime(end, HOME_TZ)}`];
}));

/**
 * The 7 by 2 grid of free windows: a row for daytime, a row for evening, a
 * column per day. Each cell is a real button with `aria-pressed` and its own
 * text ("Saturday daytime, on"), so it does not rely on color or the dashed border.
 */
export function TimeGrid({ windows, onToggle, showTimes = false }: { windows: readonly string[]; onToggle: (key: string) => void; showTimes?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-7 justify-items-center" aria-hidden="true">
        {DAYS.map((d) => (
          <span key={d.key} className="ob-label text-small ob-muted">
            {d.short}
          </span>
        ))}
      </div>
      {SLOTS.map((slot) => (
        <div key={slot.key} role="group" aria-label={slot.heading}>
          <p className="ob-label mb-2 text-small">
            {slot.heading}
            {showTimes && <span className="ml-2 text-caption text-muted-foreground">{timeRanges[slot.key]}</span>}
          </p>
          <div className="grid grid-cols-7 justify-items-center">
            {DAYS.map((d) => {
              const key = windowKey(d.key, slot.key);
              const on = windows.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  className="ob-cell"
                  aria-pressed={on}
                  aria-label={`${windowLabel(d.key, slot.key)}, ${on ? "on" : "off"}`}
                  onClick={() => onToggle(key)}
                >
                  {on && <Check className="size-5" strokeWidth={4} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
