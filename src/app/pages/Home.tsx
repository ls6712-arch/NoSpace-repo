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

function CommunityHobbyScene({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 720 520"
      className={className}
      role="img"
      aria-label="A shared outdoor space where two friends play a board game, a man hikes, and a girl practices yoga"
    >
      <g transform="translate(0 12)">
        <g className="ns-drift" fill="#F8F4EB" opacity=".82">
          <ellipse cx="122" cy="76" rx="52" ry="22" />
          <ellipse cx="162" cy="62" rx="36" ry="18" />
          <ellipse cx="92" cy="66" rx="30" ry="16" />
        </g>
        <g className="ns-drift" style={{ animationDuration: "44s" }} fill="#F8F4EB" opacity=".68">
          <ellipse cx="570" cy="104" rx="42" ry="18" />
          <ellipse cx="604" cy="92" rx="28" ry="14" />
        </g>
        <circle cx="640" cy="70" r="25" fill="#F5C542" opacity=".92" />
      </g>

      <path d="M0 334c96-54 181-43 266-18 92 27 151 17 224-12 84-33 157-28 230 15v115H0Z" fill="#2C7A57" />
      <path d="M0 350c58-75 116-133 175-150 49 47 72 121 119 183 53-35 92-64 151-72 65-9 117 12 163 45v103H0Z" fill="#397B59" opacity=".94" />
      <path d="M0 383c84-44 165-34 242-12 94 27 166 23 246-4 81-27 159-21 232 11v96H0Z" fill="#1B6244" />
      <path d="M0 413c67-31 125-34 180-14 53 20 94 20 145 2 69-24 126-21 191 5 66 27 132 28 204 6v69H0Z" fill="#245F43" opacity=".88" />
      <ellipse cx="360" cy="455" rx="330" ry="67" fill="#0E4D3A" opacity=".72" />
      <path d="M342 520c-6-54 18-85 56-112 26-18 49-30 78-46" fill="none" stroke="#F5C542" strokeWidth="12" strokeLinecap="round" opacity=".82" />
      <path d="M360 520c3-39 26-74 59-97 26-18 48-29 71-42" fill="none" stroke="#E6B53F" strokeWidth="4" strokeLinecap="round" opacity=".9" />

      <g fill="#0E4D3A">
        <path d="M54 362h9v67h-9zM58 260l34 66H24ZM58 299l39 73H19Z" />
        <path d="M667 350h8v73h-8zM671 242l34 66h-68ZM671 284l40 75h-80Z" />
      </g>

      <g className="ns-breathe" style={{ animationDuration: "7.4s" }}>
        <ellipse cx="210" cy="411" rx="124" ry="18" fill="#0B3E2E" opacity=".24" />
        <path d="M127 346h21l-2 57h-17Z" fill="#0E4D3A" />
        <path d="M275 346h21l12 57h-17Z" fill="#0E4D3A" />
        <path d="M112 400h33l8 10h-47ZM280 400h33l13 10h-47Z" fill="#F8F4EB" />
        <path d="M96 338c0-14 11-24 28-24s29 10 29 24l-5 31h-48Z" fill="#FF6B4A" />
        <path d="M107 337c8 6 19 8 35 3M105 346c8 4 18 5 29 3" fill="none" stroke="#C43F22" strokeWidth="3" opacity=".7" />
        <path d="M268 336c0-15 11-25 29-25s29 10 29 25l-5 33h-49Z" fill="#5A88A8" />
        <path d="M278 338h39M286 330l9 8 9-8" fill="none" stroke="#D7E3E4" strokeWidth="3" opacity=".9" />
        <path d="M104 339c-18 8-20 19-14 30M146 339c17 10 20 19 17 31" stroke="#E8A87C" strokeWidth="11" strokeLinecap="round" fill="none" />
        <path d="M276 338c-17 8-23 18-24 30M315 338c16 8 21 18 22 29" stroke="#C68A5E" strokeWidth="11" strokeLinecap="round" fill="none" />
        <circle cx="94" cy="372" r="5" fill="#E8A87C" />
        <circle cx="163" cy="371" r="5" fill="#E8A87C" />
        <circle cx="124" cy="287" r="22" fill="#E8A87C" />
        <path d="M101 286c-2-20 10-32 25-32 16 0 28 11 26 28l-4 7c-6-10-15-15-26-15-8 0-15 4-21 12Z" fill="#0E4D3A" />
        <path d="M113 280c4-4 8-6 13-6M127 280c4-4 8-5 12-3" fill="none" stroke="#0E4D3A" strokeWidth="2" strokeLinecap="round" />
        <circle cx="117" cy="288" r="2" fill="#0E4D3A" />
        <circle cx="132" cy="288" r="2" fill="#0E4D3A" />
        <path d="M120 299c3 3 7 3 10 0" fill="none" stroke="#0E4D3A" strokeWidth="2" strokeLinecap="round" />
        <circle cx="296" cy="286" r="22" fill="#C68A5E" />
        <path d="M273 284c0-20 11-32 26-32 16 0 28 12 25 29-6-9-15-14-26-14-9 0-17 5-24 17Z" fill="#231F20" />
        <path d="M309 261c9 3 14 9 15 18" fill="none" stroke="#231F20" strokeWidth="8" strokeLinecap="round" />
        <circle cx="289" cy="287" r="2" fill="#0E4D3A" />
        <circle cx="304" cy="287" r="2" fill="#0E4D3A" />
        <path d="M292 299c3 3 7 3 10 0" fill="none" stroke="#0E4D3A" strokeWidth="2" strokeLinecap="round" />
      </g>

      <g>
        <path d="M121 354h183l-10 17H130Z" fill="#F8F4EB" stroke="#0E4D3A" strokeWidth="4" />
        <path d="M147 371v39M278 371v39" stroke="#0E4D3A" strokeWidth="7" strokeLinecap="round" />
        <rect x="159" y="343" width="105" height="16" rx="4" fill="#FF6B4A" transform="rotate(-4 211 351)" />
        <path d="M166 348h91" stroke="#C43F22" strokeWidth="2" opacity=".65" />
        <circle cx="181" cy="350" r="5" fill="#F5C542" />
        <circle cx="214" cy="347" r="5" fill="#2F76A8" />
        <circle cx="245" cy="350" r="5" fill="#0E4D3A" />
        <path d="M202 357l8-8 8 8-8 8ZM232 357l8-8 8 8-8 8Z" fill="#C43F22" />
        <path d="M189 357l7-7M260 356l7-7" stroke="#F5C542" strokeWidth="3" strokeLinecap="round" />
      </g>

      <g className="ns-breathe" style={{ animationDelay: "1.1s", animationDuration: "8s" }}>
        <ellipse cx="472" cy="351" rx="54" ry="12" fill="#0B3E2E" opacity=".2" />
        <path d="M454 286l-12 61 17 4 20-61Z" fill="#0E4D3A" />
        <path d="M483 288l20 61 16-5-18-62Z" fill="#0E4D3A" />
        <path d="M437 348c0-5 9-8 19-5l10 8-30 4ZM497 349c9-3 19 0 22 6l-27 2Z" fill="#F8F4EB" />
        <path d="M447 232c0-14 11-24 27-24s28 10 28 24l-7 59h-46Z" fill="#FF6B4A" />
        <path d="M449 246h49M457 232v48" stroke="#C43F22" strokeWidth="3" opacity=".7" />
        <path d="M449 237c-15 10-22 22-24 38M496 237c17 8 26 18 31 32" stroke="#E8A87C" strokeWidth="11" strokeLinecap="round" fill="none" />
        <circle cx="423" cy="276" r="5" fill="#E8A87C" />
        <circle cx="528" cy="270" r="5" fill="#E8A87C" />
        <circle cx="474" cy="198" r="23" fill="#C68A5E" />
        <path d="M452 197c0-19 10-30 25-30 16 0 25 12 24 29-10-8-27-10-49 1Z" fill="#231F20" />
        <path d="M454 184c7-13 19-18 31-14M495 181c5 5 7 10 7 17" fill="none" stroke="#231F20" strokeWidth="7" strokeLinecap="round" />
        <circle cx="466" cy="199" r="2" fill="#3A2A1F" />
        <circle cx="481" cy="199" r="2" fill="#3A2A1F" />
        <path d="M469 211c3 3 7 3 10 0" fill="none" stroke="#3A2A1F" strokeWidth="2" strokeLinecap="round" />
        <path d="M436 235c-15-16-12-39 5-53l28 21-10 52Z" fill="#F5C542" opacity=".88" />
        <path d="M442 210l23 9M451 198l23 11" stroke="#D39A2F" strokeWidth="3" opacity=".8" />
        <path d="M426 351l-14 23M516 351l16 20" stroke="#0E4D3A" strokeWidth="4" strokeLinecap="round" />
        <path d="M414 374l-13 8M532 371l14 7" stroke="#F8F4EB" strokeWidth="5" strokeLinecap="round" />
        <path d="M402 376l-9 42M540 371l14 42" stroke="#F5C542" strokeWidth="3" strokeLinecap="round" />
        <path d="M392 418l-3 4M554 413l3 4" stroke="#F8F4EB" strokeWidth="5" strokeLinecap="round" />
      </g>

      <g className="ns-breathe" style={{ animationDelay: "2.2s", animationDuration: "7.8s" }}>
        <rect x="526" y="438" width="147" height="8" rx="4" fill="#F8F4EB" opacity=".9" />
        <path d="M545 437h113" stroke="#F5C542" strokeWidth="3" opacity=".8" />
        <circle cx="590" cy="321" r="21" fill="#E8A87C" />
        <path d="M569 319c0-18 10-28 24-28 12 0 22 8 24 22-8-3-16-2-23 3-7 5-16 7-25 3Z" fill="#0E4D3A" />
        <path d="M607 302c21 1 24 17 9 25" fill="none" stroke="#0E4D3A" strokeWidth="8" strokeLinecap="round" />
        <path d="M580 314c4-3 8-3 12 0M592 314c4-3 8-2 11 1" fill="none" stroke="#0E4D3A" strokeWidth="2" strokeLinecap="round" />
        <circle cx="584" cy="321" r="2" fill="#0E4D3A" />
        <circle cx="599" cy="321" r="2" fill="#0E4D3A" />
        <path d="M587 333c3 2 6 2 9-1" fill="none" stroke="#0E4D3A" strokeWidth="2" strokeLinecap="round" />
        <path d="M574 345c0-13 7-22 17-22s18 9 18 22l-2 47h-34Z" fill="#FF6B4A" />
        <path d="M577 353h31M585 338l-3 47" stroke="#C43F22" strokeWidth="3" opacity=".65" />
        <path d="M578 347l-45 28M605 347l47 26" stroke="#E8A87C" strokeWidth="10" strokeLinecap="round" />
        <circle cx="533" cy="375" r="5" fill="#E8A87C" />
        <circle cx="652" cy="373" r="5" fill="#E8A87C" />
        <path d="M579 386l-34 48h25l37-39M602 386l43 48h25l-48-55Z" fill="#0E4D3A" />
        <path d="M575 394l-25 36M610 395l38 38" stroke="#2C7A57" strokeWidth="3" opacity=".8" />
        <path d="M534 434h34M646 434h31" stroke="#F8F4EB" strokeWidth="7" strokeLinecap="round" />
      </g>

      <g fill="#FF6B4A" className="ns-sway" style={{ animationDuration: "8s" }}>
        <circle cx="360" cy="437" r="7" />
        <circle cx="350" cy="447" r="6" />
        <circle cx="370" cy="447" r="6" />
      </g>
      <g fill="#F5C542" className="ns-twinkle">
        <path d="M382 236l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" />
        <path d="M594 222l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" />
      </g>
    </svg>
  );
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

  const marqueeHobbies = [
    { slug: "kitchentable", seed: "marquee-cooking", className: "ns-marquee-hobby-one" },
    { slug: "makerlab", seed: "marquee-making", className: "ns-marquee-hobby-two" },
    { slug: "inmotion", seed: "marquee-moving", className: "ns-marquee-hobby-three" },
    { slug: "rabbithole", seed: "marquee-playing", className: "ns-marquee-hobby-four" },
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
                <CommunityHobbyScene className="relative z-10 mx-auto h-auto w-full" />
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
