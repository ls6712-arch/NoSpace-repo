import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { WORLD_SPACES } from "../data/worldSpaces";
import { WorldIllustration } from "./WorldIllustration";
import { useScrollReveal } from "../lib/useScrollReveal";

const IDLE_CLASSES = ["ns-breathe", "ns-sway", "ns-drift"];

/**
 * Drives the Worlds track horizontally off the page's own vertical scroll,
 * the same "tall section + sticky inner + measured translateX" technique
 * used without a library — same two-part guard as Home.tsx's
 * useHeroParallax (a wide viewport AND no prefers-reduced-motion), so a
 * narrow screen or a reduced-motion preference gets the plain native
 * horizontal scroller CSS falls back to instead (see .ns-worlds-section in
 * theme.css), never a half-attached scroll listener.
 */
function useWorldsScroll() {
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [driven, setDriven] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    const sticky = stickyRef.current;
    const track = trackRef.current;
    if (!section || !sticky || !track) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia("(min-width: 1024px)");
    let frame = 0;

    const apply = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const scrollable = section.offsetHeight - window.innerHeight;
      const progress = scrollable > 0 ? Math.min(Math.max(-rect.top / scrollable, 0), 1) : 0;
      // The track itself can't shrink below the width its rigid,
      // non-shrinking cards need, so track.clientWidth reports that full
      // natural width — not the viewport window it's actually being clipped
      // to. sticky.clientWidth is that window (it's the element with
      // overflow: hidden), so it's what "visible width" has to mean here.
      const maxTranslate = Math.max(0, track.scrollWidth - sticky.clientWidth);
      track.style.transform = `translate3d(${-progress * maxTranslate}px, 0, 0)`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const sync = () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      const isDriven = wide.matches && !reduce.matches;
      setDriven(isDriven);
      if (isDriven) {
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        apply();
      } else {
        track.style.transform = "";
      }
    };

    sync();
    reduce.addEventListener("change", sync);
    wide.addEventListener("change", sync);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      reduce.removeEventListener("change", sync);
      wide.removeEventListener("change", sync);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return { sectionRef, stickyRef, trackRef, driven };
}

export function WorldsSection() {
  const { sectionRef, stickyRef, trackRef, driven } = useWorldsScroll();
  const headingRef = useScrollReveal<HTMLDivElement>();

  return (
    <section ref={sectionRef} className="ns-worlds-section" data-driven={driven}>
      <div className="mx-auto w-full max-w-[1440px] px-5 pt-20 sm:px-8 lg:px-12 lg:pt-28 xl:px-16">
        <div ref={headingRef} className="ns-reveal mb-10 max-w-xl lg:mb-14">
          <div className="ns-section-kicker mb-4">WHATEVER PULLS YOU IN</div>
          <h2 className="mb-3 text-3xl md:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
            Whatever pulls you in, it belongs here.
          </h2>
          <p className="text-[1.05rem] leading-relaxed text-muted-foreground">
            There are many ways to be a person. You don't have to choose just
            one — whatever genuinely pulls you in has a place to live.
          </p>
        </div>
      </div>

      <div ref={stickyRef} className="ns-worlds-sticky">
        {driven && (
          <svg className="ns-worlds-path" viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true">
            <path d="M -40 165 Q 150 90, 350 175 T 650 130 T 1040 190" />
          </svg>
        )}
        <div ref={trackRef} className="ns-worlds-track">
          {WORLD_SPACES.map((world, i) => {
            // A baseline vertical offset per card lives on this wrapper, not
            // on .ns-world-card itself — an inline `transform` always beats
            // a stylesheet rule for the same element/property, which would
            // have silently cancelled the CSS hover lift below.
            const cardStyle = { "--world-accent": world.accent } as CSSProperties;
            return (
              <div
                key={world.slug}
                style={{ transform: `translateY(${i % 2 === 0 ? "-0.6rem" : "0.7rem"})` }}
              >
                <Link to={world.to} className="ns-world-card block no-underline" style={cardStyle}>
                  <div className="aspect-[4/5] w-full">
                    <WorldIllustration
                      illustration={world.illustration}
                      seed={world.slug}
                      className="h-full w-full"
                      idleClassName={IDLE_CLASSES[i % IDLE_CLASSES.length]}
                      idleDelay={i * 1.3}
                    />
                  </div>
                  <div className="ns-world-card-label">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="ns-world-card-dot" aria-hidden="true" />
                      <span className="text-lg" style={{ fontFamily: "var(--font-serif)" }}>
                        {world.name}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{world.description}</p>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
