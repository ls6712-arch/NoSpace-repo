import { useEffect, useRef, type MouseEvent } from "react";
import { Link } from "react-router";
import { Camera, LayoutGrid, Share2 } from "lucide-react";
import { WorldsSection } from "../components/WorldsSection";
import { Button } from "../components/ui/button";
import { useScrollReveal } from "../lib/useScrollReveal";
import { useAuth } from "../context/AuthContext";
import { WaitlistForm } from "../components/WaitlistForm";
import { ImageWithFallback } from "../components/ImageWithFallback";
import heroSooshImg from "../../assets/hero-soosh.webp";
import heroSoosh1000Img from "../../assets/hero-soosh-1000.webp";
import { APP_NAME, landingShowsSpaces } from "../config";
import { scrollBehavior } from "../lib/scrollToElement";

/**
 * Desktop-only parallax on the hero collage: it drifts up a little more
 * slowly than the page, which is what stops the hero from reading as a flat
 * banner. Off below 1024px (nothing to parallax against on a phone) and off
 * under prefers-reduced-motion, both watched live rather than sampled once.
 */
function useHeroParallax() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia("(min-width: 1024px)");
    let frame = 0;

    const apply = () => {
      frame = 0;
      const y = Math.min(window.scrollY, 700);
      // A gentle scale alongside the drift — barely perceptible (maxes out
      // 1.5% larger), just enough that the collage reads as sitting forward
      // of the page rather than pasted flat onto it.
      const scale = 1 + Math.min(y, 500) * 0.00003;
      el.style.transform = `translate3d(0, ${y * -0.055}px, 0) scale(${scale})`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const sync = () => {
      window.removeEventListener("scroll", onScroll);
      if (wide.matches && !reduce.matches) {
        window.addEventListener("scroll", onScroll, { passive: true });
        apply();
      } else {
        el.style.transform = "";
      }
    };

    sync();
    reduce.addEventListener("change", sync);
    wide.addEventListener("change", sync);
    return () => {
      window.removeEventListener("scroll", onScroll);
      reduce.removeEventListener("change", sync);
      wide.removeEventListener("change", sync);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return ref;
}

// Optional real screenshot of a Pursuit on a Shelf. import.meta.glob finds the
// file only if it exists, so adding it is a file drop and nothing else.
const pursuitShots = import.meta.glob("../../assets/landing-pursuit.webp", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;
const pursuitShot = Object.values(pursuitShots)[0];

const HOW_IT_WORKS = [
  { icon: Camera, title: "Post a Moment", copy: "A photo, a video or a link." },
  { icon: LayoutGrid, title: "It goes on your Shelf", copy: "Every Moment is added to your Shelf, grouped by Corner." },
  { icon: Share2, title: "Share your Shelf anywhere", copy: "Send anyone your public link. Only members can follow and react." },
];

export function Home() {
  const heroRef = useHeroParallax();
  // Invite-only sign-up: a signed-out visitor gets the waitlist form instead
  // of a sign-up button. Anyone signed in (Root.tsx already routes a pending
  // account to /welcome before this page renders) gets a link into the
  // composer instead.
  const { user } = useAuth();
  const signedOut = !user;

  const howRef = useScrollReveal<HTMLElement>();
  const pursuitsRef = useScrollReveal<HTMLElement>();
  const friendsRef = useScrollReveal<HTMLElement>();
  const finalCtaRef = useScrollReveal<HTMLElement>();

  const scrollToWaitlist = (e: MouseEvent) => {
    // A plain href="#waitlist" would set location.hash, which the HashRouter
    // reads as a navigation to a route that doesn't exist. Scroll manually.
    e.preventDefault();
    document.getElementById("waitlist")?.scrollIntoView({ behavior: scrollBehavior() });
  };

  return (
    <div className="min-h-viewport">
      {/* 1. Hero */}
      <section className="ns-home-hero relative isolate overflow-hidden">
        <div className="mx-auto w-full max-w-[1200px] px-5 pb-12 pt-12 text-center sm:px-8 sm:pt-16 lg:pb-16 lg:pt-20">
          <h1
            className="ns-enter ns-enter-1 mb-5 text-hero font-semibold leading-[.98] tracking-[-0.035em] text-balance text-foreground"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Everything you do outside work, in one place.
          </h1>

          <p className="ns-enter ns-enter-2 mx-auto mb-8 max-w-xl text-body leading-relaxed text-foreground/90 sm:text-lead">
            {APP_NAME} is a portfolio for what you make, learn and do. Post it as it happens, share your Shelf, see what your friends are up to.
          </p>

          <div className="ns-enter ns-enter-3 flex flex-wrap items-center justify-center gap-2.5">
            {!signedOut && (
              <Link to="/create">
                <Button variant="coral" size="lg">
                  Log a Moment
                </Button>
              </Link>
            )}
            {signedOut && (
              <>
                <a href="#waitlist" onClick={scrollToWaitlist}>
                  <Button variant="coral" size="lg">
                    Request an invite
                  </Button>
                </a>
                <Link to="/login" className="ns-hero-secondary-link">
                  I have an invite
                </Link>
              </>
            )}
          </div>
          <p className="ns-enter ns-enter-3 mt-4 text-small text-foreground/70">
            {APP_NAME} is for people 16 and older.
          </p>
        </div>

        {/* TODO(landing page 3b): the spec wants a real, full Shelf screenshot
            here showing range (bread, a GitHub project, a race, film
            photos). None exists yet, so the existing illustration stays
            until one is supplied. */}
        <div className="mx-auto w-full max-w-[1440px] px-5 pb-12 sm:px-8 lg:px-12 lg:pb-20 xl:px-16">
          <div ref={heroRef} className="ns-parallax ns-enter ns-enter-4 will-change-transform -mx-5 sm:mx-0">
            {/* design-token-ignore: bundled hero art with srcSet, which ImageWithFallback does not take */}
            <img
              src={heroSooshImg}
              srcSet={`${heroSoosh1000Img} 1000w, ${heroSooshImg} 1942w`}
              sizes="100vw"
              width={1942}
              height={809}
              loading="eager"
              alt="Friends writing, playing guitar, painting, knitting, reading, coding and hiking on and around giant colorful letters spelling SOOSH at sunset, with the New York skyline behind them."
              className="ns-hero-worlds-art aspect-[1942/809] w-full sm:rounded-card"
            />
          </div>
        </div>

        <svg className="-mb-px block w-full" viewBox="0 0 1440 96" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 96V52c214-32 430-44 648-34 106 5 210 17 312 26 168 15 328 12 480-10v62Z" fill="var(--surface)" />
        </svg>
      </section>

      <div className="bg-surface">
        {/* 2. How it works */}
        <section id="how" ref={howRef} className="ns-reveal pb-4 pt-12 lg:pb-8 lg:pt-16">
          <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 xl:px-16">
            <h2 className="mb-8 text-center text-display" style={{ fontFamily: "var(--font-serif)" }}>
              How it works
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {HOW_IT_WORKS.map(({ icon: Icon, title, copy }) => (
                <div key={title} className="ns-value-card rounded-card p-6">
                  <span className="ns-value-card-icon mb-5 flex size-11 items-center justify-center rounded-full bg-surface-muted">
                    <Icon className="size-5 text-foreground" strokeWidth={1.7} />
                  </span>
                  <div className="mb-2 text-title" style={{ fontFamily: "var(--font-serif)" }}>{title}</div>
                  <p className="text-small leading-relaxed text-muted-foreground">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Corners */}
        <WorldsSection />

        {/* 4. Pursuits */}
        <section ref={pursuitsRef} className="ns-reveal border-t border-[var(--hairline)] py-12 lg:py-section-hero">
          <div className="mx-auto max-w-xl px-5 text-center sm:px-8">
            <h2 className="mb-4 text-display" style={{ fontFamily: "var(--font-serif)" }}>
              Show what you’re working toward.
            </h2>
            <p className="text-body leading-relaxed text-muted-foreground">
              Start a Pursuit with a goal you can count, like 10 loaves or 5 paintings. Log Moments toward it and its progress shows on your Shelf.
            </p>
            {/* TODO(landing page 3b §4): drop the real screenshot in at
                src/assets/landing-pursuit.webp (see docs/landing-assets.md).
                Until that file exists nothing renders here. */}
            {pursuitShot && (
              <ImageWithFallback
                src={pursuitShot}
                alt="A Pursuit on a Shelf, with its goal and progress."
                className="mx-auto mt-8 aspect-[780/1688] w-full max-w-[280px] rounded-card border border-[var(--hairline)]"
              />
            )}
          </div>
        </section>

        {/* 5. Friends and Spaces */}
        <section ref={friendsRef} className="ns-reveal border-t border-[var(--hairline)] py-12 lg:py-section-hero">
          <div className="mx-auto max-w-xl px-5 text-center sm:px-8">
            <h2 className="mb-4 text-display" style={{ fontFamily: "var(--font-serif)" }}>
              See what your friends are making.
            </h2>
            <p className="text-body leading-relaxed text-muted-foreground">
              Follow friends to see their Moments on Home.
              {landingShowsSpaces && " Join a Space to find a group around something you do."}
            </p>
          </div>
        </section>

        {/* 6. Invite ask */}
        <section id="waitlist" ref={finalCtaRef} className="ns-reveal py-12 lg:py-section-hero">
          <div className="mx-auto w-full max-w-[900px] px-5 sm:px-8">
            <div className="ns-invitation">
              <div className="ns-invitation-spark" aria-hidden="true">✦</div>
              <div className="text-center">
                <h2 className="mb-3 text-display leading-[1.02]" style={{ fontFamily: "var(--font-serif)" }}>
                  {APP_NAME} is invite only for now.
                </h2>
              </div>
              {signedOut ? (
                <>
                  <p className="mx-auto mb-8 max-w-md text-center leading-relaxed text-muted-foreground">
                    Members invite people they know. No invite? Request one and tell us what you make.
                  </p>
                  <div className="grid gap-10 md:grid-cols-2">
                    <div className="mx-auto w-full max-w-xs text-left">
                      <WaitlistForm />
                    </div>
                    <div className="mx-auto w-full max-w-xs text-left">
                      <div className="mb-2 text-lead" style={{ fontFamily: "var(--font-serif)" }}>
                        Have an invite?
                      </div>
                      <p className="mb-4 text-small leading-relaxed text-muted-foreground">
                        Open your invite link, or sign up and enter your code.
                      </p>
                      <Link to="/login">
                        <Button variant="outline" className="w-full">
                          I have an invite
                        </Button>
                      </Link>
                    </div>
                  </div>
                </>
              ) : (
                <div className="mx-auto max-w-md text-center">
                  <Link to="/create">
                    <Button variant="brand" size="lg">
                      Log a Moment
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-[var(--hairline)] py-12">
        <div className="container mx-auto flex flex-col items-center gap-6 px-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="text-center sm:text-left">
            <span className="text-lead text-foreground" style={{ fontFamily: "var(--font-serif)" }}>{APP_NAME}</span>
            <p className="mt-1 max-w-xs text-small text-muted-foreground">
              One place for everything you’re living, doing, and making.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 sm:items-end">
          {/* Product links only for members: Root.tsx's PUBLIC_PATHS bounces a
              signed-out visit to Discover/Home/Log a Moment back to "/". */}
          {!signedOut && (
            <nav aria-label="Product" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-small text-muted-foreground">
              <Link to="/discover" className="hover:text-foreground">Discover</Link>
              <Link to="/my-space" className="hover:text-foreground">Home</Link>
              <Link to="/create" className="hover:text-foreground">Log a Moment</Link>
            </nav>
          )}
          <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-small text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/privacy-policy" className="hover:text-foreground">Privacy policy</Link>
            {/* TODO(landing page spec §2.7, §10.5): placeholder address —
                needs a real contact email before launch. */}
            <a href="mailto:hello@example.com" className="hover:text-foreground">Contact</a>
          </nav>
          </div>
        </div>
        <p className="mt-8 text-center text-caption text-muted-foreground">
          {APP_NAME} is for people 16 and older. © {new Date().getFullYear()} {APP_NAME}.
        </p>
      </footer>
    </div>
  );
}
