import { useCallback, useEffect, useRef, useState } from "react";
import { ImageWithFallback } from "../ImageWithFallback";
import { PressLink } from "../afterhours/PressLink";
import { cornerMeta, type CuratedCorner } from "../../data/curatedCorners";
import { cornerGuide } from "../../data/cornerGuides";
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
 * The billboard at the top of /corners: a few Corners, one photo each, that you
 * swipe or step through with the dots. Scroll-snap does the sliding. It
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
      className="relative mb-5 overflow-hidden rounded-card bg-surface-muted text-on-media"
      aria-roledescription="carousel"
      aria-label="Featured Corners"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <ul ref={list} onScroll={onScroll} className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {slides.map(({ corner, next, logTo }, i) => {
          const about = cornerGuide(corner.spaceSlug, corner.slug)?.about;
          return (
            <li
              key={corner.slug}
              className="relative aspect-[4/5] w-full shrink-0 snap-start md:aspect-[21/9]"
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
              <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-2 p-5 pb-14 md:p-8 md:pb-12">
                {i === 0 && <p className="text-small font-semibold text-on-media/90">Corner of the week</p>}
                <h2 className="text-display" style={displayStyle(40, { lineHeight: 1.05 })}>
                  {corner.name}
                </h2>
                <p className="text-body text-on-media/90">{cornerMeta(corner)}</p>
                {about && <p className="max-w-xl text-body text-on-media/90 max-md:hidden">{about}</p>}
                {next && (
                  <p className="text-small font-semibold text-on-media">
                    {next.title}
                    <span className="font-normal text-on-media/90">{` · ${formatStarts(next.startsAt, { timeZone: next.timezone })}`}</span>
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-3">
                  <PressLink
                    to={`/corners/${corner.slug}`}
                    className="inline-flex min-h-12 items-center justify-center rounded-control bg-[var(--accent)] px-6 text-body font-semibold text-[var(--accent-foreground)]"
                  >
                    {`Explore ${corner.name}`}
                  </PressLink>
                  <PressLink
                    to={logTo}
                    className="inline-flex min-h-12 items-center justify-center rounded-control border border-on-media/70 px-6 text-body font-semibold text-on-media"
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
        <div className="absolute inset-x-0 bottom-0 flex justify-center md:inset-x-auto md:right-6">
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
