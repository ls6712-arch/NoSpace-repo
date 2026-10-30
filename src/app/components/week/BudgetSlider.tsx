import { useId, useRef, useState } from "react";
import { WEEK_VIEW } from "../../lib/homeCopy";
import { BUDGETS, budgetLabel, type Budget } from "../../lib/tasteModel";
import { budgetIndex } from "../../lib/weekView";

/**
 * The monthly budget: a slider that snaps to the four amounts. It saves when
 * the thumb is let go (or a key is released), with no Save button. Private:
 * this component lives only on the Week view and takes no part in anything
 * shared.
 */
export function BudgetSlider({ value, onCommit, describedBy }: { value: Budget | null; onCommit: (b: Budget) => void; describedBy?: string }) {
  const id = useId();
  const [index, setIndex] = useState(budgetIndex(value));
  const saved = useRef(budgetIndex(value));
  const [seen, setSeen] = useState(value);
  // The saved value can arrive after the first paint.
  if (seen !== value) {
    setSeen(value);
    setIndex(budgetIndex(value));
    saved.current = budgetIndex(value);
  }

  const release = () => {
    if (index === saved.current) return;
    saved.current = index;
    onCommit(BUDGETS[index]);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-small font-semibold">
          {WEEK_VIEW.monthlyBudget}
        </label>
        <span aria-hidden="true" className="text-lead font-bold" style={{ fontFamily: "var(--font-display)" }}>
          {budgetLabel(BUDGETS[index])}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={BUDGETS.length - 1}
        step={1}
        value={index}
        aria-valuetext={budgetLabel(BUDGETS[index])}
        aria-describedby={describedBy}
        onChange={(e) => setIndex(Number(e.target.value))}
        onPointerUp={release}
        onTouchEnd={release}
        onKeyUp={release}
        onBlur={release}
        className="h-11 w-full cursor-pointer accent-[var(--accent)]"
      />
      <div aria-hidden="true" className="flex justify-between text-caption text-muted-foreground">
        {BUDGETS.map((b) => (
          <span key={b}>{budgetLabel(b)}</span>
        ))}
      </div>
    </div>
  );
}
