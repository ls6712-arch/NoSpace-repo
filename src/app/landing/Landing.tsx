import { useRef, useState, type MouseEvent } from "react";
import { Link } from "react-router";
import { APP_NAME, CONTACT_EMAIL, INSTAGRAM_URL, TIKTOK_URL } from "../config";
import { WaitlistForm } from "../components/WaitlistForm";
import { useScrollReveal } from "../lib/useScrollReveal";
import { scrollBehavior } from "../lib/scrollToElement";
import { LANDING_ALT, LANDING_COPY as COPY } from "./copy";
import { hasLandingImage } from "./images";
import { PhoneFrame } from "./PhoneFrame";
import { useLiveGradient } from "./useLiveGradient";
import { usePublicShelves } from "../lib/publicShelves";
import gradientStatic from "./gradient-static.webp";
import "./landing.css";

const HEADING_FONT_URL =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&display=swap";

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Reveal({ as: Tag = "div", className = "", children }: { as?: "div" | "section"; className?: string; children: React.ReactNode }) {
  const ref = useScrollReveal<HTMLDivElement>();
  return (
    <Tag ref={ref as never} className={`lp-reveal ${className}`}>
      {children}
    </Tag>
  );
}

function RequestInviteButton({ large = false }: { large?: boolean }) {
  // A plain href="#invite" would set location.hash, which the HashRouter reads
  // as a route. Scroll to the waitlist form instead.
  const go = (e: MouseEvent) => {
    e.preventDefault();
    document.getElementById("invite")?.scrollIntoView({ behavior: scrollBehavior() });
  };
  return (
    <a href="#invite" onClick={go} className={`lp-btn ${large ? "lp-btn-lg" : ""}`}>
      {COPY.requestInvite}
    </a>
  );
}

function Nav() {
  return (
    <header className="lp-nav">
      <div className="lp-nav-inner">
        <Link to="/" className="lp-logo" aria-label={APP_NAME}>
          {APP_NAME}
        </Link>
        <RequestInviteButton />
      </div>
    </header>
  );
}

function Steps() {
  const shots = ["save", "try", "share"] as const;
  if (!shots.every(hasLandingImage)) return null;
  return (
    <section className="lp-section lp-surface">
      <div className="lp-wide">
        <Reveal>
          <h2 className="lp-h2 lp-center">{COPY.stepsHeading}</h2>
          <div className="lp-steps">
            {COPY.steps.map((step, i) => (
              <div key={step.label} className="lp-step">
                <PhoneFrame image={shots[i]} alt={LANDING_ALT[shots[i]]} className="lp-phone-md" />
                <h3 className="lp-step-label">{step.label}</h3>
                <p>{step.line}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Split({
  image,
  alt,
  heading,
  line,
  flip = false,
  tone,
}: {
  image: "comeAlong" | "privacy";
  alt: string;
  heading: string;
  line: string;
  flip?: boolean;
  tone: "lp-surface" | "lp-surface-alt";
}) {
  if (!hasLandingImage(image)) return null;
  return (
    <section className={`lp-section ${tone}`}>
      <div className="lp-wide">
        <Reveal className={`lp-split ${flip ? "lp-split-flip" : ""}`}>
          <div className="lp-split-text">
            <h2 className="lp-h2">{heading}</h2>
            <p>{line}</p>
          </div>
          <PhoneFrame image={image} alt={alt} className="lp-phone-md" />
        </Reveal>
      </div>
    </section>
  );
}

function RealShelves() {
  // Hidden until enough real public Shelves exist (usePublicShelves).
  const shelves = usePublicShelves();
  if (!shelves?.length) return null;
  return (
    <section className="lp-section lp-surface">
      <div className="lp-wide">
        <Reveal>
          <h2 className="lp-h2 lp-center">{COPY.shelvesHeading}</h2>
          <div className="lp-shelves">
            {shelves.map((s) => (
              <Link key={s.id} to={s.path} className="lp-shelf">
                {/* design-token-ignore: plain img, no fallback art on the landing page */}
                <img src={s.photoUrl} alt="" loading="lazy" decoding="async" />
                <div className="lp-shelf-text">
                  <span className="lp-shelf-name">{s.firstName}</span>: {s.interests.join(", ")}
                </div>
              </Link>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  const links: { label: string; href: string; external?: boolean }[] = [
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Terms", href: "/terms" },
    ...(CONTACT_EMAIL ? [{ label: "Contact", href: `mailto:${CONTACT_EMAIL}`, external: true }] : []),
    ...(INSTAGRAM_URL ? [{ label: "Instagram", href: INSTAGRAM_URL, external: true }] : []),
    ...(TIKTOK_URL ? [{ label: "TikTok", href: TIKTOK_URL, external: true }] : []),
  ];
  return (
    <footer className="lp-footer">
      <nav aria-label="Footer">
        {links.map((l) =>
          l.external ? (
            <a key={l.label} href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
              {l.label}
            </a>
          ) : (
            <Link key={l.label} to={l.href}>
              {l.label}
            </Link>
          ),
        )}
      </nav>
    </footer>
  );
}

/** The signed-out home page. Rendered by Home.tsx; it brings its own nav. */
export function Landing() {
  const heroRef = useRef<HTMLElement>(null);
  const inviteRef = useRef<HTMLElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const [reduced] = useState(reducedMotion);
  const live = useLiveGradient(liveRef, [heroRef, inviteRef], !reduced);
  const lineRef = useScrollReveal<HTMLDivElement>();
  const heroShot = hasLandingImage("hero");

  return (
    <div className="lp">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={HEADING_FONT_URL} />

      <div className="lp-backdrop" aria-hidden="true">
        {/* design-token-ignore: bundled static gradient, needs fetchPriority */}
        <img className="lp-backdrop-img" src={gradientStatic} alt="" fetchPriority="high" decoding="async" />
        <div ref={liveRef} className={`lp-backdrop-live ${live ? "is-ready" : ""}`} />
      </div>

      <div className="lp-body">
        <Nav />
        <main>
          <section ref={heroRef} className="lp-hero">
            <div className="lp-hero-text">
              <h1>{COPY.heroHeadline}</h1>
              <p className="lp-hero-sub">{COPY.heroSub}</p>
              <RequestInviteButton large />
            </div>
            {heroShot && (
              <div className="lp-hero-phone">
                <PhoneFrame image="hero" alt={LANDING_ALT.hero} priority />
              </div>
            )}
          </section>

          <section className={`lp-section lp-surface lp-line ${heroShot ? "" : "lp-line-no-phone"}`}>
            <div ref={lineRef} className="lp-reveal lp-center">
              <p>{COPY.line}</p>
            </div>
          </section>

          <Steps />

          <Split
            image="comeAlong"
            alt={LANDING_ALT.comeAlong}
            heading={COPY.comeAlongHeading}
            line={COPY.comeAlongLine}
            tone="lp-surface-alt"
          />
          <Split
            image="privacy"
            alt={LANDING_ALT.privacy}
            heading={COPY.privacyHeading}
            line={COPY.privacyLine}
            flip
            tone="lp-surface"
          />

          <RealShelves />

          <section id="invite" ref={inviteRef} className="lp-section lp-invite lp-center">
            <Reveal>
              <div className="lp-copy">
                <h2 className="lp-h2">{COPY.inviteHeading}</h2>
                <p style={{ margin: 0 }}>{COPY.inviteLine}</p>
              </div>
              <div className="lp-invite-card lp-light">
                <WaitlistForm buttonVariant="coral" />
              </div>
            </Reveal>
          </section>
        </main>
        <Footer />
      </div>
    </div>
  );
}
