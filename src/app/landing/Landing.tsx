import { Link } from "react-router";
import { APP_NAME, CONTACT_EMAIL, INSTAGRAM_URL, TIKTOK_URL } from "../config";
import { useScrollReveal } from "../lib/useScrollReveal";
import { LANDING_ALT, LANDING_COPY as COPY } from "./copy";
import { hasLandingImage } from "./images";
import { PhoneFrame } from "./PhoneFrame";
import { usePublicShelves } from "../lib/publicShelves";
import "./landing.css";

function Reveal({ as: Tag = "div", className = "", children }: { as?: "div" | "section"; className?: string; children: React.ReactNode }) {
  const ref = useScrollReveal<HTMLDivElement>();
  return (
    <Tag ref={ref as never} className={`lp-reveal ${className}`}>
      {children}
    </Tag>
  );
}

function SignUpButton({ large = false }: { large?: boolean }) {
  return (
    <Link to="/onboarding" className={`lp-btn ${large ? "lp-btn-lg" : ""}`}>
      {COPY.signUp}
    </Link>
  );
}

function Nav() {
  return (
    <header className="lp-nav">
      <div className="lp-nav-inner">
        <Link to="/" className="lp-logo" aria-label={APP_NAME}>
          {APP_NAME}
        </Link>
        <div className="lp-nav-actions">
          <Link to="/login" className="lp-login">
            {COPY.logIn}
          </Link>
          <SignUpButton />
        </div>
      </div>
    </header>
  );
}

function Steps() {
  const shots = ["save", "try", "share"] as const;
  // The screens come back when all three are committed; until then the three steps stand as text.
  const withScreens = shots.every(hasLandingImage);
  return (
    <section className="lp-section lp-surface">
      <div className="lp-wide">
        <Reveal>
          <h2 className="lp-h2 lp-center">{COPY.stepsHeading}</h2>
          <div className={`lp-steps ${withScreens ? "" : "lp-steps-text"}`}>
            {COPY.steps.map((step, i) => (
              <div key={step.label} className="lp-step">
                {withScreens && <PhoneFrame image={shots[i]} alt={LANDING_ALT[shots[i]]} caption={COPY.exampleCaption} className="lp-phone-md" />}
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
  image: "comeAlong" | "privacy" | "reward";
  alt: string;
  /** Left out when the line stands alone, as in the reward section. */
  heading?: string;
  line: string;
  flip?: boolean;
  tone: "lp-surface" | "lp-surface-alt";
}) {
  // Without its screen the section is its text, centred.
  const withScreen = hasLandingImage(image);
  return (
    <section className={`lp-section ${tone}`}>
      <div className="lp-wide">
        <Reveal className={`lp-split ${flip ? "lp-split-flip" : ""} ${withScreen ? "" : "lp-split-text-only"}`}>
          <div className="lp-split-text">
            {heading && <h2 className="lp-h2">{heading}</h2>}
            <p className={heading ? undefined : "lp-statement"}>{line}</p>
          </div>
          {withScreen && <PhoneFrame image={image} alt={alt} caption={COPY.exampleScreenCaption} className="lp-phone-md" />}
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
  const lineRef = useScrollReveal<HTMLDivElement>();
  const heroShot = hasLandingImage("hero");

  return (
    <div className="lp">
      <div className="lp-body">
        <Nav />
        <main>
          <section className={`lp-hero ${heroShot ? "" : "lp-hero-solo"}`}>
            <div className="lp-hero-text">
              <h1>{COPY.heroHeadline}</h1>
              <p className="lp-hero-sub">{COPY.heroSub}</p>
              <SignUpButton large />
            </div>
            {heroShot && (
              <div className="lp-hero-phone">
                <PhoneFrame image="hero" alt={LANDING_ALT.hero} caption={COPY.exampleScreenCaption} priority />
              </div>
            )}
          </section>

          <section className={`lp-section lp-surface lp-line ${heroShot ? "" : "lp-line-no-phone"}`}>
            <div ref={lineRef} className="lp-reveal lp-center">
              <p>{COPY.line}</p>
            </div>
          </section>

          <Steps />

          <Split image="reward" alt={LANDING_ALT.reward} line={COPY.rewardLine} tone="lp-surface-alt" />
          <Split
            image="comeAlong"
            alt={LANDING_ALT.comeAlong}
            heading={COPY.comeAlongHeading}
            line={COPY.comeAlongLine}
            flip
            tone="lp-surface"
          />
          <Split
            image="privacy"
            alt={LANDING_ALT.privacy}
            heading={COPY.privacyHeading}
            line={COPY.privacyLine}
            tone="lp-surface-alt"
          />

          <RealShelves />

          <section id="invite" className="lp-section lp-invite lp-center">
            <Reveal>
              <div className="lp-copy">
                <h2 className="lp-h2">{COPY.joinHeading}</h2>
                <p style={{ margin: 0 }}>{COPY.joinLine}</p>
              </div>
              <div className="lp-invite-card">
                <SignUpButton large />
              </div>
            </Reveal>
          </section>
        </main>
        <Footer />
      </div>
    </div>
  );
}
