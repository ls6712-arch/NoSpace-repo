import { useState } from "react";
import { createPursuit } from "../../lib/profileApi";
import { ERROR_LINE } from "../../lib/stateCopy";
import { notifyError } from "../ui/toaster";
import { cn } from "../ui/utils";
import { DEFAULT_CATEGORIES } from "./PursuitsPane";

/** New user, no Pursuits: tapping a pill starts an ongoing Pursuit right away. */
export function PickPursuits({ onStarted }: { onStarted: () => void }) {
  const [picked, setPicked] = useState<string[]>([]);

  const pick = async (c: string) => {
    if (picked.includes(c)) return;
    setPicked((cur) => [...cur, c]);
    const r = await createPursuit(c, c, null);
    if (!r.ok) {
      setPicked((cur) => cur.filter((x) => x !== c));
      notifyError(ERROR_LINE);
      return;
    }
    onStarted();
  };

  return (
    <section aria-labelledby="pick-pursuits" className="rounded-card border border-border bg-card p-4">
      <h2 id="pick-pursuits" className="font-[family-name:var(--font-display)] text-lead font-bold">Pick your Pursuits</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {DEFAULT_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={picked.includes(c)}
            onClick={() => pick(c)}
            className={cn("min-h-11 rounded-full border border-border px-4 text-small focus-visible:ring-[3px] focus-visible:outline-1", picked.includes(c) && "border-accent bg-accent text-accent-foreground")}
          >
            {c}
          </button>
        ))}
      </div>
    </section>
  );
}
