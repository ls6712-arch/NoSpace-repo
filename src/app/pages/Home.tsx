import { ReactNode, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Check, Mail, Quote, Sparkles, Users } from "lucide-react";
import { hobbies, getHobby } from "../data/hobbies";
import { seedPosts } from "../data/posts";
import { circles } from "../data/circles";
import { useContent } from "../context/ContentContext";
import { HobbyCategoryCard } from "../components/HobbyCategoryCard";
import { ContentCard } from "../components/ContentCard";
import { GeneratedArt } from "../components/GeneratedArt";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback } from "../components/ui/avatar";

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
  { value: "8", label: "Spaces, no feed sludge" },
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
          className="w-full rounded-full border border-white/15 bg-white/5 py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-white/30"
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
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div
          className={`grid md:grid-cols-2 gap-10 md:gap-16 items-center ${
            reverse ? "md:[&>*:first-child]:order-2" : ""
          }`}
        >
          <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 max-w-md">
            <div className="text-xs text-[#38BDF8] tracking-wide mb-3">{eyebrow}</div>
            <h2 className="text-3xl md:text-4xl mb-4">{title}</h2>
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
      {/* Hero */}
      <section className="relative overflow-hidden py-24 md:py-32">
        {/* Floating glow orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="animate-float-slow absolute -top-16 left-[8%] size-72 rounded-full bg-[#6366F1]/14 blur-[110px]" />
          <div className="animate-float-slower absolute top-1/3 right-[6%] size-80 rounded-full bg-[#38BDF8]/12 blur-[120px]" />
          <div className="animate-float-slow absolute bottom-0 left-1/3 size-64 rounded-full bg-[#D8739B]/10 blur-[110px]" />
        </div>

        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="max-w-3xl mx-auto">
            <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-muted-foreground mb-8">
              <span className="relative flex size-1.5">
                <span className="animate-pulse-soft inline-flex size-1.5 rounded-full bg-[#38BDF8]" />
              </span>
              Welcome to hobbymaxxing
            </div>
            <h1 className="animate-in fade-in slide-in-from-bottom-6 fill-mode-both duration-700 delay-150 text-5xl md:text-7xl mb-6 text-gradient-animated leading-[1.05]">
              Made something today?
              <br />
              <span className="block">Show it.</span>
            </h1>
            <p
              className="animate-in fade-in slide-in-from-bottom-6 fill-mode-both duration-700 delay-300 text-2xl md:text-3xl mb-4"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Create, Don't Just Consume.
            </p>
            <p className="animate-in fade-in slide-in-from-bottom-6 fill-mode-both duration-700 delay-500 text-muted-foreground text-lg mb-3 max-w-xl mx-auto">
              Pick a hobby, share what you're actually making, and find people doing
              the same thing.
            </p>
            <p className="animate-in fade-in fill-mode-both duration-700 delay-700 text-sm text-muted-foreground/70 mb-10 max-w-xl mx-auto">
              Real people. Real progress. Real output.
            </p>
            <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 delay-700 flex flex-wrap items-center justify-center gap-3">
              <Link to="/create">
                <Button variant="brand" size="lg">
                  Start creating
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link to="/discover">
                <Button variant="outline" size="lg">
                  Explore hobbies
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Hobbymaxxing marquee — big, always moving, like Fable's book carousel */}
      <div className="relative overflow-hidden border-y border-white/10 py-6 md:py-8">
        <div className="flex w-max animate-marquee">
          {[0, 1].map((rep) => (
            <div key={rep} className="flex items-center shrink-0" aria-hidden={rep === 1}>
              {Array.from({ length: 4 }).map((_, i) => (
                <span key={i} className="flex items-center shrink-0">
                  <span
                    className="mx-6 text-5xl md:text-7xl font-semibold text-gradient-brand"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    HOBBYMAXXING
                  </span>
                  <span className="text-3xl md:text-5xl text-muted-foreground/40">·</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Hobby categories */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-3xl mb-2">Eight spaces, zero scrolling void</h2>
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
        title="Log it. Reflect for a second. Then decide who sees it."
        copy="Every post follows the same loop: log what you made, jot a private reflection that's never shown publicly, then choose your audience before you earn anything. Rewards never gate creating — they just add texture to it."
        visual={
          <div className="glass-panel rounded-3xl p-6 space-y-3">
            {[
              { n: "1", label: "Log", desc: "Post a photo or video of what you made" },
              { n: "2", label: "Reflect", desc: "A private note — only you ever see it" },
              { n: "3", label: "Share", desc: "Friends, a circle, or public — your call, per post" },
            ].map((step) => (
              <div
                key={step.n}
                className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3"
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
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3"
              >
                <div>
                  <div className="text-sm">{circle.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Users className="size-3" />
                    {circle.location} · {circle.memberCount} members
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-xs text-muted-foreground">
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
            <div className="text-xs text-muted-foreground mb-4 font-hud">Level 3 on NoSpace</div>
            <div className="flex flex-wrap gap-2 mb-4">
              {["Workbench", "The Studio", "Kitchen Table"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted-foreground"
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

      {/* What people are making */}
      <section className="py-16 border-y border-white/10 bg-white/[0.02]">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl text-center mb-2">What people are making</h2>
          <p className="text-muted-foreground text-center mb-12">
            Real captions, real people, eight real spaces.
          </p>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {testimonialPosts.map((post, i) => (
              <div
                key={post.id}
                className="glass-panel rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <Quote className="size-5 text-muted-foreground mb-3" />
                <p className="text-sm mb-4">"{post.caption}"</p>
                <div className="flex items-center gap-2">
                  <Avatar className="size-7">
                    <AvatarFallback className="text-[10px]">{initials(post.creator)}</AvatarFallback>
                  </Avatar>
                  <div className="text-xs text-muted-foreground">
                    {post.creator} · {getHobby(post.hobbySlug)?.shortName}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trending */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-3xl mb-2">Fresh across NoSpace</h2>
              <p className="text-muted-foreground">
                Recent posts from every space, weighted toward what you're actually into —
                not just what's most liked.
              </p>
            </div>
            <Link to="/create" className="hidden sm:block">
              <Button variant="outline">
                Post your own
              </Button>
            </Link>
          </div>
          <div className="columns-2 md:columns-3 gap-4">
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
        <section className="py-16 border-t border-white/10 bg-white/[0.02]">
          <div className="container mx-auto px-4">
            <div className="mb-8">
              <h2 className="text-3xl mb-2">Explore next</h2>
              <p className="text-muted-foreground">
                Spaces you haven't posted in or joined a circle for yet.
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

      {/* Stats */}
      <section className="py-16 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center max-w-3xl mx-auto">
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="font-hud text-4xl md:text-5xl mb-2 text-gradient-brand">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
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
              Post your first piece of content and earn 50 points on the spot — plus your
              first badge.
            </p>
            <Link to="/create">
              <Button variant="brand" size="lg">
                <Sparkles className="size-4" />
                Create your first post
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Waitlist */}
      <section className="py-16 border-t border-white/10 bg-white/[0.02]">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl mb-2">Free in early access</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Bring the hobby — points, badges, and buyers come with it.
          </p>
          <WaitlistForm />
        </div>
      </section>

      <footer className="border-t border-white/10 py-10">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span className="text-gradient-brand" style={{ fontFamily: "var(--font-heading)" }}>
            NoSpace
          </span>
          <span>Create, Don't Just Consume.</span>
        </div>
      </footer>
    </div>
  );
}
