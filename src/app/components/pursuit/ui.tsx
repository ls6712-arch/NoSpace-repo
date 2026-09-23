import { ReactNode } from "react";
import { Check, Minus, Plus } from "lucide-react";

/** Terracotta fill used by every Pursuit progress bar. */
export function ProgressBar({ fraction, className = "", thin = false }: { fraction: number; className?: string; thin?: boolean }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--coral)_14%,var(--surface-muted))] ${thin ? "h-1.5" : "h-2.5"} ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div className="h-full rounded-full bg-[var(--coral)] transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Numbered step dots joined by a line, current one filled terracotta. */
export function StepDots({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mb-7 flex items-start">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="relative flex flex-1 flex-col items-center">
            {i > 0 && (
              <span
                className={`absolute right-1/2 top-3.5 h-px w-full ${i <= current ? "bg-[var(--coral)]" : "bg-border"}`}
                aria-hidden="true"
              />
            )}
            <span
              className={`relative z-10 flex size-7 items-center justify-center rounded-full border text-xs ${
                active
                  ? "border-[var(--coral)] bg-[var(--coral)] text-white"
                  : done
                    ? "border-[var(--coral)] bg-card text-[var(--coral-deep)]"
                    : "border-border bg-card text-muted-foreground"
              }`}
              aria-current={active ? "step" : undefined}
            >
              {done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={`mt-1.5 text-[11px] ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** − amount + unit, the "How much did this move it forward?" control. */
export function AmountStepper({
  value,
  onChange,
  step,
  unit,
  allowDecimals,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  unit: string;
  allowDecimals: boolean;
}) {
  const round = (v: number) => Math.max(0, allowDecimals ? Math.round(v * 100) / 100 : Math.round(v));
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(round(value - step))}
        className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:border-[var(--coral-deep)]"
        aria-label="Less"
      >
        <Minus className="size-4" />
      </button>
      <input
        inputMode={allowDecimals ? "decimal" : "numeric"}
        value={Number.isFinite(value) ? String(value) : ""}
        onChange={(e) => {
          const v = Number(e.target.value.replace(/,/g, ""));
          onChange(Number.isFinite(v) ? round(v) : 0);
        }}
        className="h-9 w-20 rounded-lg border border-border bg-card text-center text-sm text-foreground outline-none focus:border-[var(--coral-deep)]"
        aria-label="Amount"
      />
      <button
        type="button"
        onClick={() => onChange(round(value + step))}
        className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:border-[var(--coral-deep)]"
        aria-label="More"
      >
        <Plus className="size-4" />
      </button>
      <span className="ml-1 text-sm text-foreground">{unit}</span>
    </div>
  );
}

/** Lavender panel — the tip boxes and selected rows in the mockups. */
export function SoftPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-[color-mix(in_srgb,var(--pastel-stone)_22%,var(--card))] p-3.5 ${className}`}>{children}</div>
  );
}

/** On/off switch in the terracotta accent. */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-[var(--coral)]" : "bg-border"}`}
    >
      <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
