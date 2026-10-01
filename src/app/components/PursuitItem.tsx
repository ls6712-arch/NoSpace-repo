import { useState } from "react";
import { Link } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import { Plus, Sparkle, Target } from "lucide-react";
import { Project, useJournalSlice, ProgressEntry } from "../lib/journal";
import { hasMeasure, summarize } from "../lib/pursuitProgress";
import { PursuitMoment } from "../lib/pursuitTrail";
import { ProgressRing, PURSUIT_SPRING } from "./pursuit/ui";
import { PostMedia } from "./PostMedia";
import { GoalDialog } from "./GoalDialog";
import { track } from "../lib/analytics";

const NO_PROGRESS: ProgressEntry[] = [];

/**
 * One card in the "Pursuits in progress" grid: a real photo from this
 * Pursuit's own latest photo Moment on top (PostMedia already falls back to
 * a GeneratedArt scene on its own when there isn't one — never a stock
 * placeholder), a progress ring badge (the Pursuit's icon at its center)
 * overlapping the photo's bottom-left corner, the title, and a
 * plain-language progress line. A Pursuit with a measurable goal
 * (Goal/Measure/Unit, docs/glossary.md) shows its real completion as "3 of
 * 10 pieces" — never a bare percentage, same rule GoalDialog's own progress
 * carries ("Sushii doesn't scoreboard progress"). One without a measure
 * shows an empty ring and no progress line — there's nothing honest to
 * report.
 *
 * Hover lift, tap feedback, and the ring's own fill all animate through
 * motion/react (already used elsewhere in this app — Onboarding.tsx,
 * Log.tsx, TagsField.tsx, Studio.tsx), gated by useReducedMotion so none of
 * it runs for someone who's asked their OS not to.
 *
 * Two Links to the same Pursuit, not one: the photo and the title/progress
 * text are separate Link elements (same pattern PursuitCard.tsx already
 * uses), because the "+" and goal-edit buttons overlay the photo and can't
 * be nested inside a Link covering the same area — nested interactive
 * elements aren't valid HTML/React.
 */
export function PursuitItem({
  pursuit,
  moments,
  index = 0,
}: {
  pursuit: Project;
  /** This Pursuit's own Moments, oldest first — same shape PursuitTrack
   * already builds via collectPursuitMoments. Used only to find the latest
   * real photo to show; no fetch of its own. */
  moments: PursuitMoment[];
  index?: number;
}) {
  const reduceMotion = useReducedMotion();
  const allProgress = useJournalSlice((s) => s.progress ?? NO_PROGRESS);
  const measured = hasMeasure(pursuit)
    ? summarize(pursuit.measure!, allProgress.filter((e) => e.projectId === pursuit.id))
    : undefined;
  const fraction = measured ? measured.fraction : 0;
  const progressLabel = measured
    ? `${measured.current} of ${measured.target}${pursuit.measure!.unit ? ` ${pursuit.measure!.unit}` : ""}`
    : undefined;
  const latestImage = [...moments].reverse().find((m) => m.image)?.image;

  const [goalOpen, setGoalOpen] = useState(false);

  return (
    <motion.div
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_8px_20px_-16px_rgba(43,33,28,0.4)]"
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { ...PURSUIT_SPRING, delay: Math.min(index, 7) * 0.05 }}
      whileHover={reduceMotion ? undefined : { y: -4 }}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <Link
          to={`/pursuit/${pursuit.id}`}
          onClick={() => track({ name: "pursuits_in_progress_item_tapped", pursuitId: pursuit.id })}
          aria-label={`Open ${pursuit.title}`}
          className="absolute inset-0 block"
        >
          <PostMedia
            media={latestImage}
            type="photo"
            hobbySlug={pursuit.hobbySlug ?? "crafts-making"}
            seed={pursuit.id}
            preview
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        </Link>

        <button
          type="button"
          onClick={() => setGoalOpen(true)}
          aria-label={`Edit the goal for ${pursuit.title}`}
          className="absolute right-2.5 top-2.5 z-10 flex size-7 items-center justify-center rounded-full bg-[var(--void)]/55 text-white opacity-0 backdrop-blur-md transition-opacity duration-150 hover:bg-[var(--void)]/75 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--coral-deep)] group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <Target className="size-3.5" strokeWidth={1.9} />
        </button>

        <motion.div whileTap={reduceMotion ? undefined : { scale: 0.9 }} className="absolute bottom-2.5 right-2.5 z-10">
          <Link
            to={`/pursuit/${pursuit.id}/moment`}
            onClick={() => track({ name: "pursuits_in_progress_item_tapped", pursuitId: pursuit.id })}
            aria-label={`Log a Moment on ${pursuit.title}`}
            className="flex size-9 items-center justify-center rounded-full text-white shadow-[0_6px_14px_-4px_rgba(43,33,28,0.5)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--coral-deep)]"
            style={{ backgroundColor: "var(--coral-deep)" }}
          >
            <Plus className="size-4" strokeWidth={2.2} />
          </Link>
        </motion.div>
      </div>

      <Link to={`/pursuit/${pursuit.id}`} className="relative block px-3.5 pb-3.5 pt-6">
        <ProgressRing
          fraction={fraction}
          size={40}
          strokeWidth={3.5}
          className="absolute -top-5 left-3 rounded-full bg-card ring-4 ring-card"
        >
          <span
            className="flex size-6 items-center justify-center rounded-full"
            style={{
              backgroundColor: "color-mix(in srgb, var(--coral) 16%, var(--surface-muted))",
              color: "var(--coral-deep)",
            }}
          >
            <Sparkle className="size-3.5" strokeWidth={1.8} />
          </span>
        </ProgressRing>

        <span
          className="line-clamp-2 block text-sm leading-snug text-foreground"
          style={{ fontFamily: "var(--font-serif)" }}
          title={pursuit.title}
        >
          {pursuit.title}
        </span>
        {progressLabel && <span className="mt-0.5 block text-xs text-muted-foreground">{progressLabel}</span>}
      </Link>

      <GoalDialog open={goalOpen} onOpenChange={setGoalOpen} project={pursuit} />
    </motion.div>
  );
}
