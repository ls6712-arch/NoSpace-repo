import { ReactNode, useEffect, useState } from "react";
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
      <div className="h-full rounded-full bg-[var(--coral)] transition-[width] duration-base ease-standard" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Circular variant of ProgressBar — same terracotta fill, same "no
 * percentage" rule: the ring's sweep communicates the fraction visually,
 * same as the linear bar's fill width does. `children` renders centered
 * inside the ring (this card uses it for the Pursuit's icon, never a
 * number). */
export function ProgressRing({
  fraction,
  size = 44,
  strokeWidth = 4,
  className = "",
  children,
}: {
  fraction: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  children?: ReactNode;
}) {
  const pct = Math.max(0, Math.min(1, fraction));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct * 100)}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="color-mix(in srgb, var(--coral) 14%, var(--surface-muted))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--coral)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-base ease-standard motion-reduce:transition-none"
        />
      </svg>
      {children && <span className="absolute inset-0 flex items-center justify-center">{children}</span>}
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
              className={`relative z-10 flex size-7 items-center justify-center rounded-full border text-caption ${
                active
                  ? "border-[var(--coral-deep)] bg-[var(--coral-deep)] text-on-brand"
                  : done
                    ? "border-[var(--coral)] bg-card text-[var(--coral-deep)]"
                    : "border-border bg-card text-muted-foreground"
              }`}
              aria-current={active ? "step" : undefined}
            >
              {done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={`mt-1.5 text-caption ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
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
  // The field keeps what's being typed, and only reports a number once it's
  // a complete one. Parsing on every keystroke turned "1." back into "1", so
  // typing 1.5 produced 15.
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text.replace(/,/g, "")) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const pattern = allowDecimals ? /^[\d,]*\.?\d*$/ : /^[\d,]*$/;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(round(value - step))}
        className="flex size-9 items-center justify-center rounded-control border border-border bg-card text-foreground hover:border-[var(--coral-deep)]"
        aria-label="Less"
      >
        <Minus className="size-4" />
      </button>
      <input
        inputMode={allowDecimals ? "decimal" : "numeric"}
        value={text}
        onChange={(e) => {
          const t = e.target.value;
          if (!pattern.test(t)) return;
          setText(t);
          if (t === "" || t.endsWith(".")) return;
          const v = Number(t.replace(/,/g, ""));
          if (Number.isFinite(v)) onChange(round(v));
        }}
        onBlur={() => setText(String(value))}
        className="h-9 w-20 rounded-control border border-border bg-card text-center text-body text-foreground outline-none focus:border-[var(--coral-deep)]"
        aria-label="Amount"
      />
      <button
        type="button"
        onClick={() => onChange(round(value + step))}
        className="flex size-9 items-center justify-center rounded-control border border-border bg-card text-foreground hover:border-[var(--coral-deep)]"
        aria-label="More"
      >
        <Plus className="size-4" />
      </button>
      <span className="ml-1 text-small text-foreground">{unit}</span>
    </div>
  );
}

/** Lavender panel — the tip boxes and selected rows in the mockups. */
export function SoftPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card bg-surface-muted p-3.5 ${className}`}>{children}</div>
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
      <span className={`inline-block size-5 rounded-full bg-background transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
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
