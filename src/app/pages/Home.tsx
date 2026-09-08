import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { ArrowRight, Globe2, Lock, Quote, Sparkles, UserRound, Users } from "lucide-react";
import { hobbies, getHobby, subHobbyLabel } from "../data/hobbies";
import { seedPosts } from "../data/posts";
import { deriveProjects } from "../lib/journal";
import { HobbyCategoryCard } from "../components/HobbyCategoryCard";
import { SuggestCategory } from "../components/SuggestCategory";
import { ContentCard } from "../components/ContentCard";
import { PostMedia } from "../components/PostMedia";
import { Button } from "../components/ui/button";

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
      el.style.transform = `translate3d(0, ${Math.min(window.scrollY, 700) * -0.055}px, 0)`;
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
    copy: "Private. Not shown to anyone, including your Clan.",
  },
  {
    icon: UserRound,
    label: "Clan",
    copy: "Your closest connections. Mutual only, both sides agreed.",
  },
  {
    icon: Users,
    label: "Circle",
    copy: "One community you're part of, built around a Space.",
  },
  {
    icon: Globe2,
    label: "Everyone",
    copy: "Anyone browsing NoSpace can find it.",
  },
];

const LOOP_STEPS = [
  { n: "01", label: "Create", desc: "A photo, a note, or a small update." },
  { n: "02", label: "Reflect", desc: "A private note. Only you ever see it." },
  { n: "03", label: "Share", desc: "Just you, your Clan, a Circle, or everyone." },
];

