import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Compass } from "lucide-react";
import { Post } from "../data/posts";
import { Project, pursuitStatus } from "../lib/journal";
import { activePursuits, collectPursuitMoments } from "../lib/pursuitTrail";
import { usePrivateLogs } from "../context/PrivateLogsContext";
import { useScrollReveal } from "../lib/useScrollReveal";
import { PursuitItem } from "./PursuitItem";
import { AllPursuitsDialog } from "./AllPursuitsDialog";
import { track } from "../lib/analytics";

/**
 * Home tab, above the Moments feed: a card grid of every ACTIVE Pursuit
 * (same "active" definition PursuitsRail uses — see lib/pursuitTrail's
 * activePursuits), each a PursuitItem card, plus a "See all" tile that
 * opens the same grouped All-your-Pursuits dialog PursuitsRail's own "See
 * all" already uses (AllPursuitsDialog) — one dialog, two entry points,
 * rather than a second screen that duplicates the same In progress/
 * Resting/Completed grouping. Fades in, staggered per card, the first time
 * it scrolls into view (useScrollReveal, same mechanism Home.tsx's own
 * sections use) — switched off under prefers-reduced-motion in theme.css.
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
  const revealRef = useScrollReveal<HTMLDivElement>();

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
        <div className="mt-3 flex flex-col items-center gap-3 rounded-card border border-dashed border-border px-5 py-10 text-center">
          <span
            className="flex size-11 items-center justify-center rounded-full"
            style={{
              backgroundColor: "color-mix(in srgb, var(--coral) 14%, var(--surface-muted))",
              color: "var(--coral-deep)",
            }}
            aria-hidden="true"
          >
            <Compass className="size-5" strokeWidth={1.7} />
          </span>
          <p className="text-sm text-muted-foreground">
            Nothing in progress right now.{" "}
            <Link to="/pursuits/new" className="text-accent hover:underline">
              Start a Pursuit
            </Link>
            .
          </p>
        </div>
      ) : (
        <div
          ref={revealRef}
          className="ns-reveal-grid mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
          role="list"
          aria-label="Pursuits in progress"
        >
          {active.map((p, i) => (
            <PursuitItem key={p.id} pursuit={p} index={i} />
          ))}
          <button
            type="button"
            onClick={openSeeAll}
            style={{ transitionDelay: `${Math.min(active.length, 7) * 45}ms` }}
            className="flex min-h-[9.5rem] flex-col items-center justify-center gap-1.5 rounded-card border border-dashed border-border text-xs text-muted-foreground transition-colors hover:border-[var(--coral-deep)] hover:text-foreground"
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
