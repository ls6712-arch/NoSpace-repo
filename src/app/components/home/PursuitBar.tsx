import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { useJournal, pursuitStatus, type Project } from "../../lib/journal";
import { fetchNextSession, type PursuitSession } from "../../lib/openPursuits";
import { formatDateTime } from "../../lib/dates";

/** The Pursuit you are working on now: its title, "2 of 5", the next session, and a way in. */
export function PursuitBar() {
  const { user } = useAuth();
  const journal = useJournal();
  const active = journal.projects
    .filter((p: Project) => pursuitStatus(p) === "active" && p.measure && p.measure.target > 0)
    .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))[0];
  const [session, setSession] = useState<PursuitSession | null>(null);

  useEffect(() => {
    setSession(null);
    if (!active) return;
    let cancelled = false;
    void fetchNextSession(active.id).then((s) => !cancelled && setSession(s));
    return () => {
      cancelled = true;
    };
  }, [active?.id]);

  if (!active || !active.measure) return null;
  const done = (journal.progress ?? []).filter((e) => e.projectId === active.id && (e.userId ?? user?.id) === user?.id).length;
  const total = active.measure.target;
  const together = (active.members ?? []).some((m) => m.status === "joined" && m.userId !== user?.id);
  const next = session ? `${formatDateTime(session.startsAt)}${together ? " with the group" : ""}` : together ? "With your group" : "Your next one is open";

  return (
    <Link
      to={`/pursuit/${active.id}`}
      className="mb-4 flex min-h-14 items-center justify-between gap-3 rounded-card border border-border bg-card px-4 py-3"
    >
      <span className="min-w-0">
        <span className="block truncate text-body font-semibold">{`${active.title.slice(0, 40)} · ${Math.min(done, total)} of ${total}`}</span>
        <span className="block truncate text-small text-muted-foreground">{next}</span>
      </span>
      <span className="shrink-0 text-body font-semibold text-accent-text">Open</span>
    </Link>
  );
}
