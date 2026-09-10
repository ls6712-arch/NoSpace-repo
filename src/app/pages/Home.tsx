import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { ArrowRight, Camera, Compass, Globe2, Lock, NotebookPen, Quote, Sparkles, UserRound, Users } from "lucide-react";
import { hobbies, getHobby, subHobbyLabel } from "../data/hobbies";
import { seedPosts } from "../data/posts";
import { deriveProjects } from "../lib/journal";
import { HobbyCategoryCard } from "../components/HobbyCategoryCard";
import { SuggestCategory } from "../components/SuggestCategory";
import { ContentCard } from "../components/ContentCard";
import { GeneratedArt } from "../components/GeneratedArt";
import { WorldsSection } from "../components/WorldsSection";
import { Button } from "../components/ui/button";
import { useScrollReveal } from "../lib/useScrollReveal";
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

const AUDIENCE_CARDS = [
  {
    icon: Lock,
    label: "Just Me",
    copy: "For the moments you want to keep for yourself.",
  },
  {
    icon: UserRound,
    label: "Clan",
    copy: "Share with the people closest to you.",
  },
  {
    icon: Users,
    label: "Circle",
    copy: "Share with a community built around what you're into.",
  },
  {
    icon: Globe2,
    label: "Everyone",
    copy: "Make it visible to anyone exploring NoSpace.",
  },
];

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

  // One below the hero, in the order they appear — the entire page reads as
  // one continuous unfolding story rather than five separately-loaded
  // sections (see useScrollReveal.ts).
  const valueCardsRef = useScrollReveal<HTMLDivElement>();
  const manifestoRef = useScrollReveal<HTMLElement>();
  const loopRef = useScrollReveal<HTMLElement>();
  const audienceRef = useScrollReveal<HTMLElement>();
  const pursuitsRef = useScrollReveal<HTMLElement>();
  const cornerRef = useScrollReveal<HTMLElement>();
  const discoverRef = useScrollReveal<HTMLElement>();
  const quoteRef = useScrollReveal<HTMLElement>();
  const finalCtaRef = useScrollReveal<HTMLElement>();

  const cornerMoments = seedPosts.filter((p) => p.subHobby === "pickleball").slice(0, 4);

  const pursuits = deriveProjects(seedPosts, subHobbyLabel).slice(0, 3);

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

        {/* Manifesto */}
        <section ref={manifestoRef} className="ns-reveal py-16 [background-color:var(--forest)] lg:py-20">
          <div className="mx-auto max-w-2xl px-5 text-center sm:px-8">
            <p className="text-xl leading-relaxed text-[var(--on-forest)] lg:text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
              Most apps want you to perform for an audience. NoSpace doesn't.
              Log what you actually did. Keep it to yourself, or share it with
              people who'd actually care. No streaks to keep up. No algorithm
              deciding who sees you.
            </p>
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

        {/* Audience */}
        <section ref={audienceRef} className="ns-reveal py-20 lg:py-28">
          <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 xl:px-16">
            <div className="mb-10 max-w-xl lg:mb-12">
              <div className="ns-section-kicker mb-4">EVERY MOMENT, ITS OWN AUDIENCE</div>
              <h2 className="mb-3 text-3xl md:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
                Every Moment picks its own audience.
              </h2>
              <p className="text-[1.05rem] leading-relaxed text-muted-foreground">
                Choose who gets to see each Moment. Your whole life does not
                have to be public.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {AUDIENCE_CARDS.map(({ icon: Icon, label, copy }) => (
                <div key={label} className="ns-audience-card rounded-2xl p-5">
                  <span className="mb-4 flex size-10 items-center justify-center rounded-full bg-surface-muted">
                    <Icon className="size-4.5 text-foreground" strokeWidth={1.7} />
                  </span>
                  <div className="mb-1.5 text-lg" style={{ fontFamily: "var(--font-serif)" }}>{label}</div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pursuits */}
        {pursuits.length > 0 && (
          <section ref={pursuitsRef} className="ns-reveal py-20 [background-color:var(--forest)] lg:py-28">
            <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 xl:px-16">
              <div className="mx-auto mb-12 max-w-xl text-center">
                <div className="mb-4 font-hud text-[10px] tracking-[.18em] text-[var(--yellow)]">PURSUITS</div>
                <h2 className="mb-3 text-3xl text-[var(--on-forest)] lg:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
                  A story that gets richer over time.
                </h2>
                <p className="text-[var(--on-forest-muted)]">
                  Your Pursuits aren't a list of achievements. They're a
                  record of what you've been curious enough to explore.
                </p>
              </div>
              <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-3">
                {pursuits.map((pursuit) => (
                  <Link
                    key={pursuit.key}
                    to={`/pursuit/${encodeURIComponent(pursuit.key)}`}
                    className="ns-pursuit-card group block overflow-hidden rounded-2xl"
                  >
                    <div className="relative aspect-square overflow-hidden [background-color:var(--forest-ink)]">
                      <GeneratedArt
                        hobbySlug={pursuit.hobbySlug}
                        seed={pursuit.updates[0]?.id ?? pursuit.key}
                        className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                      />
                      <span className="absolute left-2.5 top-2.5 rounded-sm border border-[var(--on-forest)]/30 bg-[var(--void)]/85 px-2 py-1 font-hud text-[10px] tracking-[.05em] text-[var(--on-forest)]">
                        {pursuit.updates.length} Moment{pursuit.updates.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="mb-1 text-lg text-[var(--on-forest)]" style={{ fontFamily: "var(--font-serif)" }}>
                        {pursuit.title}
                      </div>
                      <div className="mb-2 text-xs text-[var(--on-forest-muted)]">
                        {pursuit.creator} · {getHobby(pursuit.hobbySlug)?.shortName}
                      </div>
                      <span className="font-hud text-[10px] uppercase tracking-[.06em] text-[var(--yellow)]">View Pursuit →</span>
                    </div>
                  </Link>
                ))}
              </div>
              <p className="mt-12 text-center text-lg text-[var(--on-forest)]" style={{ fontFamily: "var(--font-serif)" }}>
                Keep living. Keep logging. Watch it add up.
              </p>
            </div>
          </section>
        )}

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
              <div className="columns-1 gap-4 sm:columns-2 lg:columns-4">
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
                  Fifteen Spaces today, and growing. Anyone can suggest one.
                  Inside each Space, Corners are as specific as you need them:
                  tag a Moment "Pasta Making" instead of just "Cooking," and
                  the Corner exists. No approval queue.
                </p>
              </div>
              <Link to="/discover" className="ns-text-link hidden shrink-0 sm:inline-flex">
                Open Discover
                <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
              {hobbies.map((hobby) => (
                <HobbyCategoryCard key={hobby.slug} hobby={hobby} showCorners />
              ))}
              <div className="flex items-start">
                <SuggestCategory className="h-full" />
              </div>
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
