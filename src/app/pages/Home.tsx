import { useEffect, useRef, type MouseEvent } from "react";
import { Link } from "react-router";
import { ArrowRight, Camera, Eye, Target } from "lucide-react";
import { WorldsSection } from "../components/WorldsSection";
import { Button } from "../components/ui/button";
import { useScrollReveal } from "../lib/useScrollReveal";
import { useAuth } from "../context/AuthContext";
import { WaitlistForm } from "../components/WaitlistForm";
import heroSooshImg from "../../assets/hero-soosh.webp";
import heroSoosh1000Img from "../../assets/hero-soosh-1000.webp";
import { APP_NAME } from "../config";
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

const VALUE_CARDS = [
  {
    icon: Camera,
    title: "Log a Moment",
    copy: "A photo, a note, a small win. Log it when it happens.",
  },
  {
    icon: Eye,
    title: "Choose who sees it",
    copy: "Just you, your followers, or everyone. You pick each time.",
  },
  {
    icon: Target,
    title: "Keep going with a Pursuit",
    copy: "Follow something you’re working toward, on your own or with friends.",
  },
];

const LOOP_STEPS = [
  { n: "01", label: "Create", desc: "Log a Moment right when it happens. A photo, a note, a small update." },
  { n: "02", label: "Reflect", desc: "Add a private note only you can see." },
  { n: "03", label: "Share", desc: "Just you, your followers, or everyone. Chosen right when you write it." },
];

