
import { Link } from "react-router";
import { Camera, LayoutGrid, Share2 } from "lucide-react";
import { WorldsSection } from "../components/WorldsSection";
import { Button } from "../components/ui/button";
import { useScrollReveal } from "../lib/useScrollReveal";
import { useAuth } from "../context/AuthContext";
import { ImageWithFallback } from "../components/ImageWithFallback";
import { APP_NAME, CONTACT_EMAIL, landingShowsSpaces } from "../config";
import { Landing } from "../landing/Landing";

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

/**
 * "/" is the signed-out landing page for visitors and the members' welcome
 * page for everyone signed in. Roots hides the member nav on the landing page.
 */
export function Home() {
  const { user } = useAuth();
  return user ? <MemberHome /> : <Landing />;
}

function MemberHome() {
  const howRef = useScrollReveal<HTMLElement>();
  const pursuitsRef = useScrollReveal<HTMLElement>();
  const friendsRef = useScrollReveal<HTMLElement>();
  const finalCtaRef = useScrollReveal<HTMLElement>();

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
            <Link to="/create">
              <Button variant="coral" size="lg">
                Log a Moment
              </Button>
            </Link>
          </div>
          <p className="ns-enter ns-enter-3 mt-4 text-small text-foreground/70">
            {APP_NAME} is for people 16 and older.
          </p>
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

        {/* 6. Log a Moment */}
        <section ref={finalCtaRef} className="ns-reveal py-12 lg:py-section-hero">
          <div className="mx-auto max-w-md px-5 text-center">
            <Link to="/create">
              <Button variant="brand" size="lg">
                Log a Moment
              </Button>
            </Link>
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
          <nav aria-label="Product" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-small text-muted-foreground">
              <Link to="/discover" className="hover:text-foreground">Discover</Link>
              <Link to="/my-space" className="hover:text-foreground">Home</Link>
              <Link to="/create" className="hover:text-foreground">Log a Moment</Link>
            </nav>
          <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-small text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/privacy-policy" className="hover:text-foreground">Privacy Policy</Link>
            {CONTACT_EMAIL && <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-foreground">Contact</a>}
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
