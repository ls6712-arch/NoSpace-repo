import { Link } from "react-router";
import { Sparkle } from "lucide-react";
import { Project, useJournalSlice, ProgressEntry } from "../lib/journal";
import { hasMeasure, summarize } from "../lib/pursuitProgress";
import { ProgressBar } from "./pursuit/ui";
import { track } from "../lib/analytics";

const NO_PROGRESS: ProgressEntry[] = [];

/**
 * One card in the horizontal-scroll "Pursuits in progress" strip: icon,
 * title, progress bar. A Pursuit with a measurable goal (Goal/Measure/Unit,
 * docs/glossary.md) shows real completion; one without a measure (a date or
 * feeling goal, or no goal at all) shows an empty bar rather than a made-up
 * percentage — there's nothing honest to fill it with.
 */
export function PursuitItem({ pursuit }: { pursuit: Project }) {
  const allProgress = useJournalSlice((s) => s.progress ?? NO_PROGRESS);
  const measured = hasMeasure(pursuit)
    ? summarize(pursuit.measure!, allProgress.filter((e) => e.projectId === pursuit.id))
    : undefined;
  const fraction = measured ? measured.fraction : 0;

  return (
    <Link
      to={`/pursuit/${pursuit.id}`}
      onClick={() => track({ name: "pursuits_in_progress_item_tapped", pursuitId: pursuit.id })}
      className="flex w-36 shrink-0 snap-start flex-col gap-2.5 rounded-2xl border border-border bg-card p-3.5 transition-colors hover:border-[var(--coral-deep)]"
    >
      <span
        className="flex size-8 items-center justify-center rounded-full"
        style={{
          backgroundColor: "color-mix(in srgb, var(--coral) 16%, var(--surface-muted))",
          color: "var(--coral-deep)",
        }}
      >
        <Sparkle className="size-4" strokeWidth={1.8} />
      </span>
      <span
        className="line-clamp-2 text-sm leading-snug text-foreground"
        style={{ fontFamily: "var(--font-serif)" }}
        title={pursuit.title}
      >
        {pursuit.title}
      </span>
      <ProgressBar fraction={fraction} thin className="mt-auto" />
    </Link>
  );
}
