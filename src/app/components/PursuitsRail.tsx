import { useMemo, useState } from "react";
import { Post } from "../data/posts";
import { Project, checkInDue } from "../lib/journal";
import { activePursuits, collectPursuitMoments, lastActivityAt } from "../lib/pursuitTrail";
import { usePrivateLogs } from "../context/PrivateLogsContext";
import { scrollToElementId } from "../lib/scrollToElement";
import { ALL_PURSUITS_SECTION_ID } from "./AllPursuitsSection";
import { PursuitTrack } from "./PursuitTrack";
import { CheckInCard } from "./CheckInCard";
import { PursuitDialog } from "./PursuitDialog";
import { PursuitInvitesCard } from "./pursuit/PursuitProgressPanel";


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
  // Every active Pursuit. A cap of 5 quietly hid the sixth — usually the
  // newest, since it has no Moments to sort it up.
  const shown = active.filter((p) => !due.includes(p));

  return (
    <section>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lead" style={{ fontFamily: "var(--font-serif)" }}>
          Pursuits still moving
        </h2>
        <button type="button" onClick={() => setStarting(true)} className="text-caption text-accent hover:underline">
          Start one
        </button>
      </div>
      <div className="mt-3">
        <PursuitInvitesCard />
      </div>

      {pursuits.length === 0 ? (
        <p className="mt-4 text-small text-muted-foreground">
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
              <p className="mt-3 text-small text-muted-foreground">
                Everything’s resting or finished. Pick one back up, or start something new.
              </p>
            )
          )}
          <button
            type="button"
            onClick={() => scrollToElementId(ALL_PURSUITS_SECTION_ID)}
            className="mt-2 text-caption text-accent hover:underline"
          >
            See all my Pursuits ({pursuits.length})
          </button>
        </>
      )}

      <PursuitDialog open={starting} onOpenChange={setStarting} />
    </section>
  );
}
