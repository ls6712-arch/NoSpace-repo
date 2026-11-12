import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { weekChips, weekLine, type WeekPlan, type WeekWindow } from "../../lib/homeWeek";
import { ADD_FREE_TIME_COPY } from "../../lib/homeCopy";

/**
 * "Your week": how many free windows are left, how many plans, and the next 3
 * days as chips. With no free time saved it asks for it and opens the screen
 * that saves it. Either way the whole card is one link.
 */
export function YourWeekCard({ windows, left, plans, now, compact = false }: { windows: readonly string[]; left: readonly WeekWindow[]; plans: readonly WeekPlan[]; now: number; compact?: boolean }) {
  const chips = weekChips(windows, plans, now);
  const none = windows.length === 0;
  // Home v3: one row, the way into the Calendar on phones. Same words, no day chips.
  if (compact)
    return (
      <Link to={none ? "/week/free" : "/calendar?view=week"} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-0.5 rounded-card border border-border bg-card px-4 py-3 text-foreground">
        <span className="text-body font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Your week
        </span>
        <span className="order-3 basis-full text-small text-muted-foreground tab:order-none tab:basis-auto tab:flex-1">{none ? ADD_FREE_TIME_COPY : weekLine(left.length, plans.length)}</span>
        <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-small font-semibold text-accent-text">
          Open
          <ChevronRight className="size-4" aria-hidden="true" />
        </span>
      </Link>
    );
  return (
    <Link to={none ? "/week/free" : "/calendar?view=week"} className="flex min-h-11 flex-col gap-3 rounded-card border border-border bg-card p-4 text-foreground">
      <span className="flex items-baseline justify-between">
        <span className="text-lead font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Your week
        </span>
        <span className="inline-flex items-center gap-0.5 text-small font-semibold text-accent-text">
          Open
          <ChevronRight className="size-4" aria-hidden="true" />
        </span>
      </span>
      {none ? (
        <span className="max-w-[600px] text-body text-muted-foreground">{ADD_FREE_TIME_COPY}</span>
      ) : (
        <>
          <span className="max-w-[600px] text-body text-muted-foreground">{weekLine(left.length, plans.length)}</span>
          {chips.length > 0 && (
            <ul className="grid max-w-[600px] gap-2" style={{ gridTemplateColumns: `repeat(${chips.length}, minmax(0, 1fr))` }}>
              {chips.map((c) => (
                <li
                  key={c.heading}
                  className={`flex min-w-0 flex-col gap-0.5 rounded-control p-2.5 ${c.plan ? "bg-foreground text-background" : "border-[1.5px] border-dashed border-border"}`}
                >
                  <span className="text-caption font-semibold">{c.heading}</span>
                  <span className={`text-caption ${c.plan ? "opacity-80" : "text-muted-foreground"}`}>{c.line}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Link>
  );
}