export function Home() {
  const heroRef = useHeroParallax();

  // Real seed Moments, used as-is: no fabricated captions or people.
  const heroMoments = [101, 402, 304]
    .map((id) => seedPosts.find((p) => p.id === id))
    .filter((p): p is (typeof seedPosts)[number] => !!p);

  const cornerMoments = seedPosts.filter((p) => p.subHobby === "pickleball").slice(0, 4);

  const pursuits = deriveProjects(seedPosts, subHobbyLabel).slice(0, 3);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="ns-home-hero relative isolate overflow-hidden">
        <div className="mx-auto w-full max-w-[1440px] px-5 pb-10 pt-12 sm:px-8 sm:pt-16 lg:px-12 lg:pb-16 lg:pt-24 xl:px-16">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,.94fr)_minmax(0,1.06fr)] lg:gap-14 xl:gap-20">
            <div className="text-center lg:text-left">
              <h1
                className="ns-enter ns-enter-1 mb-5 text-[clamp(2.7rem,5vw,4.35rem)] font-semibold leading-[.98] tracking-[-0.035em] text-balance text-[var(--forest)]"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Live more.
                <br />
                Log it as you go.
              </h1>

              <p className="ns-enter ns-enter-2 mx-auto mb-8 max-w-md text-base leading-relaxed text-foreground/90 sm:text-lg lg:mx-0 lg:max-w-lg">
                Track your runs, your reading, your recipes, your pursuits,
                whatever you keep coming back to. Log it as you go, then
                decide who gets to see it.
              </p>

              <div className="ns-enter ns-enter-3 flex flex-wrap items-center justify-center gap-2.5 lg:justify-start">
                <Link to="/create">
                  <Button variant="coral" size="lg">
                    Start your log
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
                <a href="#loop" className="ns-hero-secondary-link">See how it works</a>
              </div>
            </div>

            <div ref={heroRef} className="ns-parallax ns-enter ns-enter-4 will-change-transform">
              <div className="ns-hero-art mx-auto max-w-[560px] lg:max-w-none">
                <div className="ns-hero-photo-collage">
                  {heroMoments[0] && (
                    <div className="ns-hero-photo-card ns-hero-hobby-one">
                      <PostMedia
                        media={heroMoments[0].media}
                        hobbySlug={heroMoments[0].hobbySlug}
                        seed={heroMoments[0].id}
                        className="h-full w-full"
                      />
                      <div className="ns-hero-photo-label">
                        {heroMoments[0].creator.toUpperCase()} · {getHobby(heroMoments[0].hobbySlug)?.shortName.toUpperCase()}
                      </div>
                    </div>
                  )}
                  {heroMoments[1] && (
                    <div className="ns-hero-photo-card ns-hero-hobby-two">
                      <PostMedia
                        media={heroMoments[1].media}
                        hobbySlug={heroMoments[1].hobbySlug}
                        seed={heroMoments[1].id}
                        className="h-full w-full"
                      />
                      <div className="ns-hero-photo-label">
                        {heroMoments[1].creator.toUpperCase()} · {getHobby(heroMoments[1].hobbySlug)?.shortName.toUpperCase()}
                      </div>
                    </div>
                  )}
                  {heroMoments[2] && (
                    <div className="ns-hero-photo-card ns-hero-hobby-three">
                      <PostMedia
                        media={heroMoments[2].media}
                        hobbySlug={heroMoments[2].hobbySlug}
                        seed={heroMoments[2].id}
                        className="h-full w-full"
                      />
                      <div className="ns-hero-photo-label">
                        {heroMoments[2].creator.toUpperCase()} · {getHobby(heroMoments[2].hobbySlug)?.shortName.toUpperCase()}
                      </div>
                    </div>
                  )}
                  <div className="ns-hero-art-label">
                    LOGGED,
                    <br />
                    NOT PERFORMED
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <svg className="-mb-px block w-full" viewBox="0 0 1440 96" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 96V52c214-32 430-44 648-34 106 5 210 17 312 26 168 15 328 12 480-10v62Z" fill="var(--cream)" />
        </svg>
      </section>

      <div className="bg-surface">
        {/* Manifesto */}
        <section className="py-16 [background-color:var(--forest)] lg:py-20">
          <div className="mx-auto max-w-2xl px-5 text-center sm:px-8">
            <p className="text-xl leading-relaxed text-[var(--on-forest)] lg:text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
              What you make matters more than how many people saw it. NoSpace
              exists because everything you're building, learning, and getting
              curious about deserves somewhere real to live, not scattered
              across five different apps.
            </p>
          </div>
        </section>

        {/* The Loop */}
        <section id="loop" className="py-20 lg:py-28">
          <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 xl:px-16">
            <div className="grid items-center gap-10 md:grid-cols-2 md:gap-20">
              <div className="mx-auto max-w-lg lg:mx-0">
                <div className="ns-section-kicker mb-4">THE LOOP</div>
                <h2 className="mb-5 text-3xl md:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
                  Create it. Reflect for a second. Then choose who sees it.
                </h2>
                <p className="max-w-md text-[1.05rem] leading-relaxed text-muted-foreground">
                  Every Moment follows the same loop: log what you made, jot a
                  private reflection that's never shown to anyone, then choose
                  who sees it. You never have to share something to keep a
                  record of it.
                </p>
              </div>
              <div className="ns-paper-panel ns-process-panel">
                {LOOP_STEPS.map((step) => (
                  <div key={step.n} className="ns-process-step">
                    <span className="font-hud text-xs text-[var(--coral-text)]">{step.n}</span>
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
        <section className="py-20 lg:py-28">
          <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 xl:px-16">
            <div className="mb-10 max-w-xl lg:mb-12">
              <div className="ns-section-kicker mb-4">EVERY MOMENT, ITS OWN AUDIENCE</div>
              <h2 className="mb-3 text-3xl md:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
                Visibility isn't a setting. It's a choice you make each time.
              </h2>
              <p className="text-[1.05rem] leading-relaxed text-muted-foreground">
                Pick who sees a Moment when you log it, not once for your
                whole account.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {AUDIENCE_CARDS.map(({ icon: Icon, label, copy }) => (
                <div key={label} className="ns-audience-card rounded-2xl p-5">
                  <span className="mb-4 flex size-10 items-center justify-center rounded-full bg-surface-muted">
                    <Icon className="size-4.5 text-[var(--forest-ink)]" strokeWidth={1.7} />
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
          <section className="py-20 [background-color:var(--forest)] lg:py-28">
            <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 xl:px-16">
              <div className="mx-auto mb-12 max-w-xl text-center">
                <div className="mb-4 font-hud text-[10px] tracking-[.18em] text-[var(--yellow)]">PURSUITS</div>
                <h2 className="mb-3 text-3xl text-[var(--on-forest)] lg:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
                  Your pursuits, always visible to you.
                </h2>
                <p className="text-[var(--on-forest-muted)]">Every Pursuit grows the same way. One Moment at a time.</p>
              </div>
              <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-3">
                {pursuits.map((pursuit) => (
                  <div key={pursuit.key} className="ns-pursuit-card rounded-2xl p-5">
                    <div className="mb-1 text-lg text-[var(--on-forest)]" style={{ fontFamily: "var(--font-serif)" }}>
                      {pursuit.title}
                    </div>
                    <div className="mb-3 text-xs text-[var(--on-forest-muted)]">
                      {pursuit.creator} · {pursuit.updates.length} Moments logged
                    </div>
                    <div className="inline-flex items-center gap-1.5 text-[11px] text-[var(--on-forest-muted)]">
                      <Users className="size-3.5" />
                      {getHobby(pursuit.hobbySlug)?.shortName}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-12 text-center text-lg text-[var(--on-forest)]" style={{ fontFamily: "var(--font-serif)" }}>
                Keep living. Keep logging. Watch it add up.
              </p>
            </div>
          </section>
        )}

        {/* This Corner */}
        {cornerMoments.length > 0 && (
          <section className="py-20 lg:py-28">
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
        <section className="border-t border-[var(--hairline)] py-20 lg:py-28">
          <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 xl:px-16">
            <div className="mb-10 flex items-end justify-between gap-5 lg:mb-12">
              <div className="max-w-xl">
                <div className="ns-section-kicker mb-4">DISCOVER</div>
                <h2 className="mb-3 text-3xl md:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
                  Fifteen Spaces. More Corners than we can list.
                </h2>
                <p className="text-[1.05rem] leading-relaxed text-muted-foreground">
                  Each Space holds many Corners, the specific things people
                  actually do. Don't see yours? Suggest it.
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
        <section className="py-20 [background-color:var(--sky)] lg:py-28">
          <div className="mx-auto max-w-2xl px-5 text-center sm:px-8">
            <Quote className="mx-auto mb-5 size-6 text-[var(--forest-ink)]" />
            <p className="text-2xl leading-snug text-[var(--forest-ink)] md:text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
              No algorithm decides what you see. No score keeps you scrolling.
              Just Moments, in the order people actually made them.
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 lg:py-28">
          <div className="mx-auto w-full max-w-[900px] px-5 sm:px-8">
            <div className="ns-invitation text-center">
              <div className="ns-invitation-spark" aria-hidden="true">✦</div>
              <div className="ns-section-kicker mb-5">START WHERE YOU ARE</div>
              <h2 className="mb-5 text-4xl leading-[1.02] md:text-5xl" style={{ fontFamily: "var(--font-serif)" }}>
                You don't just consume.<br />You make things, too.
              </h2>
              <p className="mx-auto mb-8 max-w-md leading-relaxed text-muted-foreground">
                Free to use. Private by default.
              </p>
              <Link to="/create">
                <Button variant="brand" size="lg">
                  <Sparkles className="size-4" /> Start your log
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-[var(--hairline)] py-12">
        <div className="container mx-auto flex flex-col items-center gap-6 px-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="text-center sm:text-left">
            <span className="text-lg text-[var(--forest)]" style={{ fontFamily: "var(--font-serif)" }}>NoSpace</span>
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
