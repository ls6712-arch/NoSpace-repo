import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Compass } from "lucide-react";
import { Post } from "../data/posts";
import { Project } from "../lib/journal";
import { activePursuits, collectPursuitMoments } from "../lib/pursuitTrail";
import { usePrivateLogs } from "../context/PrivateLogsContext";
import { signMomentPaths } from "../lib/momentMedia";
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
 * Sits in the page's normal flow, right below the greeting header (and
 * DayTwoInviteCard) — it used to be `position: fixed` to the viewport's
 * top, sliding in/out as the page scrolled past it. That pinned it at a
 * fixed viewport coordinate regardless of where it actually was in the
 * document, so at the top of the page it visually overlapped the greeting
 * content that comes before it in the DOM, and its flow-reserving spacer
 * (sized to match) showed up as a blank gap between them. A plain in-flow
 * section has no second scroll surface to coordinate and nothing to
 * overlap — the window was already the only scroll source on this page
 * (my-space.css's own comments), so this isn't losing anything that was
 * doing real work.
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
    <section className="mb-6">
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
    </section>
  );
}
