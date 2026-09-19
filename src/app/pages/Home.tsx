import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { ArrowRight, Camera, Compass, NotebookPen, Quote, Sparkles } from "lucide-react";
import { hobbies } from "../data/hobbies";
import { seedPosts } from "../data/posts";
import { HobbyCategoryCard } from "../components/HobbyCategoryCard";
import { ContentCard } from "../components/ContentCard";
import { WorldsSection } from "../components/WorldsSection";
import { Button } from "../components/ui/button";
import { useScrollReveal } from "../lib/useScrollReveal";
import { useCategories } from "../context/CategoriesContext";
import heroWorldsImg from "../../assets/hero-worlds.png";

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
    title: "Create moments",
    copy: "Turn the things you do, make, learn, and experience into moments worth remembering.",
  },
  {
    icon: NotebookPen,
    title: "Document what makes you more you",
    copy: "Photos, notes, first attempts, small wins, and all the little changes that become part of your story.",
  },
  {
    icon: Compass,
    title: "Explore what sparks next",
    copy: "Follow where your curiosity takes you and discover the next thing you want to try, learn, make, or experience.",
  },
];

const LOOP_STEPS = [
  { n: "01", label: "Create", desc: "Log a Moment right when it happens. A photo, a note, a small update." },
  { n: "02", label: "Reflect", desc: "Add a private note only you can see. Never shown, never scored." },
  { n: "03", label: "Share", desc: "Just you, your Clan, a Circle, or everyone. Chosen right when you write it." },
];

