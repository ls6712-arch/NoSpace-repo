import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Check, Plus, Share2, Target } from "lucide-react";
import { getHobby } from "../data/hobbies";
import { Post } from "../data/posts";
import {
  Project,
  goalDeadlineText,
  goalProgressText,
  markGoalReached,
  projectProgress,
  setProjectShared,
} from "../lib/journal";
import { mirrorPursuit } from "../lib/pursuitsRemote";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { GoalDialog } from "./GoalDialog";
import { EndingDialog } from "./EndingDialog";
import { GoalProgressTap } from "./GoalProgressTap";
import { WorkGrid } from "./WorkGrid";
import { formatAmount, hasMeasure, summarize } from "../lib/pursuitProgress";
import { ProgressEntry, useJournalSlice } from "../lib/journal";

const NO_PROGRESS: ProgressEntry[] = [];

const SIZE = 44;

const R = 18;
const C = 2 * Math.PI * R;

/** Progress ring with the count in the middle — "4/10". */
function CountBadge({ current, target }: { current: number; target: number }) {
  const f = target > 0 ? Math.min(1, current / target) : 0;
  const short = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n * 10) / 10));
  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--border)" strokeWidth="3" />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="var(--coral)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - f)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-foreground">
        {short(current)}/{short(target)}
      </span>
    </div>
  );
}

/** No numeric goal yet — a plain placeholder ring rather than reserving the
 * coral stroke for a percentage that doesn't exist. */
function EmptyRing() {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground"
      style={{ width: SIZE, height: SIZE }}
    >
      <Target className="size-4" strokeWidth={1.6} />
    </div>
  );
}

/**
 * A Pursuit, shrunk to a scannable tile: ring, Corner/Space label, title,
 * progress. Tapping it doesn't navigate — it expands the panel below the
 * grid in place, so the compact grid is a menu of what to look at, not a
 * set of links.
 */
export function PursuitCompactCard({
  pursuit,
  entryProject,
  posts,
  expanded,
  onToggle,
}: {
  pursuit: Project;
  entryProject: Record<string, string>;
  posts: Post[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const { count } = projectProgress(entryProject, posts, pursuit.id);
  const space = pursuit.hobbySlug ? getHobby(pursuit.hobbySlug) : undefined;
  const spaceLabel = space?.shortName ?? pursuit.customSpace;
  // Corner first — a Pursuit's own Corner (free-text, same field the
  // creation dialog's "Which Corner does this belong to?" writes to) is
  // more specific than its parent Space, so it's what should label the
  // tile whenever one was actually given. Falls back to Space rather than
  // leaving the tile unlabeled when no Corner was set.
  const label = pursuit.interest || spaceLabel;
  const goal = pursuit.goal;
  // Tap-to-log (GoalProgressTap) is what actually moves a number goal's
  // current now — count (attached Updates) stays a separate, honest signal
  // of narrative activity, not a second, silently-disagreeing progress number.
  const allProgress = useJournalSlice((s) => s.progress ?? NO_PROGRESS);
  const measured = hasMeasure(pursuit)
    ? summarize(pursuit.measure!, allProgress.filter((e) => e.projectId === pursuit.id))
    : undefined;
  const hasCount = !measured && goal?.shape === "number" && !!goal.targetNumber;
  const status = pursuit.finishedAt ? "Completed" : pursuit.pausedAt ? "Resting" : count > 0 ? "In progress" : "Just started";
  const progressText = measured
    ? `${formatAmount(measured.current)} of ${formatAmount(measured.target)} ${pursuit.measure!.unit} · ${measured.percent}%`
    : goal?.shape === "number"
      ? goalProgressText(goal)
      : goal?.label;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={`flex min-h-11 items-center gap-2.5 rounded-2xl border bg-card p-3 text-left transition-colors ${
        expanded ? "border-[var(--coral-deep)]" : "border-border hover:border-[var(--coral-deep)]"
      }`}
    >
      {measured ? (
        <CountBadge current={measured.current} target={measured.target} />
      ) : hasCount ? (
        <CountBadge current={goal!.current ?? 0} target={goal!.targetNumber!} />
      ) : (
        <EmptyRing />
      )}
      <span className="min-w-0 flex-1">
        {label && (
          <span className="block truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
        )}
        <span className="block truncate text-sm leading-tight" style={{ fontFamily: "var(--font-serif)" }}>
          {pursuit.title}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">{progressText ?? status}</span>
      </span>
    </button>
  );
}

/** The dashed "start another one" tile, sized to match the compact cards
 * around it rather than standing out as a different shape. */
export function NewPursuitTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border p-3 text-muted-foreground transition-colors hover:border-[var(--coral-deep)] hover:text-foreground"
    >
      <Plus className="size-4" strokeWidth={1.8} />
      <span className="text-xs">New pursuit</span>
    </button>
  );
}

