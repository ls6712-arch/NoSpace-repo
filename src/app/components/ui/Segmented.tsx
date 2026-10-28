import { useId, useRef, type KeyboardEvent } from "react";
import { motion } from "motion/react";
import { cn } from "./utils";
import { shared } from "../../lib/motionTokens";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/**
 * A segmented control (who with, audience, You tabs). The selected segment's
 * pill is one element that slides between segments through a shared
 * `layoutId` (the `shared` spring). Radio-group semantics: arrow keys move
 * the selection.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group. */
  label: string;
  className?: string;
}) {
  const id = useId();
  const group = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + dir + options.length) % options.length];
    onChange(next.value);
    group.current?.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus();
  };

  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("flex w-full rounded-full bg-[var(--surface-raised,var(--card))] p-1", className)}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            data-value={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative min-h-11 flex-1 rounded-full px-3 text-small font-semibold outline-none transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-ring",
              selected ? "text-accent-foreground" : "text-muted-foreground",
            )}
          >
            {selected && <motion.span layoutId={`seg-${id}`} transition={shared} className="absolute inset-0 rounded-full bg-accent" />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
