import { useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../context/AuthContext";
import { Project, dismissCheckIn, pauseProject } from "../lib/journal";
import { mirrorPursuit } from "../lib/pursuitsRemote";
import { QuickLog } from "./QuickLog";
import { EndingDialog } from "./EndingDialog";

function quietFor(since: number): string {
  const days = Math.floor((Date.now() - since) / 86_400_000);
  if (days < 14) return `${days} days`;
  const weeks = Math.round(days / 7);
  if (weeks < 8) return `${weeks} weeks`;
  return `${Math.round(days / 30)} months`;
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
    <div className="rounded-2xl border border-[var(--coral-deep)]/40 bg-card p-4">
      <p className="text-sm">
        <Link to={`/pursuit/${pursuit.id}`} className="hover:text-accent" style={{ fontFamily: "var(--font-serif)" }}>
          {pursuit.title}
        </Link>{" "}
        <span className="text-muted-foreground">has been quiet for {quietFor(lastActivity)}. Where's it at?</span>
      </p>

      {logging ? (
        <div className="mt-3">
          <QuickLog pursuit={pursuit} compact onDone={() => setLogging(false)} />
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() => setLogging(true)}
            className="rounded-full border border-[var(--coral-deep)] px-3 py-1.5 text-foreground hover:bg-[color-mix(in_srgb,var(--coral)_14%,transparent)]"
          >
            Log a Moment
          </button>
          <button
            type="button"
            onClick={() => mirror(pauseProject(pursuit.id))}
            className="rounded-full border border-border px-3 py-1.5 text-foreground hover:border-[var(--coral-deep)]"
          >
            Pausing for now
          </button>
          <button
            type="button"
            onClick={() => setEnding(true)}
            className="rounded-full border border-border px-3 py-1.5 text-foreground hover:border-[var(--coral-deep)]"
          >
            Done with this
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