/**
 * What a compact card expands into: every goal (the active one plus
 * whatever was replaced, not a second concurrently-active goal — a Pursuit
 * only ever has one of those at a time, see journal.ts) and every Moment
 * actually attached to this Pursuit, reusing WorkGrid rather than a
 * one-off photo grid.
 */
export function PursuitExpandedPanel({
  pursuit,
  entryProject,
  posts,
  onOpenPost,
}: {
  pursuit: Project;
  entryProject: Record<string, string>;
  posts: Post[];
  onOpenPost: (post: Post) => void;
}) {
  const { user, profile } = useAuth();
  const [goalOpen, setGoalOpen] = useState(false);
  const [endingOpen, setEndingOpen] = useState(false);
  const [justCopied, setJustCopied] = useState(false);

  const space = pursuit.hobbySlug ? getHobby(pursuit.hobbySlug) : undefined;
  const spaceLabel = space?.shortName ?? pursuit.customSpace;
  const goal = pursuit.goal;
  const pastGoals = pursuit.pastGoals ?? [];
  const attached = posts
    .filter((p) => p.pursuitId === pursuit.id || entryProject[String(p.id)] === pursuit.id)
    .sort((a, b) => b.createdAt - a.createdAt);

  const toggleShare = async () => {
    const next = !pursuit.shared;
    setProjectShared(pursuit.id, next);
    if (user) void mirrorPursuit(user.id, { ...pursuit, shared: next });
    if (next) {
      const url = profile?.username
        ? `${window.location.origin}${window.location.pathname}#/u/${profile.username}`
        : window.location.href;
      try {
        await navigator.clipboard.writeText(url);
        setJustCopied(true);
        setTimeout(() => setJustCopied(false), 2000);
      } catch {
        // Clipboard can be unavailable — the Pursuit is shared either way.
      }
    }
  };

  // Completing goes through the ending question, same as the Pursuit page.
  const markDone = () => setEndingOpen(true);

  const reachIt = () => markGoalReached(pursuit.id);

  return (
    <div className="mt-3 rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {(pursuit.interest || spaceLabel) && (
            <p className="text-xs text-muted-foreground">
              {[pursuit.interest, spaceLabel].filter(Boolean).join(" · ")}
            </p>
          )}
          <h3 className="truncate text-lg" style={{ fontFamily: "var(--font-serif)" }}>
            {pursuit.title}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/pursuit/${pursuit.id}/moment`}>
            <Button variant="coral" size="sm">
              Add a Moment
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => setGoalOpen(true)}>
            <Target className="size-3.5" />
            {goal ? "Change goal" : "Set a goal"}
          </Button>
          {goal && !goal.reachedAt && (
            <Button variant="outline" size="sm" onClick={reachIt}>
              Reached it
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={toggleShare} aria-pressed={!!pursuit.shared}>
            {justCopied ? (
              "Link copied!"
            ) : pursuit.shared ? (
              <>
                <Share2 className="size-3.5" />
                Make private
              </>
            ) : (
              <>
                <Share2 className="size-3.5" />
                Share
              </>
            )}
          </Button>
          {!pursuit.finishedAt && (
            <Button variant="outline" size="sm" onClick={markDone}>
              <Check className="size-3.5" />
              Mark complete
            </Button>
          )}
        </div>
      </div>

      <div className="mb-5 border-t border-border pt-4">
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Goals</h4>
        {!goal && pastGoals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No goal set yet.</p>
        ) : (
          <ul className="space-y-2">
            {goal && (
              <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2.5 text-sm">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className={goal.reachedAt ? "line-through decoration-1" : ""}>
                    {goal.shape === "number" ? goalProgressText(goal) : goal.label}
                  </span>
                  {goal.shape === "number" && goalDeadlineText(goal) && (
                    <span className="text-xs text-muted-foreground">{goalDeadlineText(goal)}</span>
                  )}
                </span>
                {/* A number goal not yet reached gets the tap-to-log control
                    in place of the plain "Current" label — logging a count
                    and writing a narrative update stay two separate actions,
                    so this sits alongside "Add a Moment" above, not instead
                    of it. */}
                {goal.shape === "number" && !goal.reachedAt ? (
                  <GoalProgressTap project={pursuit} goal={goal} />
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {goal.reachedAt ? "Reached" : "Current"}
                  </span>
                )}
              </li>
            )}
            {pastGoals.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2.5 text-sm text-muted-foreground"
              >
                <span>{g.label}</span>
                <span className="shrink-0 text-xs">{g.reachedAt ? "Reached" : "Replaced"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Moments under this Pursuit
        </h4>
        <WorkGrid posts={attached} onOpen={onOpenPost} emptyLabel="Nothing logged under this Pursuit yet." />
      </div>

      <GoalDialog open={goalOpen} onOpenChange={setGoalOpen} project={pursuit} />
      <EndingDialog open={endingOpen} onOpenChange={setEndingOpen} project={pursuit} />
    </div>
  );
}
