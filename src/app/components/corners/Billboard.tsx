import { useCallback, useEffect, useRef, useState } from "react";
import { ImageWithFallback } from "../ImageWithFallback";
import { PressLink } from "../afterhours/PressLink";
import { cornerAbout, cornerMeta, type CuratedCorner } from "../../data/curatedCorners";
import { cornerPhoto, cornerPhotoAlt } from "../../lib/cornerPhoto";
import { formatStarts } from "../../lib/dates";
import { displayStyle } from "../../lib/doorList";
import type { LiveEvent } from "../../lib/cornersLive";
import { usePrefersReducedMotion } from "../../lib/useReducedMotion";

export interface BillboardSlide {
  corner: CuratedCorner;
  next?: LiveEvent;
  logTo: string;
}

const ADVANCE_MS = 7000;

/**
 * The billboard at the top of /corners: a few Corners, one full-width photo
 * each (the page colour fades in from the left and bottom, so the title sits on
 * dark), that you swipe or step through with the dots. Scroll-snap does the sliding. It
 * advances itself every 7 seconds, but never while a pointer is over it, focus
 * is inside it, the tab is hidden, or the person asked for reduced motion.
 */
export function Billboard({ slides }: { slides: BillboardSlide[] }) {
  const list = useRef<HTMLUListElement | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = usePrefersReducedMotion();

  const go = useCallback(
    (i: number) => {
      const node = list.current;
      if (!node) return;
      node.scrollTo({ left: i * node.clientWidth, behavior: reduced ? "auto" : "smooth" });
    },
    [reduced],
  );

  const onScroll = () => {
    const node = list.current;
    if (node && node.clientWidth > 0) setIndex(Math.round(node.scrollLeft / node.clientWidth));
  };

  useEffect(() => {
    if (reduced || paused || slides.length < 2) return;
    const t = window.setInterval(() => {
      if (document.hidden) return;
      go((index + 1) % slides.length);
    }, ADVANCE_MS);
    return () => window.clearInterval(t);
  }, [reduced, paused, slides.length, index, go]);

  if (slides.length === 0) return null;
  return (
    <section
      className="relative h-[72svh] min-h-[22.5rem] max-h-[820px] w-full overflow-hidden bg-surface-muted text-on-media"
      aria-roledescription="carousel"
      aria-label="Featured Corners"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <ul ref={list} onScroll={onScroll} className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {slides.map(({ corner, next, logTo }, i) => {
          const about = cornerAbout(corner.spaceSlug, corner.slug);
          return (
            <li
              key={corner.slug}
              className="relative h-full w-full shrink-0 snap-start"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${slides.length}`}
              aria-hidden={i !== index || undefined}
              // @ts-expect-error inert is not in this React version's types
              inert={i !== index ? "" : undefined}
            >
              <ImageWithFallback
                src={cornerPhoto(corner.spaceSlug, corner.slug, 1600)}
                alt={cornerPhotoAlt(corner.slug)}
                priority={i === 0}
                width={1200}
                tint
                className="absolute inset-0 size-full"
              />
              <div className="bg-scrim pointer-events-none absolute inset-0" aria-hidden="true" />
              <div className="bg-hero-fade pointer-events-none absolute inset-0" aria-hidden="true" />
              <div className="absolute inset-0 mx-auto flex w-full max-w-[1264px] flex-col items-start justify-end gap-3 px-4 pb-28 tab:px-8 tab:pb-24">
                {i === 0 && <p className="text-small font-semibold text-on-media/90">Corner of the week</p>}
                <h2 className="max-w-2xl text-display" style={displayStyle(72, { lineHeight: 0.95 })}>
                  {corner.name}
                </h2>
                <p className="text-body text-on-media/90">{cornerMeta(corner)}</p>
                {about && <p className="max-w-lg text-lead text-on-media/90 max-tab:hidden">{about}</p>}
                {next && (
                  <p className="text-small font-semibold text-on-media">
                    {next.title}
                    <span className="font-normal text-on-media/90">{` · ${formatStarts(next.startsAt, { timeZone: next.timezone })}`}</span>
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-3">
                  <PressLink
                    to={`/corners/${corner.slug}`}
                    className="inline-flex min-h-12 items-center justify-center rounded-control bg-on-media px-6 text-body font-semibold text-[var(--ink)]"
                  >
                    {`Explore ${corner.name}`}
                  </PressLink>
                  <PressLink
                    to={logTo}
                    className="inline-flex min-h-12 items-center justify-center rounded-control bg-scrim-solid/50 px-6 text-body font-semibold text-on-media"
                  >
                    Log a Moment
                  </PressLink>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {slides.length > 1 && (
        <div className="absolute inset-x-0 bottom-10 flex justify-center tab:inset-x-auto tab:bottom-12 tab:right-8">
          {slides.map((s, i) => (
            <button
              key={s.corner.slug}
              type="button"
              onClick={() => go(i)}
              aria-label={`Show ${s.corner.name}`}
              aria-current={i === index}
              className="group inline-flex size-11 items-center justify-center"
            >
              <span className={`h-1.5 rounded-full bg-on-media transition-all duration-base ${i === index ? "w-6 opacity-100" : "w-1.5 opacity-60 group-hover:opacity-90"}`} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
