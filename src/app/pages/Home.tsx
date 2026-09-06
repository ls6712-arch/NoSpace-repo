import { ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Check, Mail, Quote, Sparkles } from "lucide-react";
import { hobbies, getHobby } from "../data/hobbies";
import { seedPosts } from "../data/posts";
import { circles } from "../data/circles";
import { useContent } from "../context/ContentContext";
import { useAuth } from "../context/AuthContext";
import { HobbyCategoryCard } from "../components/HobbyCategoryCard";
import { ContentCard } from "../components/ContentCard";
import { GeneratedArt } from "../components/GeneratedArt";
import { HeroScene } from "../components/HeroScene";
import { PostReactions } from "../components/PostReactions";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback } from "../components/ui/avatar";

/**
 * Desktop-only parallax on the hero illustration: the scene drifts up a little
 * more slowly than the page, which is what stops the hero from reading as a
 * flat banner. Off below 1024px (nothing to parallax against on a phone) and
 * off under prefers-reduced-motion, both watched live rather than sampled once.
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

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setJoined(true);
  };

  if (joined) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm">
        <span className="flex size-6 items-center justify-center rounded-full text-white [background-image:var(--gradient-brand)]">
          <Check className="size-3.5" />
        </span>
        You're on the list — we'll be in touch.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch gap-2 max-w-md mx-auto">
      <div className="relative flex-1">
        <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          className="w-full rounded-full border border-border bg-surface-muted py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
        />
      </div>
      <Button type="submit" variant="brand">
        Join
      </Button>
    </form>
  );
}

function FeatureSection({
  eyebrow,
  title,
  copy,
  cta,
  ctaTo,
  reverse,
  visual,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  cta?: string;
  ctaTo?: string;
  reverse?: boolean;
  visual: ReactNode;
}) {
  return (
    <section className="ns-feature py-16 lg:py-24">
      <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 xl:px-16">
        <div
          className={`grid items-center gap-10 md:grid-cols-2 md:gap-20 ${
            reverse ? "md:[&>*:first-child]:order-2" : ""
          }`}
        >
          <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 max-w-lg">
            <div className="ns-section-kicker mb-4">{eyebrow}</div>
            <h2 className="mb-5 text-3xl md:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>{title}</h2>
            <p className="mb-7 max-w-md text-[1.05rem] leading-relaxed text-muted-foreground">{copy}</p>
            {cta && ctaTo && (
              <Link to={ctaTo} className="ns-text-link">
                {cta}
                <ArrowRight className="size-4" />
              </Link>
            )}
          </div>
          <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 delay-150">
            {visual}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Home() {
  const parallaxRef = useHeroParallax();
  const { user } = useAuth();
  const { publicFeed, activeHobbySlugs } = useContent();
  const trending = publicFeed.slice(0, 6);
  const exploreNext = hobbies.filter((h) => !activeHobbySlugs.includes(h.slug));

  const circleSample = circles.filter((c) => c.location).slice(0, 3);
  const portfolioSample = seedPosts
    .filter((p) => ["workbench", "thestudio", "kitchentable"].includes(p.hobbySlug))
    .slice(0, 6);
  const testimonialPosts = [
    seedPosts.find((p) => p.id === 104),
    seedPosts.find((p) => p.id === 302),
    seedPosts.find((p) => p.id === 401),
    seedPosts.find((p) => p.id === 502),
  ].filter((p): p is (typeof seedPosts)[number] => !!p);

  const heroHobbies = [
    { slug: "books-writing", seed: "hero-reading", className: "ns-hero-hobby-one" },
    { slug: "music", seed: "hero-music", className: "ns-hero-hobby-two" },
    { slug: "tech-building", seed: "hero-building", className: "ns-hero-hobby-three" },
  ];

  const marqueeHobbies = [
    { slug: "books-writing", seed: "marquee-writing", className: "ns-marquee-hobby-one" },
    { slug: "food-cooking", seed: "marquee-cooking", className: "ns-marquee-hobby-two" },
    { slug: "music", seed: "marquee-music", className: "ns-marquee-hobby-three" },
    { slug: "nature-outdoors", seed: "marquee-nature", className: "ns-marquee-hobby-four" },
  ];

  return (
    <div className="min-h-screen">
      <section className="ns-home-hero relative isolate overflow-hidden">
        <div className="mx-auto w-full max-w-[1440px] px-5 pb-10 pt-12 sm:px-8 sm:pt-16 lg:px-12 lg:pb-16 lg:pt-24 xl:px-16">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,.94fr)_minmax(0,1.06fr)] lg:gap-14 xl:gap-20">
            <div className="text-center lg:text-left">
              <div className="ns-hero-eyebrow ns-enter ns-enter-1 mb-7 lg:mb-8">
                <span className="animate-pulse-soft size-1.5 bg-[var(--coral-deep)]" />
                Welcome to hobbymaxxing
              </div>

              <h1
                className="ns-enter ns-enter-1 mb-5 text-[clamp(2.7rem,5vw,4.35rem)] font-semibold leading-[.98] tracking-[-0.035em] text-balance text-[var(--forest)]"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Made something today?
                <br />
                <span className="relative inline-block">
                  Show it.
                  <svg
                    className="pointer-events-none absolute -bottom-2 left-0 h-[0.26em] w-full"
                    viewBox="0 0 220 14"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path d="M3 10C46 4 122 2 217 6" fill="none" stroke="var(--coral-deep)" strokeWidth="6" strokeLinecap="round" />
                  </svg>
                </span>
              </h1>

              <p className="ns-enter ns-enter-2 mb-4 text-xl text-foreground sm:text-2xl" style={{ fontFamily: "var(--font-heading)" }}>
                Create, Don&apos;t Just Consume.
              </p>

              <p className="ns-enter ns-enter-2 mx-auto mb-5 max-w-md text-base leading-relaxed text-foreground/90 sm:text-lg lg:mx-0 lg:max-w-lg">
                Pick a hobby, share what you&apos;re actually making, and find people doing the same thing.
              </p>

              <ul className="ns-hero-claims ns-enter ns-enter-3 mb-8 flex flex-wrap justify-center lg:justify-start" aria-label="What NoSpace is for">
                {["Real people", "Real progress", "Real output"].map((claim) => (
                  <li key={claim}>{claim}</li>
                ))}
              </ul>

              <div className="ns-enter ns-enter-3 flex flex-wrap items-center justify-center gap-2.5 lg:justify-start">
                <Link to="/create">
                  <Button variant="coral" size="lg">
                    Start creating
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
                {user && <Link to="/my-space" className="ns-hero-secondary-link">Go to My Space</Link>}
                <Link to="/discover" className="ns-hero-secondary-link">Explore hobbies</Link>
              </div>
            </div>

            <div ref={parallaxRef} className="ns-parallax ns-enter ns-enter-4 will-change-transform">
              <div className="ns-hero-art mx-auto max-w-[640px] lg:max-w-none">
                <div className="ns-hero-hobby-orbit" aria-hidden="true">
                  {heroHobbies.map((hobby) => (
                    <div key={hobby.seed} className={`ns-hero-hobby ${hobby.className}`}>
                      <GeneratedArt hobbySlug={hobby.slug} seed={hobby.seed} className="h-full w-full" />
                    </div>
                  ))}
                </div>
                <HeroScene className="relative z-10 mx-auto w-full" />
              </div>
            </div>
          </div>
        </div>

        <svg className="-mb-px block w-full" viewBox="0 0 1440 96" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 96V52c214-32 430-44 648-34 106 5 210 17 312 26 168 15 328 12 480-10v62Z" fill="var(--cream)" />
        </svg>
      </section>

      <div className="ns-marquee relative overflow-hidden bg-surface py-5 md:py-7">
        <div className="ns-marquee-art" aria-hidden="true">
          {marqueeHobbies.map((hobby) => (
            <div key={hobby.seed} className={`ns-marquee-hobby ${hobby.className}`}>
              <GeneratedArt hobbySlug={hobby.slug} seed={hobby.seed} className="h-full w-full" />
            </div>
          ))}
        </div>
        <div className="relative z-10 flex w-max animate-marquee">
          {[0, 1].map((rep) => (
            <div key={rep} className="flex shrink-0 items-center" aria-hidden={rep === 1}>
              {Array.from({ length: 4 }).map((_, i) => (
                <span key={i} className="flex shrink-0 items-center">
                  <span className="mx-6 text-4xl font-semibold tracking-[-.03em] text-[var(--forest)] md:text-6xl" style={{ fontFamily: "var(--font-heading)" }}>
                    HOBBYMAXXING
                  </span>
                  <span className="ns-marquee-mark text-3xl text-[var(--coral-deep)] md:text-5xl">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface">
      <section className="py-20 lg:py-28">
        <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 xl:px-16">
          <div className="mb-10 flex items-end justify-between gap-5 lg:mb-12">
            <div className="max-w-xl">
              <div className="ns-section-kicker mb-4">CHOOSE A SPACE</div>
              <h2 className="mb-3 text-3xl md:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>A space for every obsession.</h2>
              <p className="text-[1.05rem] leading-relaxed text-muted-foreground">Pick a hobby, share what you&apos;re actually making, and find people doing the same thing.</p>
            </div>
            <Link to="/discover" className="ns-text-link hidden shrink-0 sm:inline-flex">
              All {hobbies.reduce((n, h) => n + h.subItems.length, 0)} hobbies
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {hobbies.map((hobby, i) => (
              <div
                key={hobby.slug}
                className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <HobbyCategoryCard hobby={hobby} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature: Log → Reflect → Share → Earn */}
      <FeatureSection
        eyebrow="1 · THE LOOP"
        title="Create it. Reflect for a second. Then choose who sees it."
        copy="Every entry follows the same loop: log what you made, jot a private reflection that's never shown to anyone, then choose who sees it. You never have to share something in order to keep a record of it."
        visual={
          <div className="ns-paper-panel ns-process-panel space-y-0">
            {[
              { n: "01", label: "Create", desc: "A photo, a note, or a small update" },
              { n: "02", label: "Reflect", desc: "A private note — only you ever see it" },
              { n: "03", label: "Share", desc: "Only you, your connections, a Circle, or everyone" },
            ].map((step) => (
              <div key={step.n} className="ns-process-step">
                <span className="font-hud text-xs text-[var(--coral-text)]">{step.n}</span>
                <div>
                  <div className="mb-0.5 text-lg" style={{ fontFamily: "var(--font-serif)" }}>{step.label}</div>
                  <div className="text-xs leading-relaxed text-muted-foreground">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        }
      />

      {/* Feature: Circles, hyperlocal */}
      <FeatureSection
        reverse
        eyebrow="2 · CIRCLES"
        title="Find your circle — down to your city."
        copy="Circles are hobby-first, not region-first: join a global topic circle, or one with a geographic layer for real-world meetups nearby. No separate app per city — geography is just a filter inside a hobby."
        visual={
          <div className="ns-paper-panel ns-circle-panel">
            <div className="mb-5 flex items-center justify-between border-b border-[var(--hairline)] pb-3">
              <span className="font-hud text-[10px] tracking-[.16em] text-[var(--coral-text)]">DOING IT TOGETHER</span>
              <span className="size-2 rotate-45 bg-[var(--yellow)]" />
            </div>
            {circleSample.map((circle) => (
              <div key={circle.id} className="ns-circle-row">
                <div>
                  <div className="text-lg" style={{ fontFamily: "var(--font-serif)" }}>{circle.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">Gathering in {circle.location}</div>
                </div>
                <span className="font-hud text-xs text-[var(--coral-text)]">OPEN ↗</span>
              </div>
            ))}
          </div>
        }
      />

      {/* Feature: Portfolio, not a scoreboard */}
      <FeatureSection
        eyebrow="3 · PROFILE"
        title="A portfolio, not a scoreboard."
        copy="One headline stat instead of a stats dashboard. Hobby tags for what you actually engage with. A quiet, non-leaderboard badge strip. Your work, chronological and visual — that's the whole profile."
        cta="See a profile"
        ctaTo="/profile"
        visual={
          <div className="ns-paper-panel ns-portfolio-panel">
            <div className="mb-5 flex items-end justify-between border-b border-[var(--hairline)] pb-3">
              <div>
                <div className="text-xl" style={{ fontFamily: "var(--font-serif)" }}>A record in the making</div>
                <div className="mt-1 text-xs text-muted-foreground">A shelf, not a score.</div>
              </div>
              <span className="font-hud text-[10px] text-[var(--coral-text)]">POTTERY</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {portfolioSample.map((post, index) => (
                <div key={post.id} className={`aspect-square overflow-hidden ${index === 1 ? "translate-y-3" : ""}`}>
                  <GeneratedArt hobbySlug={post.hobbySlug} seed={post.id} className="h-full w-full" />
                </div>
              ))}
            </div>
          </div>
        }
      />

      <section className="ns-maker-notes py-20 lg:py-28 [background-color:var(--forest)]">
        <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <div className="mb-4 font-hud text-[10px] tracking-[.18em] text-[var(--yellow)]">NOTES FROM THE CLUBHOUSE</div>
            <h2 className="mb-3 text-3xl text-[var(--on-forest)] lg:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
              The good stuff is usually unfinished.
            </h2>
            <p className="text-[var(--on-forest-muted)]">Small observations from people keeping at it.</p>
          </div>
          <div className="grid max-w-5xl gap-4 md:grid-cols-2 md:gap-5 lg:gap-6 mx-auto">
            {testimonialPosts.map((post, i) => (
              <div key={post.id} className="ns-maker-note animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                <Quote className="mb-4 size-5 text-[var(--coral-text)]" />
                <p className="mb-6 text-lg leading-snug" style={{ fontFamily: "var(--font-serif)" }}>“{post.caption}”</p>
                <div className="flex items-center justify-between gap-3 border-t border-[var(--hairline)] pt-4">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-7"><AvatarFallback className="text-[10px]">{initials(post.creator)}</AvatarFallback></Avatar>
                    <div className="text-xs text-muted-foreground">{post.creator} · {getHobby(post.hobbySlug)?.shortName}</div>
                  </div>
                  <PostReactions postId={post.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 xl:px-16">
          <div className="mb-10 flex items-end justify-between gap-5 lg:mb-12">
            <div className="max-w-xl">
              <div className="ns-section-kicker mb-4">WORK LEFT ON THE TABLE</div>
              <h2 className="mb-3 text-3xl md:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>See what&apos;s taking shape.</h2>
              <p className="text-[1.05rem] leading-relaxed text-muted-foreground">Recent work from across the spaces, with no popularity contest attached.</p>
            </div>
            <Link to="/create" className="ns-text-link hidden shrink-0 sm:inline-flex">Start your own <ArrowRight className="size-4" /></Link>
          </div>
          <div className="columns-1 gap-4 sm:columns-2 md:columns-3 xl:columns-4">
            {trending.map((post, i) => (
              <div
                key={post.id}
                className="animate-in fade-in fill-mode-both duration-500"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <ContentCard post={post} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {exploreNext.length > 0 && (
        <section className="border-t border-[var(--hairline)] py-20 lg:py-28">
          <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 xl:px-16">
            <div className="mb-10 max-w-xl lg:mb-12">
              <div className="ns-section-kicker mb-4">WANDER A LITTLE</div>
              <h2 className="mb-3 text-3xl md:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>Your next rabbit hole.</h2>
              <p className="text-[1.05rem] leading-relaxed text-muted-foreground">Spaces you have not opened yet. The first try counts.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {exploreNext.map((hobby, i) => (
                <div
                  key={hobby.slug}
                  className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <HobbyCategoryCard hobby={hobby} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="ns-principles py-20 [background-color:var(--sky)] lg:py-28">
        <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <div className="mb-12 max-w-lg">
            <div className="mb-4 font-hud text-[10px] tracking-[.18em] text-[var(--forest-ink)]">WHAT WE LEAVE OUT</div>
            <h2 className="text-3xl md:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>More room for the part that matters.</h2>
          </div>
          <div className="grid gap-px overflow-hidden border border-[var(--forest-ink)]/25 sm:grid-cols-3">
            {[
              ["No performance", "Make it because it pulls at you, not because it plays well."],
              ["No scorekeeping", "A quiet record of your practice is enough."],
              ["No endless scroll", "Every space is a place to arrive, not disappear into."],
            ].map(([title, copy], index) => (
              <div key={title} className="ns-principle p-7 sm:p-8">
                <span className="mb-10 block font-hud text-xs text-[var(--coral-text)]">0{index + 1}</span>
                <h3 className="mb-3 text-2xl" style={{ fontFamily: "var(--font-serif)" }}>{title}</h3>
                <p className="text-sm leading-relaxed text-[var(--forest-ink)]">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="mx-auto w-full max-w-[900px] px-5 sm:px-8">
          <div className="ns-invitation text-center">
            <div className="ns-invitation-spark" aria-hidden="true">✦</div>
            <div className="ns-section-kicker mb-5">COME AS YOU ARE</div>
            <h2 className="mb-5 text-4xl leading-[1.02] md:text-5xl" style={{ fontFamily: "var(--font-serif)" }}>
              You don&apos;t just consume.<br />You make things, too.
            </h2>
            <p className="mx-auto mb-8 max-w-md leading-relaxed text-muted-foreground">Start a project, add a small update, or make a note for yourself. None of it has to be public.</p>
            <Link to="/create"><Button variant="brand" size="lg"><Sparkles className="size-4" /> Make a start</Button></Link>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--hairline)] py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="ns-section-kicker mb-3">EARLY ACCESS</div>
          <h2 className="mb-2 text-2xl md:text-3xl" style={{ fontFamily: "var(--font-serif)" }}>Bring the hobby. We&apos;ll keep the record.</h2>
          <p className="mx-auto mb-6 max-w-md text-muted-foreground">NoSpace is free while the clubhouse grows.</p>
          <WaitlistForm />
        </div>
      </section>

      <footer className="border-t border-[var(--hairline)] py-10">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span
            className="text-lg text-[var(--forest)]"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            NoSpace
          </span>
          <span>Create, Don't Just Consume.</span>
        </div>
      </footer>
      </div>
    </div>
  );
}
