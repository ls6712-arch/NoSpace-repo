import { ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Check, Mail, Quote, Sparkles, Users } from "lucide-react";
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

// Demo/placeholder figures, like the rest of this prototype's seed data —
// not real platform numbers.
const STATS = [
  { value: "48K+", label: "Things created" },
  { value: "8", label: "Spaces, no endless scroll" },
  { value: "180+", label: "Hobbies represented" },
];

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
    <section className="py-14 lg:py-18">
      <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 xl:px-16">
        <div
          className={`grid md:grid-cols-2 gap-10 md:gap-16 items-center ${
            reverse ? "md:[&>*:first-child]:order-2" : ""
          }`}
        >
          <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 max-w-lg">
            <div className="text-xs text-[var(--coral-text)] tracking-wide mb-3">{eyebrow}</div>
            <h2 className="text-3xl md:text-4xl mb-4" style={{ fontFamily: "var(--font-serif)" }}>{title}</h2>
            <p className="text-muted-foreground mb-6">{copy}</p>
            {cta && ctaTo && (
              <Link to={ctaTo}>
                <Button variant="outline">
                  {cta}
                  <ArrowRight className="size-4" />
                </Button>
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

  return (
    <div className="min-h-screen">
      {/* ── Hero ──────────────────────────────────────────────────────────
          Composed for the desktop first: a wide two-column band where the
          type occupies the left third and the illustration is given real
          horizontal room on the right, so the two read as one picture rather
          than a centred column with a graphic tacked underneath. It collapses
          to a single stacked column below 1024px. */}
      <section className="relative isolate overflow-hidden">
        <div className="mx-auto w-full max-w-[1440px] px-5 pt-12 pb-4 sm:px-8 sm:pt-16 lg:px-12 lg:pt-24 lg:pb-16 xl:px-16">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,1fr)] lg:gap-10 xl:gap-14">
            {/* Type column */}
            <div className="text-center lg:text-left">
              <div className="ns-enter ns-enter-1 mb-6 inline-flex items-center gap-2 rounded-full bg-surface px-4 py-1.5 text-xs text-foreground lg:mb-8">
                <span className="animate-pulse-soft inline-flex size-1.5 rounded-full bg-[var(--coral-deep)]" />
                Welcome to hobbymaxxing
              </div>

              <h1
                className="ns-enter ns-enter-1 mb-5 text-[clamp(2.4rem,4.6vw,3.85rem)] font-semibold leading-[1.02] tracking-[-0.02em] text-balance text-[var(--forest)] lg:mb-6"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Made something today?
                <br />
                <span className="relative inline-block">
                  Show it.
                  {/* Hand-drawn underline — the one flourish in the hero. */}
                  <svg
                    className="pointer-events-none absolute -bottom-1 left-0 h-[0.28em] w-full lg:-bottom-2"
                    viewBox="0 0 220 14"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 10C46 4 122 2 217 6"
                      fill="none"
                      stroke="var(--coral-deep)"
                      strokeWidth="6"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>

              <p
                className="ns-enter ns-enter-2 mb-4 text-xl text-foreground sm:text-2xl"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Create, Don't Just Consume.
              </p>

              <p className="ns-enter ns-enter-2 mx-auto mb-5 max-w-md text-base text-foreground/90 sm:text-lg lg:mx-0 lg:max-w-lg">
                Pick a hobby, share what you're actually making, and find people
                doing the same thing.
              </p>

              {/* Three claims, three chips — reads as a promise, not a stat bar. */}
              <ul className="ns-enter ns-enter-3 mb-8 flex flex-wrap justify-center gap-1.5 lg:justify-start">
                {["Real people", "Real progress", "Real output"].map((claim) => (
                  <li
                    key={claim}
                    className="rounded-full bg-surface px-3 py-1 text-xs text-foreground"
                  >
                    {claim}
                  </li>
                ))}
              </ul>

              {/* This page is the wordmark's destination for everyone, so a
                  signed-in person needs a way straight back to their own feed
                  rather than only an invitation to start. */}
              <div className="ns-enter ns-enter-3 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <Link to="/create">
                  <Button variant="coral" size="lg">
                    Start creating
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
                {user && (
                  <Link
                    to="/my-space"
                    className="inline-flex h-11 items-center rounded-full bg-surface px-6 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-[var(--surface-muted)]"
                  >
                    Go to My Space
                  </Link>
                )}
                <Link
                  to="/discover"
                  className="inline-flex h-11 items-center rounded-full bg-surface px-6 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-[var(--surface-muted)]"
                >
                  Explore hobbies
                </Link>
              </div>
            </div>

            {/* Illustration column */}
            <div ref={parallaxRef} className="ns-parallax ns-enter ns-enter-4 will-change-transform">
              <HeroScene className="mx-auto w-full max-w-[560px] lg:max-w-none" />
            </div>
          </div>
        </div>

        {/* The sky meets the cream page on a soft ridge rather than a hard
            edge, so the hero and the content below it feel like one world. */}
        <svg
          className="-mb-px block w-full"
          viewBox="0 0 1440 96"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0 96V52c214-32 430-44 648-34 106 5 210 17 312 26 168 15 328 12 480-10v62Z"
            fill="var(--cream)"
          />
        </svg>
      </section>

      {/* Hobbymaxxing marquee — big, always moving, like Fable's book carousel */}
      <div className="relative overflow-hidden bg-surface py-5 md:py-7">
        <div className="flex w-max animate-marquee">
          {[0, 1].map((rep) => (
            <div key={rep} className="flex items-center shrink-0" aria-hidden={rep === 1}>
              {Array.from({ length: 4 }).map((_, i) => (
                <span key={i} className="flex items-center shrink-0">
                  <span
                    className="mx-6 text-4xl font-semibold text-[var(--forest)] md:text-6xl"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    HOBBYMAXXING
                  </span>
                  <span className="text-3xl text-[var(--coral-deep)] md:text-5xl">·</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Everything below the hero sits on cream. The sky is the world the
          brand lives in; cream is where text is actually read — muted copy on
          the saturated blue only clears 2.64:1, which is why body content
          gets its own ground rather than floating on the background. */}
      <div className="bg-surface">
      {/* Hobby categories */}
      <section className="py-16 lg:py-20">
        <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 xl:px-16">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-3xl mb-2">Fifteen Spaces, zero scrolling void</h2>
              <p className="text-muted-foreground">Pick one to see what people are making right now.</p>
            </div>
            <Link to="/discover" className="hidden sm:block">
              <Button variant="outline">
                All {hobbies.reduce((n, h) => n + h.subItems.length, 0)} hobbies
                <ArrowRight className="size-4" />
              </Button>
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
          <div className="glass-panel rounded-3xl p-6 space-y-3">
            {[
              { n: "1", label: "Create", desc: "A photo, a note, or a small update" },
              { n: "2", label: "Reflect", desc: "A private note — only you ever see it" },
              { n: "3", label: "Share", desc: "Only you, your connections, a Circle, or everyone" },
            ].map((step) => (
              <div
                key={step.n}
                className="flex items-center gap-3 rounded-xl border border-border px-4 py-3"
              >
                <span className="font-hud flex size-7 shrink-0 items-center justify-center rounded-full text-xs text-white [background-image:var(--gradient-brand)]">
                  {step.n}
                </span>
                <div>
                  <div className="text-sm">{step.label}</div>
                  <div className="text-xs text-muted-foreground">{step.desc}</div>
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
          <div className="glass-panel rounded-3xl p-6 space-y-3">
            {circleSample.map((circle) => (
              <div
                key={circle.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
              >
                <div>
                  <div className="text-sm">{circle.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Users className="size-3" />
                    {circle.location} · {circle.memberCount} members
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                  Join
                </span>
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
          <div className="glass-panel rounded-3xl p-6">
            <div className="font-hud text-2xl mb-1 text-gradient-brand">12 things created</div>
            <div className="text-xs text-muted-foreground mb-4">3 months into pottery</div>
            <div className="flex flex-wrap gap-2 mb-4">
              {["Workbench", "The Studio", "Kitchen Table"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {portfolioSample.map((post) => (
                <div key={post.id} className="aspect-square overflow-hidden rounded-md">
                  <GeneratedArt hobbySlug={post.hobbySlug} seed={post.id} className="h-full w-full" />
                </div>
              ))}
            </div>
          </div>
        }
      />

      {/* What people are making — the one dark band on the page, so the
          cream cards and the coral reactions carry real weight. */}
      <section className="py-16 lg:py-20 [background-color:var(--forest)]">
        <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <h2
            className="text-3xl text-center mb-2 text-[var(--on-forest)] lg:text-4xl"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            What people are making
          </h2>
          <p className="text-center mb-12 text-[var(--on-forest-muted)]">
            Real captions, real people, eight real spaces.
          </p>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {testimonialPosts.map((post, i) => (
              <div
                key={post.id}
                className="rounded-2xl bg-surface p-6 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <Quote className="size-5 text-[var(--coral-text)] mb-3" />
                <p className="text-sm mb-4">"{post.caption}"</p>
                <div className="flex items-center gap-2 mb-4">
                  <Avatar className="size-7">
                    <AvatarFallback className="text-[10px]">{initials(post.creator)}</AvatarFallback>
                  </Avatar>
                  <div className="text-xs text-muted-foreground">
                    {post.creator} · {getHobby(post.hobbySlug)?.shortName}
                  </div>
                </div>
                {/* Same five reactions as every other post surface. */}
                <PostReactions postId={post.id} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trending */}
      <section className="py-16 lg:py-20">
        <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 xl:px-16">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-3xl mb-2">Fresh across NoSpace</h2>
              <p className="text-muted-foreground">
                Recent work from every space, weighted toward what you're actually into —
                never toward whatever got the most attention.
              </p>
            </div>
            <Link to="/create" className="hidden sm:block">
              <Button variant="outline">
                Create your own
              </Button>
            </Link>
          </div>
          <div className="columns-1 sm:columns-2 md:columns-3 xl:columns-4 gap-4">
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

      {/* Explore next */}
      {exploreNext.length > 0 && (
        <section className="py-16 border-t border-[var(--hairline)] lg:py-20">
          <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 xl:px-16">
            <div className="mb-8">
              <h2 className="text-3xl mb-2">Explore next</h2>
              <p className="text-muted-foreground">
                Spaces you haven't logged anything in or joined a Circle for yet.
              </p>
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

      {/* Stats — the sky returns as a full-width band. Figures are display
          size in forest (3.76:1, clears the 3:1 large-text bar) and the
          labels step down to forest-ink (4.62:1) rather than muted, which
          would be unreadable on this blue. */}
      <section className="py-16 [background-color:var(--sky)] lg:py-20">
        <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center max-w-4xl mx-auto">
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div
                  className="mb-2 text-5xl font-semibold text-[var(--forest)] md:text-6xl"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {stat.value}
                </div>
                <div className="text-sm text-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="glass-panel glow-violet rounded-3xl p-10 md:p-14 text-center max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl mb-4">
              You don't just consume. You create too.
            </h2>
            <p className="text-muted-foreground mb-8">
              Start a project, add an update, or just write a note to yourself. None of it
              has to be public.
            </p>
            <Link to="/create">
              <Button variant="brand" size="lg">
                <Sparkles className="size-4" />
                Create something
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Waitlist */}
      <section className="py-16 border-t border-[var(--hairline)]">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl mb-2">Free in early access</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Bring the hobby. We'll keep the record.
          </p>
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
