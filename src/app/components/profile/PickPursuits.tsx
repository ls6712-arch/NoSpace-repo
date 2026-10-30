import { useState } from "react";
import { createPursuit, deletePursuit } from "../../lib/profileApi";
import { ERROR_LINE } from "../../lib/stateCopy";
import { notifyError } from "../ui/toaster";
import { cn } from "../ui/utils";
import { DEFAULT_CATEGORIES } from "./PursuitsPane";

/**
 * New user, no Pursuits: tapping a pill starts an ongoing Pursuit right away,
 * tapping it again removes the one just started. Each change shows at once and
 * is put back if saving fails.
 */
export function PickPursuits({ onChanged }: { onChanged: () => void }) {
  // category -> the id of the Pursuit started from it (empty while it is being saved)
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string[]>([]);

  const toggle = async (c: string) => {
    if (busy.includes(c)) return;
    const id = picked[c];
    setBusy((b) => [...b, c]);
    if (id === undefined) {
      setPicked((cur) => ({ ...cur, [c]: "" }));
      const r = await createPursuit(c, c, null);
      if (!r.ok) {
        setPicked((cur) => Object.fromEntries(Object.entries(cur).filter(([k]) => k !== c)));
        notifyError(ERROR_LINE);
      } else {
        setPicked((cur) => ({ ...cur, [c]: r.value }));
        onChanged();
      }
    } else {
      setPicked((cur) => Object.fromEntries(Object.entries(cur).filter(([k]) => k !== c)));
      const r = await deletePursuit(id);
      if (!r.ok) {
        setPicked((cur) => ({ ...cur, [c]: id }));
        notifyError(ERROR_LINE);
      } else {
        onChanged();
      }
    }
    setBusy((b) => b.filter((x) => x !== c));
  };

  return (
    <section aria-labelledby="pick-pursuits" className="rounded-card border border-border bg-card p-4">
      <h2 id="pick-pursuits" className="font-[family-name:var(--font-display)] text-lead font-bold">Pick your Pursuits</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {DEFAULT_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={c in picked}
            onClick={() => toggle(c)}
            className={cn("min-h-11 rounded-full border border-border px-4 text-small focus-visible:ring-[3px] focus-visible:outline-1", c in picked && "border-accent bg-accent text-accent-foreground")}
          >
            {c}
          </button>
        ))}
      </div>
    </section>
  );
}
