import { useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../context/AuthContext";
import { Project, dismissCheckIn, pauseProject } from "../lib/journal";
import { mirrorPursuit } from "../lib/pursuitsRemote";
import { QuickLog } from "./QuickLog";
import { EndingDialog } from "./EndingDialog";
import { plural } from "../lib/plural";

function quietFor(since: number): string {
  const days = Math.floor((Date.now() - since) / 86_400_000);
  if (days < 14) return plural(days, "day");
  const weeks = Math.round(days / 7);
  if (weeks < 8) return plural(weeks, "week");
  return plural(Math.round(days / 30), "month");
}

/**
 * The one reminder a Pursuit ever gets — and only on the cadence its maker
 * chose. Worded as a question, never a warning, and every answer is a good
 * one: a Moment, a rest, or an ending. "Not now" is allowed too; after two
 * of those in a row, Sushii simply stops asking (journal's checkInDue).
 */
export function CheckInCard({ pursuit, lastActivity }: { pursuit: Project; lastActivity: number }) {
  const { user } = useAuth();
  const [logging, setLogging] = useState(false);
  const [ending, setEnding] = useState(false);

  const mirror = (p: Project | undefined) => {
    if (user && p) void mirrorPursuit(user.id, p);
  };

  return (
    <div className="rounded-card border border-[var(--coral-deep)]/40 bg-card p-4">
      <p className="text-small">
        <Link to={`/pursuit/${pursuit.id}`} className="inline-flex min-h-11 items-center hover:text-accent" style={{ fontFamily: "var(--font-serif)" }}>
          {pursuit.title}
        </Link>{" "}
        <span className="text-muted-foreground">has been quiet for {quietFor(lastActivity)}. Where’s it at?</span>
      </p>

      {logging ? (
        <div className="mt-3">
          <QuickLog pursuit={pursuit} compact onDone={() => setLogging(false)} />
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2 text-caption">
          <button
            type="button"
            onClick={() => setLogging(true)}
            className="rounded-control border border-[var(--coral-deep)] px-3 py-1.5 text-foreground hover:bg-[color-mix(in_srgb,var(--coral)_14%,transparent)]"
          >
            Log a Moment
          </button>
          <button
            type="button"
            onClick={() => mirror(pauseProject(pursuit.id))}
            className="rounded-control border border-border px-3 py-1.5 text-foreground hover:border-[var(--coral-deep)]"
          >
            Pause
          </button>
          <button
            type="button"
            onClick={() => setEnding(true)}
            className="rounded-control border border-border px-3 py-1.5 text-foreground hover:border-[var(--coral-deep)]"
          >
            Finish
          </button>
          <button
            type="button"
            onClick={() => mirror(dismissCheckIn(pursuit.id))}
            className="px-2 py-1.5 text-muted-foreground hover:text-foreground"
          >
            Not now
          </button>
        </div>
      )}

      <EndingDialog open={ending} onOpenChange={setEnding} project={pursuit} />
    </div>
  );
}
