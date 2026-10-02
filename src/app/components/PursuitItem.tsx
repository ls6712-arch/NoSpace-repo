import { useState } from "react";
import { Link } from "react-router";
import { Plus, Sparkle, Target } from "lucide-react";
import { Project, useJournalSlice, ProgressEntry } from "../lib/journal";
import { hasMeasure, summarize } from "../lib/pursuitProgress";
import { ProgressRing } from "./pursuit/ui";
import { GoalDialog } from "./GoalDialog";
import { track } from "../lib/analytics";

const NO_PROGRESS: ProgressEntry[] = [];

/**
 * One card in the "Pursuits in progress" grid: a ring (the Pursuit's icon
 * at its center, doubling as the progress indicator) over the title and a
 * plain-language progress line. A Pursuit with a measurable goal
 * (Goal/Measure/Unit, docs/glossary.md) shows its real completion as "3 of
 * 10 pieces" — never a bare percentage, same rule GoalDialog's own progress
 * carries ("Sushii doesn't scoreboard progress"). One without a measure
 * shows an empty ring and no progress line — there's nothing honest to
 * report.
 *
 * Two actions live on the card itself, both siblings of the title Link
 * (never nested inside it — a Link inside a Link isn't valid): a prominent
 * "+" to log a Moment against this Pursuit directly, and a goal-edit icon
 * that's always in the DOM (just low-opacity) rather than display:none, so
 * it's reachable by keyboard focus and a screen reader even though it only
 * visibly appears on hover for a mouse user.
 */
export function PursuitItem({ pursuit, index = 0 }: { pursuit: Project; index?: number }) {
  const allProgress = useJournalSlice((s) => s.progress ?? NO_PROGRESS);
  const measured = hasMeasure(pursuit)
    ? summarize(pursuit.measure!, allProgress.filter((e) => e.projectId === pursuit.id))
    : undefined;
  const fraction = measured ? measured.fraction : 0;
  const progressLabel = measured
    ? `${measured.current} of ${measured.target}${pursuit.measure!.unit ? ` ${pursuit.measure!.unit}` : ""}`
    : undefined;

  const [goalOpen, setGoalOpen] = useState(false);

  return (
    <div
      className="group relative flex flex-col gap-3 rounded-card border border-border bg-card p-4 shadow-card transition-[border-color,transform,box-shadow] duration-fast hover:-translate-y-0.5 hover:border-[var(--coral-deep)] hover:shadow-overlay"
      style={{ transitionDelay: `${Math.min(index, 7) * 45}ms` }}
    >
      <button
        type="button"
        onClick={() => setGoalOpen(true)}
        aria-label={`Edit the goal for ${pursuit.title}`}
        className="absolute right-3 top-3 z-10 flex size-7 items-center justify-center rounded-control border border-border bg-card text-muted-foreground opacity-0 transition-opacity duration-fast hover:text-foreground focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--coral-deep)] group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <Target className="size-3.5" strokeWidth={1.8} />
      </button>

      <Link
        to={`/pursuit/${pursuit.id}`}
        onClick={() => track({ name: "pursuits_in_progress_item_tapped", pursuitId: pursuit.id })}
        className="flex flex-col items-start gap-3"
      >
        <ProgressRing fraction={fraction} size={48}>
          <span
            className="flex size-8 items-center justify-center rounded-full"
            style={{
              backgroundColor: "color-mix(in srgb, var(--coral) 16%, var(--surface-muted))",
              color: "var(--coral-deep)",
            }}
          >
            <Sparkle className="size-4" strokeWidth={1.8} />
          </span>
        </ProgressRing>
        <span className="min-w-0">
          <span
            className="line-clamp-2 block text-small leading-snug text-foreground"
            style={{ fontFamily: "var(--font-serif)" }}
            title={pursuit.title}
          >
            {pursuit.title}
          </span>
          {progressLabel && <span className="mt-0.5 block text-caption text-muted-foreground">{progressLabel}</span>}
        </span>
      </Link>

      <Link
        to={`/pursuit/${pursuit.id}/moment`}
        onClick={(e) => {
          e.stopPropagation();
          track({ name: "pursuits_in_progress_item_tapped", pursuitId: pursuit.id });
        }}
        aria-label={`Log a Moment on ${pursuit.title}`}
        className="mt-auto flex size-8 items-center justify-center self-end rounded-control text-on-brand transition-transform duration-fast hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--coral-deep)]"
        style={{ backgroundColor: "var(--coral-deep)" }}
      >
        <Plus className="size-4" strokeWidth={2.2} />
      </Link>

      <GoalDialog open={goalOpen} onOpenChange={setGoalOpen} project={pursuit} />
    </div>
  );
}
