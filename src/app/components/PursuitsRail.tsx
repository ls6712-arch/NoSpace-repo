import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { Post } from "../data/posts";
import { getHobby } from "../data/hobbies";
import { Project, checkInDue, pursuitStatus } from "../lib/journal";
import { activePursuits, collectPursuitMoments, lastActivityAt, startedLabel } from "../lib/pursuitTrail";
import { usePrivateLogs } from "../context/PrivateLogsContext";
import { PursuitTrack } from "./PursuitTrack";
import { CheckInCard } from "./CheckInCard";
import { PursuitDialog } from "./PursuitDialog";
import { PursuitInvitesCard } from "./pursuit/PursuitProgressPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

const RAIL_LIMIT = 5;

/**
 * Right rail, item 2 — your own Pursuits, and My Space's home for them.
 *
 * Shows every ACTIVE Pursuit, including one started a minute ago with no
 * Moments. It used to show only Pursuits with a Moment in the last 60 days,
 * so a brand-new Pursuit never appeared here at all.
 *
 * Any Pursuit due a check-in (on the cadence its maker chose) shows its
 * check-in first, above the list.
 */
export function PursuitsRail({
  pursuits,
  posts,
  entryProject,
}: {
  pursuits: Project[];
  posts: Post[];
  entryProject: Record<string, string>;
}) {
  const { logs } = usePrivateLogs();
  const [seeAll, setSeeAll] = useState(false);
  const [starting, setStarting] = useState(false);

  const momentsFor = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof collectPursuitMoments>>();
    return (p: Project) => {
      if (!cache.has(p.id)) cache.set(p.id, collectPursuitMoments(p.id, posts, entryProject, logs));
      return cache.get(p.id)!;
    };
  }, [posts, entryProject, logs]);

  const active = activePursuits(pursuits, momentsFor);
  const lastMomentOf = (p: Project) => {
    const m = momentsFor(p);
    return m.length ? m[m.length - 1].createdAt : undefined;
  };
  const due = active.filter((p) => checkInDue(p, lastMomentOf(p))).slice(0, 2);
  const shown = active.filter((p) => !due.includes(p)).slice(0, RAIL_LIMIT);
  const resting = pursuits.filter((p) => pursuitStatus(p) === "resting");
  const complete = pursuits.filter((p) => pursuitStatus(p) === "complete");

  return (
    <section>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg" style={{ fontFamily: "var(--font-serif)" }}>
          Pursuits still moving
        </h2>
        <button type="button" onClick={() => setStarting(true)} className="text-xs text-accent hover:underline">
          Start one
        </button>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">The ones you haven't set down yet.</p>
      <div className="mt-3">
        <PursuitInvitesCard />
      </div>

      {pursuits.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No Pursuits yet.{" "}
          <button type="button" onClick={() => setStarting(true)} className="text-accent hover:underline">
            Start your first
          </button>
          .
        </p>
      ) : (
        <>
          {due.length > 0 && (
            <div className="mt-3 space-y-2">
              {due.map((p) => (
                <CheckInCard key={p.id} pursuit={p} lastActivity={lastActivityAt(p, momentsFor(p))} />
              ))}
            </div>
          )}
          {shown.length > 0 ? (
            <div className="mt-2 divide-y divide-border">
              {shown.map((p) => (
                <PursuitTrack
                  key={p.id}
                  pursuit={p}
                  posts={posts}
                  entryProject={entryProject}
                  lastActivity={lastMomentOf(p)}
                />
              ))}
            </div>
          ) : (
            due.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                Everything's resting or finished. Pick one back up, or start something new.
              </p>
            )
          )}
          <button type="button" onClick={() => setSeeAll(true)} className="mt-2 text-xs text-accent hover:underline">
            See all my Pursuits ({pursuits.length})
          </button>
        </>
      )}

      <Dialog open={seeAll} onOpenChange={setSeeAll}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader className="text-left">
            <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>All your Pursuits</DialogTitle>
          </DialogHeader>
          <AllPursuitsGroup title="Moving" items={active} lastOf={lastMomentOf} onNavigate={() => setSeeAll(false)} />
          <AllPursuitsGroup title="Resting" items={resting} lastOf={lastMomentOf} onNavigate={() => setSeeAll(false)} />
          <AllPursuitsGroup title="Complete" items={complete} lastOf={lastMomentOf} onNavigate={() => setSeeAll(false)} />
        </DialogContent>
      </Dialog>

      <PursuitDialog open={starting} onOpenChange={setStarting} />
    </section>
  );
}

function relative(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30.44);
  return `${months} ${months === 1 ? "month" : "months"} ago`;
}

/**
 * One section of the All your Pursuits list. Every row is a real link to
 * the Pursuit, in full-strength text — the old list set nearly everything
 * in muted type, which read as disabled — plus its own "Add" to log a
 * Moment without opening the Pursuit first.
 */
function AllPursuitsGroup({
  title,
  items,
  lastOf,
  onNavigate,
}: {
  title: string;
  items: Project[];
  lastOf: (p: Project) => number | undefined;
  onNavigate: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="ns-section-kicker mb-1 text-muted-foreground">
        {title} · {items.length}
      </p>
      <ul className="divide-y divide-border">
        {items.map((p) => {
          const last = lastOf(p);
          const space = p.hobbySlug ? getHobby(p.hobbySlug)?.shortName : p.customSpace || p.interest;
          return (
            <li key={p.id} className="flex items-center gap-3 py-2.5">
              <Link to={`/pursuit/${p.id}`} onClick={onNavigate} className="group min-w-0 flex-1">
                <span
                  className="block truncate text-base text-foreground group-hover:text-accent"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {p.title}
                </span>
                <span className="block truncate text-xs text-foreground/80">
                  {[space, startedLabel(p.startedAt), last ? `last Moment ${relative(last)}` : "no Moments yet"]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </Link>
              <Link
                to={`/pursuit/${p.id}/moment`}
                onClick={onNavigate}
                aria-label={`Add a Moment to ${p.title}`}
                className="flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-foreground hover:border-[var(--coral-deep)]"
              >
                <Plus className="size-3" /> Add
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