export function Home() {
  const heroRef = useHeroParallax();
  // Subscribing re-renders the Space grid when admin changes load.
  useCategories();

  // One below the hero, in the order they appear — the entire page reads as
  // one continuous unfolding story rather than five separately-loaded
  // sections (see useScrollReveal.ts).
  const valueCardsRef = useScrollReveal<HTMLDivElement>();
  const loopRef = useScrollReveal<HTMLElement>();
  const cornerRef = useScrollReveal<HTMLElement>();
  const discoverRef = useScrollReveal<HTMLElement>();
  const quoteRef = useScrollReveal<HTMLElement>();
  const finalCtaRef = useScrollReveal<HTMLElement>();

  const cornerMoments = seedPosts.filter((p) => p.subHobby === "pickleball").slice(0, 4);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="ns-home-hero relative isolate overflow-hidden">
        <div className="mx-auto w-full max-w-[1200px] px-5 pb-12 pt-12 text-center sm:px-8 sm:pt-16 lg:pb-16 lg:pt-20">
          <div className="ns-hero-eyebrow ns-enter ns-enter-1 mx-auto mb-7 lg:mb-8">
            <span className="animate-pulse-soft size-1.5 bg-[var(--violet-electric)]" />
            A SPACE FOR MORE OF YOU
          </div>

          <h1
            className="ns-enter ns-enter-1 mb-5 text-[clamp(2.7rem,5vw,4.35rem)] font-semibold leading-[.98] tracking-[-0.035em] text-balance text-foreground"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Your interests are
            <br />
            part of your story.
          </h1>

          <p className="ns-enter ns-enter-2 mx-auto mb-8 max-w-md text-base leading-relaxed text-foreground/90 sm:text-lg">
            Create moments. Document what makes you more you. Explore
            what sparks next.
          </p>

          <div className="ns-enter ns-enter-3 flex flex-wrap items-center justify-center gap-2.5">
            <Link to="/create">
              <Button variant="coral" size="lg">
                Begin your story
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <a
              href="#loop"
              className="ns-hero-secondary-link"
              onClick={(e) => {
                // A plain href="#loop" would set location.hash, which the
                // HashRouter reads as a navigation to path "/loop" — a
                // route that doesn't exist, so it lands on the 404 page
                // instead of scrolling. Scroll manually and skip that.
                e.preventDefault();
                document.getElementById("loop")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              See how it works
            </a>
          </div>
          <p className="ns-enter ns-enter-3 mt-4 text-sm text-foreground/70">Free to join. No credit card.</p>
        </div>

        <div className="mx-auto w-full max-w-[1440px] px-5 pb-12 sm:px-8 lg:px-12 lg:pb-20 xl:px-16">
          <div ref={heroRef} className="ns-parallax ns-enter ns-enter-4 will-change-transform">
            <img
              src={heroWorldsImg}
              alt="Small illustrated worlds of people playing music, painting, sculpting, gardening, reading, and coding, connected by soft glowing paths."
              className="ns-hero-worlds-art aspect-[1376/768] w-full object-cover"
            />
          </div>
        </div>

        <svg className="-mb-px block w-full" viewBox="0 0 1440 96" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 96V52c214-32 430-44 648-34 106 5 210 17 312 26 168 15 328 12 480-10v62Z" fill="var(--surface)" />
        </svg>
      </section>

      <div className="bg-surface">
        {/* Three value cards — what you actually come here to do. */}
        <section className="pb-4 pt-16 lg:pb-8 lg:pt-20">
          <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 xl:px-16">
            <div ref={valueCardsRef} className="ns-reveal grid gap-4 sm:grid-cols-3">
              {VALUE_CARDS.map(({ icon: Icon, title, copy }) => (
                <div key={title} className="ns-value-card rounded-2xl p-6">
                  <span className="ns-value-card-icon mb-5 flex size-11 items-center justify-center rounded-full bg-surface-muted">
                    <Icon className="size-5 text-foreground" strokeWidth={1.7} />
                  </span>
                  <div className="mb-2 text-xl" style={{ fontFamily: "var(--font-serif)" }}>{title}</div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* The Loop */}
        <section id="loop" ref={loopRef} className="ns-reveal py-20 lg:py-28">
          <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 xl:px-16">
            <div className="grid items-center gap-10 md:grid-cols-2 md:gap-20">
              <div className="mx-auto max-w-lg lg:mx-0">
                <div className="ns-section-kicker mb-4">THE LOOP</div>
                <h2 className="mb-5 text-3xl md:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
                  Ten seconds to log. A lifetime to look back on.
                </h2>
                <p className="max-w-md text-[1.05rem] leading-relaxed text-muted-foreground">
                  Take a photo, write a quick note, or add a reflection nobody
                  else will ever see. Every Moment adds to your Shelf, the
                  full record of what you've actually done.
                </p>
              </div>
              <div className="ns-paper-panel ns-process-panel">
                {LOOP_STEPS.map((step) => (
                  <div key={step.n} className="ns-process-step">
                    <span className="font-hud text-xs text-[var(--violet-electric-bright)]">{step.n}</span>
                    <div>
                      <div className="mb-0.5 text-lg" style={{ fontFamily: "var(--font-serif)" }}>{step.label}</div>
                      <div className="text-xs leading-relaxed text-muted-foreground">{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Whatever pulls you in */}
        <WorldsSection />

        {/* This Corner */}
        {cornerMoments.length > 0 && (
          <section ref={cornerRef} className="ns-reveal py-20 lg:py-28">
            <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 xl:px-16">
              <div className="mb-10 max-w-xl lg:mb-12">
                <div className="ns-section-kicker mb-4">THIS CORNER, RIGHT NOW</div>
                <h2 className="mb-3 text-3xl md:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
                  Inside the Pickleball Corner.
                </h2>
                <p className="text-[1.05rem] leading-relaxed text-muted-foreground">
                  A Corner is the specific thing inside a Space, like Pickleball
                  inside Sports &amp; Fitness. Here's an example, shown with
                  real Moments from NoSpace's sample content.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {cornerMoments.map((post) => (
                  <ContentCard key={post.id} post={post} compact />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Discover / Spaces grid */}
        <section ref={discoverRef} className="ns-reveal border-t border-[var(--hairline)] py-20 lg:py-28">
          <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 xl:px-16">
            <div className="mb-10 flex items-end justify-between gap-5 lg:mb-12">
              <div className="max-w-xl">
                <div className="ns-section-kicker mb-4">DISCOVER</div>
                <h2 className="mb-3 text-3xl md:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
                  One place for everything you do.
                </h2>
                <p className="text-[1.05rem] leading-relaxed text-muted-foreground">
                  Fifteen Spaces today. Inside each one, tag a Moment
                  anything you like — "Pasta Making," "Food Photography,"
                  both at once — and it's there. No fixed list, no approval
                  queue.
                </p>
              </div>
              <Link to="/discover" className="ns-text-link hidden shrink-0 sm:inline-flex">
                Open Discover
                <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
              {hobbies.filter((h) => !h.hidden).map((hobby) => (
                <HobbyCategoryCard key={hobby.slug} hobby={hobby} showCorners />
              ))}
            </div>
          </div>
        </section>

        {/* Quote / proof */}
        <section ref={quoteRef} className="ns-reveal py-20 [background:var(--atmo-wine)] lg:py-28">
          <div className="mx-auto max-w-2xl px-5 text-center sm:px-8">
            <Quote className="mx-auto mb-5 size-6 text-[var(--violet-electric-bright)]" />
            <p className="text-2xl leading-snug text-foreground md:text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
              No feed algorithm. No streaks. No performing for an audience.
              Just your own log, kept the way you want it.
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section ref={finalCtaRef} className="ns-reveal py-20 lg:py-28">
          <div className="mx-auto w-full max-w-[900px] px-5 sm:px-8">
            <div className="ns-invitation text-center">
              <div className="ns-invitation-spark" aria-hidden="true">✦</div>
              <div className="ns-section-kicker mb-5">START WHERE YOU ARE</div>
              <h2 className="mb-5 text-4xl leading-[1.02] md:text-5xl" style={{ fontFamily: "var(--font-serif)" }}>
                Whatever you're curious about,<br />it's worth keeping.
              </h2>
              <p className="mx-auto mb-8 max-w-md leading-relaxed text-muted-foreground">
                Free to join. Private by default. Share only the Moments you
                choose, with exactly the people you choose.
              </p>
              <Link to="/create">
                <Button variant="brand" size="lg">
                  <Sparkles className="size-4" /> Begin your story
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-[var(--hairline)] py-12">
        <div className="container mx-auto flex flex-col items-center gap-6 px-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="text-center sm:text-left">
            <span className="text-lg text-foreground" style={{ fontFamily: "var(--font-serif)" }}>NoSpace</span>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              One place for everything you're living, doing, and making.
            </p>
          </div>
          <nav aria-label="Product" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <Link to="/discover" className="hover:text-foreground">Discover</Link>
            <Link to="/my-space" className="hover:text-foreground">My Space</Link>
            <Link to="/circles" className="hover:text-foreground">Circles</Link>
            <Link to="/create" className="hover:text-foreground">Start your log</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
