import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { Post } from "../data/posts";
import { Project, pursuitStatus } from "../lib/journal";
import { activePursuits, collectPursuitMoments } from "../lib/pursuitTrail";
import { usePrivateLogs } from "../context/PrivateLogsContext";
import { PursuitItem } from "./PursuitItem";
import { AllPursuitsDialog } from "./AllPursuitsDialog";
import { track } from "../lib/analytics";

/**
 * Home tab, above the Moments feed: a horizontal-scroll strip of every
 * ACTIVE Pursuit (same "active" definition PursuitsRail uses — see
 * lib/pursuitTrail's activePursuits), each a PursuitItem card, ending in a
 * "See all" tile that opens the same grouped All-your-Pursuits dialog
 * PursuitsRail's own "See all" already uses (AllPursuitsDialog) — one
 * dialog, two entry points, rather than a second screen that duplicates
 * the same In progress/Resting/Completed grouping.
 */
export function PursuitsInProgressSection({
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

  const momentsFor = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof collectPursuitMoments>>();
    return (p: Project) => {
      if (!cache.has(p.id)) cache.set(p.id, collectPursuitMoments(p.id, posts, entryProject, logs));
      return cache.get(p.id)!;
    };
  }, [posts, entryProject, logs]);

  const active = activePursuits(pursuits, momentsFor);
  const resting = pursuits.filter((p) => pursuitStatus(p) === "resting");
  const complete = pursuits.filter((p) => pursuitStatus(p) === "complete");
  const lastMomentOf = (p: Project) => {
    const m = momentsFor(p);
    return m.length ? m[m.length - 1].createdAt : undefined;
  };

  // Impression, once per mount — fired with whatever the count is by the
  // time this first renders, not re-fired on every later recompute.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    track({ name: "pursuits_in_progress_viewed", count: active.length });
  }, []);

  const openSeeAll = () => {
    track({ name: "pursuits_in_progress_see_all_tapped", count: pursuits.length });
    setSeeAll(true);
  };

  return (
    <section className="mb-8">
      <h2 className="text-lg" style={{ fontFamily: "var(--font-serif)" }}>
        Pursuits in progress
      </h2>

      {active.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing in progress right now.{" "}
          <Link to="/pursuits/new" className="text-accent hover:underline">
            Start a Pursuit
          </Link>
          .
        </p>
      ) : (
        <div
          className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
          role="list"
          aria-label="Pursuits in progress"
        >
          {active.map((p) => (
            <PursuitItem key={p.id} pursuit={p} />
          ))}
          <button
            type="button"
            onClick={openSeeAll}
            className="flex w-28 shrink-0 snap-start flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border text-xs text-muted-foreground transition-colors hover:border-[var(--coral-deep)] hover:text-foreground"
          >
            <ArrowRight className="size-4" />
            See all
          </button>
        </div>
      )}

      <AllPursuitsDialog
        open={seeAll}
        onOpenChange={setSeeAll}
        active={active}
        resting={resting}
        complete={complete}
        lastOf={lastMomentOf}
      />
    </section>
  );
}