export function Home() {
  const heroRef = useHeroParallax();
  // Step 2 (invite-only sign-up): a signed-out visitor gets the waitlist
  // instead of a "sign up" button here — the two CTAs below (hero, final)
  // are the "invites strangers to sign up" copy the brief calls out.
  // Anyone signed in (active or pending — Root.tsx already routes a
  // pending account to /welcome before this page ever renders) still sees
  // the normal "Begin your story" link into the composer.
  const { user } = useAuth();
  const signedOut = !user;

  // One below the hero, in the order they appear — the entire page reads as
  // one continuous unfolding story rather than five separately-loaded
  // sections (see useScrollReveal.ts).
  const valueCardsRef = useScrollReveal<HTMLDivElement>();
  const loopRef = useScrollReveal<HTMLElement>();
  const spacesRef = useScrollReveal<HTMLElement>();
  const statementRef = useScrollReveal<HTMLElement>();
  const finalCtaRef = useScrollReveal<HTMLElement>();

  const scrollToWaitlist = (e: MouseEvent) => {
    // Same reasoning as "See how it works" below: a plain href="#waitlist"
    // would set location.hash, which the HashRouter reads as a navigation
    // to path "/waitlist" — a route that doesn't exist — instead of
    // scrolling. Scroll manually and skip that.
    e.preventDefault();
    document.getElementById("waitlist")?.scrollIntoView({ behavior: scrollBehavior() });
  };

  return (
    <div className="min-h-viewport">
      {/* Hero */}
      <section className="ns-home-hero relative isolate overflow-hidden">
        <div className="mx-auto w-full max-w-[1200px] px-5 pb-12 pt-12 text-center sm:px-8 sm:pt-16 lg:pb-16 lg:pt-20">
          <div className="ns-hero-eyebrow ns-enter ns-enter-1 mx-auto mb-7 lg:mb-8">
            <span className="animate-pulse-soft size-1.5 bg-[var(--violet-electric)]" />
            INVITE-ONLY FOR NOW
          </div>

          <h1
            className="ns-enter ns-enter-1 mb-5 text-hero font-semibold leading-[.98] tracking-[-0.035em] text-balance text-foreground"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            A place for everything you do and make.
          </h1>

          <p className="ns-enter ns-enter-2 mx-auto mb-8 max-w-lg text-body leading-relaxed text-foreground/90 sm:text-lead">
            {APP_NAME} is a place for everything you do, make, and try. Keep it to
            yourself, share it with a few people, or show everyone.
          </p>

          <div className="ns-enter ns-enter-3 flex flex-wrap items-center justify-center gap-2.5">
            {!signedOut && (
              <Link to="/create">
                <Button variant="coral" size="lg">
                  Begin your story
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            )}
            {signedOut && (
              <>
                <a href="#waitlist" onClick={scrollToWaitlist}>
                  <Button variant="coral" size="lg">
                    Join the waitlist
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
        {/* Three value cards — what you actually come here to do. */}
        <section className="pb-4 pt-12 lg:pb-8 lg:pt-12">
          <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 xl:px-16">
            <div ref={valueCardsRef} className="ns-reveal grid gap-4 sm:grid-cols-3">
              {VALUE_CARDS.map(({ icon: Icon, title, copy }) => (
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

        {/* The Loop */}
        <section id="loop" ref={loopRef} className="ns-reveal py-12 lg:py-section-hero">
          <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 xl:px-16">
            <div className="grid items-center gap-10 md:grid-cols-2 md:gap-20">
              <div className="mx-auto max-w-lg lg:mx-0">
                <div className="ns-section-kicker mb-4">THE LOOP</div>
                <h2 className="mb-5 text-display" style={{ fontFamily: "var(--font-serif)" }}>
                  Log a Moment in seconds.
                </h2>
                <p className="max-w-md text-body leading-relaxed text-muted-foreground">
                  Take a photo, write a quick note, or add a private reflection.
                  Every Moment adds to your Shelf, the full record of what
                  you’ve done.
                </p>
              </div>
              <div className="ns-paper-panel ns-process-panel">
                {LOOP_STEPS.map((step) => (
                  <div key={step.n} className="ns-process-step">
                    <span className="font-hud text-caption text-[var(--violet-electric-bright)]">{step.n}</span>
                    <div>
                      <div className="mb-0.5 text-lead" style={{ fontFamily: "var(--font-serif)" }}>{step.label}</div>
                      <div className="text-caption leading-relaxed text-muted-foreground">{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Whatever pulls you in */}
        <WorldsSection />

        {/* Spaces and Corners */}
        <section ref={spacesRef} className="ns-reveal border-t border-[var(--hairline)] py-12 lg:py-section-hero">
          <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 xl:px-16">
            <div>
              <div className="mx-auto max-w-lg text-center">
                <div className="ns-section-kicker mb-4">SPACES AND CORNERS</div>
                <h2 className="mb-5 text-display" style={{ fontFamily: "var(--font-serif)" }}>
                  Find your people, or just your thing.
                </h2>
                <p className="mx-auto max-w-md text-body leading-relaxed text-muted-foreground">
                  Join a Space run by someone who cares about the same thing.
                  Tag a Moment with a Corner, like Pottery or Pickleball, so
                  it’s easy to find.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Statement band */}
        <section ref={statementRef} className="ns-reveal py-12 [background:var(--atmo-wine)] lg:py-section-hero">
          <div className="mx-auto max-w-2xl px-5 text-center sm:px-8">
            <p className="text-title leading-snug text-foreground md:text-display" style={{ fontFamily: "var(--font-serif)" }}>
              Share what you want, with who you want, or with no one.
            </p>
          </div>
        </section>

        {/* Get in */}
        <section id="waitlist" ref={finalCtaRef} className="ns-reveal py-12 lg:py-section-hero">
          <div className="mx-auto w-full max-w-[900px] px-5 sm:px-8">
            <div className="ns-invitation">
              <div className="ns-invitation-spark" aria-hidden="true">✦</div>
              <div className="text-center">
                <div className="ns-section-kicker mb-5">INVITE-ONLY FOR NOW</div>
                <h2 className="mb-3 text-display leading-[1.02]" style={{ fontFamily: "var(--font-serif)" }}>
                  {APP_NAME} is invite-only for now.
                </h2>
              </div>
              {signedOut ? (
                <>
                  <p className="mx-auto mb-8 max-w-md text-center leading-relaxed text-muted-foreground">
                    Members invite people they know. No invite? Join the waitlist
                    and tell us what you make.
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
                  <p className="mb-8 leading-relaxed text-muted-foreground">
                    Share only the Moments you choose, with exactly the people
                    you choose.
                  </p>
                  <Link to="/create">
                    <Button variant="brand" size="lg">
                      Begin your story
                      <ArrowRight className="size-4" />
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
