import { Check } from "lucide-react";
import { AVAILABLE_FILTERS, FILTER_ROWS, type FilterKey, type Filters } from "../../lib/calendarView";
import { cn } from "../ui/utils";


/** The little square beside each row: the same look the thing has on the calendar. */
const SWATCH: Record<FilterKey, string> = {
  plans: "bg-[var(--cat-blue)]",
  sessions: "bg-[var(--cat-amber)]",
  picks: "border-[1.5px] border-dashed border-accent-text",
  // A 14px swatch needs a stronger edge and tint than the big block on the grid to read as the same thing.
  free: "border-2 border-dashed border-[color:color-mix(in_oklab,var(--foreground)_60%,transparent)] bg-[color-mix(in_oklab,var(--foreground)_12%,transparent)]",
  friends: "border border-border bg-card",
  stubs: "bg-[var(--cat-violet)]",
  blocks: "border border-[color:color-mix(in_oklab,var(--foreground)_55%,transparent)]",
  busy: "bg-muted",
};

/** The blocks hatch, tighter and darker so it shows at swatch size. */
const SWATCH_HATCH = { backgroundImage: "repeating-linear-gradient(135deg, color-mix(in oklab, var(--foreground) 55%, transparent) 0 1.5px, transparent 1.5px 4px)" } as const;

/** "Show": a checkbox for each kind of thing on the calendar. Only the kinds that exist today are listed. */
export function ShowPanel({ filters, onChange, className }: { filters: Filters; onChange: (key: FilterKey, on: boolean) => void; className?: string }) {
  const rows = FILTER_ROWS.filter((r) => AVAILABLE_FILTERS.includes(r.key));
  return (
    <section aria-labelledby="calendar-show-h" className={cn("flex flex-col gap-2 rounded-card border border-border bg-card p-4", className)}>
      <h2 id="calendar-show-h" className="text-lead">
        Show
      </h2>
      <ul className="flex flex-col">
        {rows.map((r) => (
          <li key={r.key}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-body">
              <input type="checkbox" checked={filters[r.key]} onChange={(e) => onChange(r.key, e.target.checked)} className="peer sr-only" />
              <span
                aria-hidden="true"
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-control border border-border bg-card text-background peer-checked:border-foreground peer-checked:bg-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
              >
                {filters[r.key] && <Check strokeWidth={1.75} className="size-3.5" />}
              </span>
              <span aria-hidden="true" style={r.key === "blocks" ? SWATCH_HATCH : undefined} className={cn("size-3.5 shrink-0 rounded-control", SWATCH[r.key])} />
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold">{r.label}</span>
                {r.hint && <span className="text-caption text-muted-foreground">{r.hint}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
