import { Check } from "lucide-react";
import { DAYS, SLOTS, windowKey, windowLabel } from "../../lib/tasteModel";

/**
 * The 7 by 2 grid of free windows: a row for daytime, a row for evening, a
 * column per day. Each cell is a real button with `aria-pressed` and its own
 * text ("Saturday daytime, on"), so it does not rely on color or the dashed border.
 */
export function TimeGrid({ windows, onToggle }: { windows: readonly string[]; onToggle: (key: string) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-7 justify-items-center" aria-hidden="true">
        {DAYS.map((d) => (
          <span key={d.key} className="transfer-label text-small transfer-muted">
            {d.short}
          </span>
        ))}
      </div>
      {SLOTS.map((slot) => (
        <div key={slot.key} role="group" aria-label={slot.heading}>
          <p className="transfer-label mb-2 text-small">{slot.heading}</p>
          <div className="grid grid-cols-7 justify-items-center">
            {DAYS.map((d) => {
              const key = windowKey(d.key, slot.key);
              const on = windows.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  className="transfer-cell"
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
