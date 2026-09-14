import { useEffect, useRef } from "react";
import { Plus, Undo2 } from "lucide-react";
import { Goal, Project, logProgress, undoLastProgress, useJournalSlice } from "../lib/journal";
import { mirrorPursuit } from "../lib/pursuitsRemote";
import { useAuth } from "../context/AuthContext";

const HOLD_START_DELAY_MS = 450;
const HOLD_REPEAT_MS = 220;

// A stable reference for "no history yet" — `?? []` inline would allocate a
// new array on every read, and useSyncExternalStore treats a new reference
// as a changed snapshot on every render, looping forever ("Maximum update
// depth exceeded").
const NO_HISTORY: number[] = [];

/**
 * The tap-to-log interaction, in full: one tap logs +1 immediately — no
 * screen, no form, no confirmation. Press-and-hold repeats it. An undo icon
 * sits alongside for the one mistake this needs to recover from (a mis-tap
 * or a hold that ran one too many), rather than making someone retype the
 * number by hand.
 *
 * This is the whole premise of the feature: the apps that get logged
 * consistently are the ones where the tap is the log, not a form behind a
 * button — so this never opens anything, and never shares a screen with the
 * existing free-text/photo "Add progress" flow, which stays a separate,
 * optional action.
 */
export function GoalProgressTap({ project, goal }: { project: Project; goal: Goal }) {
  const { user } = useAuth();
  const history = useJournalSlice((s) => s.progressHistory[project.id] ?? NO_HISTORY);
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopHold = () => {
    if (startTimer.current) clearTimeout(startTimer.current);
    if (repeatTimer.current) clearInterval(repeatTimer.current);
    startTimer.current = null;
    repeatTimer.current = null;
  };
  useEffect(() => stopHold, []);

  const atTarget = goal.targetNumber != null && (goal.current ?? 0) >= goal.targetNumber;

  const tap = () => {
    if (atTarget) return;
    const updated = logProgress(project.id, 1);
    if (updated && user) void mirrorPursuit(user.id, updated);
  };

  const startHold = () => {
    // The first tap already fired from onClick — holding only starts
    // repeating after a real pause, so an ordinary tap never double-logs.
    startTimer.current = setTimeout(() => {
      repeatTimer.current = setInterval(tap, HOLD_REPEAT_MS);
    }, HOLD_START_DELAY_MS);
  };

  const undo = () => {
    const updated = undoLastProgress(project.id);
    if (updated && user) void mirrorPursuit(user.id, updated);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={tap}
        onPointerDown={startHold}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        disabled={atTarget}
        aria-label={`Log one${goal.unit ? ` ${goal.unit.replace(/s$/, "")}` : ""}`}
        className="flex items-center gap-1.5 rounded-full border border-[var(--coral-deep)]/50 bg-[color-mix(in_srgb,var(--coral)_14%,var(--surface-elevated))] px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-[var(--coral-deep)] disabled:cursor-default disabled:opacity-50"
      >
        <Plus className="size-3.5" strokeWidth={2} />
        +1
      </button>
      {history.length > 0 && (
        <button
          type="button"
          onClick={undo}
          aria-label="Undo last log"
          title="Undo last log"
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          <Undo2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}
