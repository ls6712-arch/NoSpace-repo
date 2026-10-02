import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Link } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Compass } from "lucide-react";
import { Post } from "../data/posts";
import { Project, pursuitStatus } from "../lib/journal";
import { activePursuits, collectPursuitMoments } from "../lib/pursuitTrail";
import { usePrivateLogs } from "../context/PrivateLogsContext";
import { signMomentPaths } from "../lib/momentMedia";
import { useAtScrollTop } from "../lib/useAtScrollTop";
import { PURSUIT_SPRING } from "./pursuit/ui";
import { PursuitItem } from "./PursuitItem";
import { AllPursuitsDialog } from "./AllPursuitsDialog";
import { track } from "../lib/analytics";

/**
 * Home tab, above the Moments feed: a card grid of every ACTIVE Pursuit
 * (same "active" definition PursuitsRail uses — see lib/pursuitTrail's
 * activePursuits), each a PursuitItem card (its own latest photo Moment,
 * a progress ring, title), plus a "See all" tile that opens the same
 * grouped All-your-Pursuits dialog PursuitsRail's own "See all" already
 * uses (AllPursuitsDialog) — one dialog, two entry points, rather than a
 * second screen that duplicates the same In progress/Resting/Completed
 * grouping. Each card fades/rises in on mount, staggered by index
 * (motion/react — PursuitItem itself owns the per-card animation and its
 * own useReducedMotion gate; this just hands it one).
 *
 * Sticky at the top of the feed, but only ever visibly so for an instant:
 * it fades/lifts out (useAtScrollTop) the moment the page moves away from
 * the very top, and fades back in once scrolled back to it — so by the time
 * `position: sticky` would actually pin it against Header's own sticky bar,
 * it has already faded away. `z-40`, one below Header's `z-50`
 * (ns-site-header), so Header always wins if the two ever do overlap.
 * aria-hidden + pointer-events-none while faded so it's neither announced
 * nor tappable while invisible.
 *
 * `feedScrollRef` is MySpaceGrid's own ref to `.myspace-feed` — below lg
 * that element doesn't scroll on its own (my-space.css: the whole page
 * does), but at lg and up it becomes the actual scrolling region while the
 * window itself barely moves, so useAtScrollTop needs that ref to watch the
 * right thing at each breakpoint. Optional only so this component still
 * renders (minus the hide-on-scroll behavior) if ever used somewhere
 * without that layout.
 */
export function PursuitsInProgressSection({
  pursuits,
  posts,
  entryProject,
  feedScrollRef,
}: {
  pursuits: Project[];
  posts: Post[];
  entryProject: Record<string, string>;
  feedScrollRef?: RefObject<HTMLElement | null>;
}) {
  const { logs } = usePrivateLogs();
  const [seeAll, setSeeAll] = useState(false);
  const reduceMotion = useReducedMotion();
  const atTop = useAtScrollTop(feedScrollRef);
  const sectionRef = useRef<HTMLElement>(null);
  // `inert` isn't in this React version's JSX attribute typings (@types/react
  // 18.3), so it's set as a real DOM property instead of a prop — it still
  // does its job either way: while faded out, nothing inside (the card
  // links, the "+" buttons, "See all") is keyboard-tabbable or hit-testable,
  // on top of the aria-hidden/pointer-events-none below.
  useEffect(() => {
    if (sectionRef.current) sectionRef.current.inert = !atTop;
  }, [atTop]);

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

  // One batched signMomentPaths call for every custom cover on this page,
  // same convention ContentContext's own post-media signing already
  // follows — never one signing round trip per card. Keyed off a joined
  // string, not the `active` array itself: `active` is a fresh array every
  // render (activePursuits() isn't memoized), so depending on it directly
  // re-ran this effect — and re-set state — on every render, forever.
  const [coverUrls, setCoverUrls] = useState<Map<string, string>>(new Map());
  const coverPathsKey = active.map((p) => p.coverImagePath ?? "").join("|");
  const coverPaths = useMemo(
    () => [...new Set(active.map((p) => p.coverImagePath).filter((p): p is string => !!p))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coverPathsKey],
  );
  useEffect(() => {
    let cancelled = false;
    if (coverPaths.length === 0) {
      setCoverUrls((prev) => (prev.size === 0 ? prev : new Map()));
      return;
    }
    void signMomentPaths(coverPaths).then((signed) => {
      if (!cancelled) setCoverUrls(signed);
    });
    return () => {
      cancelled = true;
    };
  }, [coverPaths]);

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
    <section
      ref={sectionRef}
      className={`sticky top-0 z-40 mb-8 bg-surface ${reduceMotion ? "" : "transition-[opacity,transform] duration-300 ease-out"} ${
        atTop ? "opacity-100" : "pointer-events-none -translate-y-3 opacity-0"
      }`}
      aria-hidden={!atTop}
    >
      <h2 className="text-lg" style={{ fontFamily: "var(--font-serif)" }}>
        Pursuits in progress
      </h2>

      {active.length === 0 ? (
        <div className="mt-3 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-5 py-10 text-center">
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
          className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
          role="list"
          aria-label="Pursuits in progress"
        >
          {active.map((p, i) => (
            <PursuitItem
              key={p.id}
              pursuit={p}
              moments={momentsFor(p)}
              index={i}
              coverUrl={p.coverImagePath ? coverUrls.get(p.coverImagePath) : undefined}
            />
          ))}
          <motion.button
            type="button"
            onClick={openSeeAll}
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { ...PURSUIT_SPRING, delay: Math.min(active.length, 7) * 0.05 }}
            whileHover={reduceMotion ? undefined : { y: -4 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            className="flex min-h-[9.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border text-xs text-muted-foreground transition-colors hover:border-[var(--coral-deep)] hover:text-foreground"
          >
            <ArrowRight className="size-4" />
            See all
          </motion.button>
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
