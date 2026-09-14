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
 * screen, no form, no confirmation. The button reads the goal's own verb
 * ("Finished one," or whatever was typed in GoalDialog) rather than a bare
 * "+1," so it reads like the thing you actually did. Press-and-hold repeats
 * it. An undo icon
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
export function GoalProgressTap({
  project,
  goal,
  fullWidth = false,
}: {
  project: Project;
  goal: Goal;
  /** The larger, full-width treatment for a standalone goal card (the
   * /pursuit/:id page, PursuitCard). Left off for tighter contexts like the
   * expanded panel's own Goals list row, where a giant button would crowd
   * everything else in the row. */
  fullWidth?: boolean;
}) {
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

  const verb = goal.verb?.trim() || "Finished one";

  return (
    <div className={`flex items-center gap-2 ${fullWidth ? "w-full" : ""}`}>
      <button
        type="button"
        onClick={tap}
        onPointerDown={startHold}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        disabled={atTarget}
        className={`flex items-center justify-center gap-1.5 rounded-full border border-[var(--coral-deep)]/50 bg-[color-mix(in_srgb,var(--coral)_14%,var(--surface-elevated))] font-medium text-foreground transition-colors hover:border-[var(--coral-deep)] disabled:cursor-default disabled:opacity-50 ${
          fullWidth ? "flex-1 py-3.5 text-base" : "px-3.5 py-1.5 text-sm"
        }`}
      >
        <Plus className={fullWidth ? "size-4" : "size-3.5"} strokeWidth={2} />
        {verb}
      </button>
      {history.length > 0 && (
        <button
          type="button"
          onClick={undo}
          aria-label="Undo last log"
          title="Undo last log"
          className={`flex shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground ${
            fullWidth ? "size-12" : "size-8"
          }`}
        >
          <Undo2 className={fullWidth ? "size-4" : "size-3.5"} />
        </button>
      )}
    </div>
  );
}
