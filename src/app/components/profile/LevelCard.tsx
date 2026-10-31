import { useState } from "react";
import { Check } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { LEVELS, getLevel } from "../../lib/levels";
import { plural } from "../../lib/plural";
import { cn } from "../ui/utils";

function Emblem({ index, dashed, size = "lg" }: { index: number; dashed?: boolean; size?: "sm" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-2 font-bold text-accent-text",
        "bg-[color-mix(in_srgb,var(--accent-text)_12%,transparent)] border-accent-text",
        dashed && "border-dashed bg-transparent",
        size === "lg" ? "size-14 text-lead" : "size-10 text-small",
      )}
    >
      {index}
    </span>
  );
}

/** The ticket-stub card on your own profile. */
export function LevelCard({ stubCount, stubsToNext }: { stubCount: number; stubsToNext: number | null }) {
  const [open, setOpen] = useState(false);
  const lvl = getLevel(stubCount);
  const prev = LEVELS[lvl.index - 2] ?? null;
  const fresh = stubCount === 0;
  const pct = Math.round(lvl.progress * 100);

  return (
    <section aria-label="Your level" className="relative rounded-card border border-border bg-card">
      <div className="flex items-start gap-4 p-4">
        <Emblem index={lvl.index} dashed={fresh} />
        <div className="min-w-0 flex-1">
          <p className="text-caption font-medium text-muted-foreground">Level {lvl.index} of 8</p>
          <h2 className="font-[family-name:var(--font-display)] text-lead font-bold">{lvl.name}</h2>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label={`Progress to ${lvl.next?.name ?? lvl.name}`}
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-muted"
          >
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-small text-muted-foreground">
            {fresh && lvl.next
              ? `Log 1 Moment to earn your first Stub and reach ${lvl.next.name}.`
              : lvl.next
                ? `${stubCount} of ${plural(lvl.next.stubs, "Stub")} · ${stubsToNext ?? lvl.stubsToNext} more to ${lvl.next.name}`
                : plural(stubCount, "Stub")}
          </p>
        </div>
      </div>

      <div className="relative" aria-hidden="true">
        <div className="mx-4 border-t-2 border-dashed border-border" />
        <span className="absolute -left-2 -top-2 size-4 rounded-full border border-border bg-background" />
        <span className="absolute -right-2 -top-2 size-4 rounded-full border border-border bg-background" />
      </div>

      <div className="flex items-center justify-between gap-2 px-4 py-3 text-caption">
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{prev ? prev.name : ""}</span>
        <span className="font-semibold text-foreground">You</span>
        <span className="min-w-0 flex-1 truncate text-right text-muted-foreground">{lvl.next ? lvl.next.name : ""}</span>
      </div>
      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 items-center text-small font-medium text-accent-text underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:outline-1"
        >
          All levels
        </button>
      </div>

      <BottomSheet open={open} onOpenChange={setOpen} title="All levels">
        <ol className="flex flex-col gap-2 pb-2">
          {LEVELS.map((l) => {
            const reached = l.index <= lvl.index;
            return (
              <li
                key={l.index}
                aria-current={l.index === lvl.index ? "step" : undefined}
                className={cn("flex items-center gap-3 rounded-control border border-border p-3", l.index === lvl.index && "bg-surface-muted")}
              >
                <Emblem index={l.index} dashed={!reached} size="sm" />
                <div className="flex-1">
                  <p className="text-small font-semibold">{l.name}</p>
                  <p className="text-caption text-muted-foreground">{plural(l.stubs, "Stub")}</p>
                </div>
                {reached && <Check className="size-4 text-foreground" aria-label="Reached" />}
              </li>
            );
          })}
        </ol>
      </BottomSheet>
    </section>
  );
}

/** Read-only card on someone else's profile: no progress to the next level. */
export function LevelCardCompact({ index, name, stubCount }: { index: number; name: string; stubCount: number }) {
  return (
    <section aria-label="Level" className="flex items-center gap-3 rounded-card border border-border bg-card p-4">
      <Emblem index={index} />
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-lead font-bold">{name}</h2>
        <p className="text-small text-muted-foreground">
          Level {index} of 8 · {plural(stubCount, "Stub")}
        </p>
      </div>
    </section>
  );
}
