import { useState } from "react";
import { Link } from "react-router";
import { CalendarClock, Plus } from "lucide-react";
import { Project, sessionsThisWeek, setPursuitPlan } from "../../lib/journal";
import { mirrorPursuitPlan } from "../../lib/pursuitsRemote";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { formatDate, formatTime } from "../../lib/dates";

/**
 * Step 5a · the first thing on an active Pursuit you're part of: when your
 * next session is, an optional note for it, and "[N] of [M] this week" once
 * you've set Times a week. "Done when: every Pursuit page opens with a next
 * step."
 *
 * The plan is this person's own (journal + the owner-only pursuit_plans
 * table). In a shared Pursuit, everyone sees only their own.
 */
const TIMES_A_WEEK = [1, 2, 3, 4, 5, 6, 7];

function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sessionLabel(ms: number): string {
  return `${formatDate(ms, { weekday: "short" })} · ${formatTime(ms)}`;
}

export function NextSessionCard({
  project,
  myMomentTimes,
}: {
  project: Project;
  /** When this person's own Moments on this Pursuit were added. */
  myMomentTimes: number[];
}) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [times, setTimes] = useState<string>("");

  const startEdit = () => {
    setWhen(project.nextSessionAt ? toLocalInput(project.nextSessionAt) : "");
    setNote(project.nextSessionNote ?? "");
    setTimes(project.timesPerWeek ? String(project.timesPerWeek) : "");
    setEditing(true);
  };

  const save = (next: { nextSessionAt?: number; nextSessionNote?: string; timesPerWeek?: number }) => {
    const updated = setPursuitPlan(project.id, next);
    if (user && updated) void mirrorPursuitPlan(user.id, updated);
    setEditing(false);
  };

  const submit = () => {
    const at = when ? new Date(when).getTime() : undefined;
    save({
      nextSessionAt: at && !Number.isNaN(at) ? at : undefined,
      nextSessionNote: note,
      timesPerWeek: times ? Number(times) : undefined,
    });
  };

  const thisWeek = project.timesPerWeek ? sessionsThisWeek(myMomentTimes) : undefined;

  return (
    <section aria-labelledby="next-session-title" className="mb-6 rounded-card border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="next-session-title"
          className="flex items-center gap-2 text-lead"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
          Next session
        </h2>
        {thisWeek !== undefined && project.timesPerWeek && (
          <span className="text-small text-muted-foreground tabular-nums">
            {thisWeek} of {project.timesPerWeek} this week
          </span>
        )}
      </div>

      {!editing ? (
        <>
          {project.nextSessionAt ? (
            <div className="mt-2">
              <p className="text-body">{sessionLabel(project.nextSessionAt)}</p>
              {project.nextSessionNote && (
                <p className="mt-0.5 text-small text-muted-foreground">{project.nextSessionNote}</p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-small text-muted-foreground">Not set yet.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to={`/create?pursuit=${project.id}`}>
              <Button variant="coral" size="sm">
                <Plus className="size-3.5" />
                Log a Moment
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={startEdit}>
              {project.nextSessionAt || project.timesPerWeek ? "Change" : "Set"}
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-3 space-y-3">
          <div>
            <Label htmlFor="next-session-when" className="mb-1.5 block text-caption">
              When
            </Label>
            <Input id="next-session-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="next-session-note" className="mb-1.5 block text-caption">
              Note <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="next-session-note"
              value={note}
              maxLength={140}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="next-session-times" className="mb-1.5 block text-caption">
              Times a week <span className="text-muted-foreground">(optional)</span>
            </Label>
            <select
              id="next-session-times"
              value={times}
              onChange={(e) => setTimes(e.target.value)}
              className="h-9 w-full rounded-control border border-input bg-background px-3 text-body"
            >
              <option value="">Not set</option>
              {TIMES_A_WEEK.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="coral" size="sm" onClick={submit}>
              Save
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
