import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Compass } from "lucide-react";
import { Post } from "../data/posts";
import { Project } from "../lib/journal";
import { activePursuits, collectPursuitMoments } from "../lib/pursuitTrail";
import { usePrivateLogs } from "../context/PrivateLogsContext";
import { signMomentPaths } from "../lib/momentMedia";
import { useAtScrollTop } from "../lib/useAtScrollTop";
import { scrollToElementId } from "../lib/scrollToElement";
import { ALL_PURSUITS_SECTION_ID } from "./AllPursuitsSection";
import { PURSUIT_SPRING } from "./pursuit/ui";
import { PursuitItem } from "./PursuitItem";
import { track } from "../lib/analytics";

/**
 * Home tab, above the Moments feed: a card grid of every ACTIVE Pursuit
 * (same "active" definition PursuitsRail uses — see lib/pursuitTrail's
 * activePursuits), each a PursuitItem card (its own latest photo Moment,
 * a progress ring, title), plus a "See all" tile that smooth-scrolls down
 * to AllPursuitsSection — the same In progress/Resting/Completed list
 * PursuitsRail's own "See all" scrolls to as well, rather than each
 * opening its own copy of that grouping in a dialog. Each card fades/rises
 * in on mount, staggered by index
 * (motion/react — PursuitItem itself owns the per-card animation and its
 * own useReducedMotion gate; this just hands it one).
 *
 * Fixed to the viewport's top (not in the page's normal flow at all), but
 * only ever visibly so for an instant: it slides/fades out (useAtScrollTop)
 * the moment the page moves away from the very top, and back in once
 * scrolled back to it. `top-16` (4rem) sits it exactly below Header, which
 * is a fixed h-16 everywhere (my-space.css's own opening comment); `z-40`,
 * one below Header's `z-50` (ns-site-header), so Header always wins if the
 * two ever do overlap. The inner wrapper mirrors .myspace-shell's own
 * horizontal padding/max-width (mx-auto max-w-[1600px]) so the bar lines up
 * with the page content under it rather than spanning edge-to-edge.
 *
 * Because `position: fixed` removes it from flow entirely, a second,
 * invisible element right after it — sized to the bar's own measured
 * height (ResizeObserver, same pattern PursuitTrack.tsx already uses) —
 * reserves that same space in the real page flow, and collapses to 0 in
 * sync with the fade-out so the feed slides up to fill the gap rather than
 * leaving a dead blank strip behind. aria-hidden + pointer-events-none +
 * inert on the bar while faded so it's neither announced nor
 * keyboard/tap-reachable while invisible.
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
  const reduceMotion = useReducedMotion();
  const atTop = useAtScrollTop();
  const barRef = useRef<HTMLElement>(null);
  const [barHeight, setBarHeight] = useState(0);
  // `inert` isn't in this React version's JSX attribute typings (@types/react
  // 18.3), so it's set as a real DOM property instead of a prop — it still
  // does its job either way: while faded out, nothing inside (the card
  // links, the "+" buttons, "See all") is keyboard-tabbable or hit-testable,
  // on top of the aria-hidden/pointer-events-none below.
  useEffect(() => {
    if (barRef.current) barRef.current.inert = !atTop;
  }, [atTop]);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    // el.offsetHeight (padding + border included), not entry.contentRect —
    // the latter is always the pure content box regardless of box-sizing,
    // which would under-measure by the bar's own vertical padding and leave
    // a sliver of feed content peeking out from under it.
    const ro = new ResizeObserver(() => setBarHeight(el.offsetHeight));
    ro.observe(el);
    setBarHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  const momentsFor = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof collectPursuitMoments>>();
    return (p: Project) => {
      if (!cache.has(p.id)) cache.set(p.id, collectPursuitMoments(p.id, posts, entryProject, logs));
      return cache.get(p.id)!;
    };
  }, [posts, entryProject, logs]);

  const active = activePursuits(pursuits, momentsFor);

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
    scrollToElementId(ALL_PURSUITS_SECTION_ID);
  };

  return (
    <>
      <section
        ref={barRef}
        className={`fixed inset-x-0 top-16 z-40 bg-surface pb-5 ${reduceMotion ? "" : "transition-[opacity,transform] duration-300 ease-out"} ${
          atTop ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0"
        }`}
        aria-hidden={!atTop}
      >
        {/* Mirrors .myspace-shell's own horizontal padding + the 1536px+
            max-width/auto-margin centering (my-space.css), so this fixed bar
            lines up with the page content under it instead of running
            edge-to-edge. */}
        <div className="mx-auto max-w-[1600px] px-4 pt-5 sm:px-5 lg:px-8">
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
                Nothing in progress right now{" "}
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
        </div>
      </section>

      {/* Reserves this bar's own measured height in the real page flow
          (position: fixed above took it out of flow entirely), collapsing
          to 0 in sync with the fade-out so the feed slides up to meet it
          rather than leaving a dead gap. */}
      <div
        aria-hidden="true"
        style={{ height: atTop ? barHeight : 0 }}
        className={reduceMotion ? "" : "transition-[height] duration-300 ease-out"}
      />
    </>
  );
}
