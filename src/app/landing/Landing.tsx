import { useRef, useState, type RefObject } from "react";
import { Link } from "react-router";
import { APP_NAME, CONTACT_EMAIL, INSTAGRAM_URL, TIKTOK_URL } from "../config";
import { LANDING_COPY as COPY } from "./copy";
import { LandingStubby, type StubbyHandle } from "./LandingStubby";
import { useOnceInView, replayClass } from "./motion";
import { DemoStage, HeroStage } from "./PickStages";
import { LandingPhoto } from "./LandingPhoto";
import { PHOTOS, usedCredits, type PhotoKey } from "./photos";
import "./landing.css";

/** The six Shelf colors, in order, as app tokens. */
const STUB_TONES = ["orange", "violet", "lime", "amber", "blue", "rose"] as const;

function SignUpButton({ large = false, children = COPY.signUp, id }: { large?: boolean; children?: string; id?: string }) {
  return (
    <Link id={id} to="/onboarding" className={`lp-btn ${large ? "lp-btn-lg" : ""}`}>
      {children}
    </Link>
  );
}

function Nav() {
  return (
    <header className="lp-nav">
      <div className="lp-nav-inner">
        <Link
          to="/"
          className="lp-logo"
          aria-label={APP_NAME}
          onMouseEnter={(e) => replayClass(e.currentTarget.querySelector(".lp-logo-mark"), "lp-hop", 700)}
        >
          <span className="lp-logo-mark" aria-hidden="true">
            <LandingStubby size={32} />
          </span>
          {APP_NAME}
        </Link>
        <nav className="lp-nav-links" aria-label="Sections">
          {COPY.navLinks.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
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

/** Stubby's line at the top of a section: a caption beside a small Stubby that hops once as it arrives. */
function Says({ text, stubbyRef, onDark = false }: { text: string; stubbyRef?: RefObject<StubbyHandle>; onDark?: boolean }) {
  const own = useRef<StubbyHandle>(null);
  const sb = stubbyRef ?? own;
  const view = useOnceInView<HTMLDivElement>(() => window.setTimeout(() => sb.current?.hop(), 150), 1);
  return (
    <div ref={view} className="lp-says">
      <LandingStubby ref={sb} size={96} onDark={onDark} />
      <p className="lp-caption">{text}</p>
    </div>
  );
}

function Hero() {
  return (
    <section className="lp-hero">
      <div className="lp-wide lp-hero-grid">
        <div className="lp-hero-text">
          <span className="lp-city">
            <i aria-hidden="true" />
            {COPY.city}
          </span>
          <h1>
            {COPY.heroLead}
            <span>{COPY.heroName}</span>
            {COPY.heroTail}
          </h1>
          <p className="lp-hero-sub">{COPY.heroSub}</p>
          <div className="lp-cta-row">
            <SignUpButton large>{COPY.heroCta}</SignUpButton>
            <a className="lp-btn lp-btn-lg lp-btn-ghost" href="#how">
              {COPY.heroSecondary}
            </a>
          </div>
        </div>
        <HeroStage />
      </div>
    </section>
  );
}

function Nights() {
  return (
    <section className="lp-section lp-band">
      <div className="lp-wide lp-nights-grid">
        <div className="lp-texts" role="group" aria-label={COPY.chatLabel}>
          {COPY.chat.map((m) => (
            <div key={m.text} className={`lp-text ${m.out ? "lp-text-out" : ""}`}>
              {m.text}
              <small>{m.when}</small>
            </div>
          ))}
        </div>
        <div className="lp-nights-copy">
          <h2 className="lp-h2">{COPY.nightsHeading}</h2>
          <p className="lp-big">
            {COPY.nightsBigLead}
            <span>{COPY.nightsBigAccent}</span>
            {COPY.nightsBigTail}
          </p>
          <p className="lp-small-light">{COPY.nightsSmall}</p>
        </div>
      </div>
    </section>
  );
}

function Solo() {
  return (
    <section id="solo" className="lp-section lp-surface">
      <div className="lp-wide">
        <Says text={COPY.soloSays} />
        <div className="lp-solo-head">
          <h2 className="lp-h2">{COPY.soloHeading}</h2>
          <p>{COPY.soloLine}</p>
        </div>
        <div className="lp-solo-list">
          {COPY.solo.map((s) => (
            <article key={s.title} className="lp-solo">
              <span className="lp-tag">{s.tag}</span>
              <h3>{s.title}</h3>
              <p>{s.line}</p>
              <div className="lp-tip">
                <LandingStubby size={40} />
                <span>{s.tip}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Demo() {
  return (
    <section className="lp-section lp-surface lp-demo-section">
      <div className="lp-wide lp-demo">
        <div className="lp-demo-copy">
          <h2 className="lp-h2">{COPY.demoHeading}</h2>
          <p>{COPY.demoLine}</p>
        </div>
        <DemoStage />
      </div>
    </section>
  );
}

function How() {
  return (
    <section id="how" className="lp-section lp-surface-alt lp-how">
      <div className="lp-wide">
        <Says text={COPY.howSays} />
        <h2 className="lp-h2">{COPY.howHeading}</h2>
        <ol className="lp-steps">
          {COPY.steps.map((s) => (
            <li key={s.title} className="lp-step">
              <h3>{s.title}</h3>
              <p>{s.line}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function StubbySection() {
  const sb = useRef<StubbyHandle>(null);
  return (
    <section id="stubby" className="lp-section lp-surface">
      <div className="lp-wide lp-stubby-grid">
        <div className="lp-stubby-copy">
          <h2 className="lp-h2">{COPY.stubbyHeading}</h2>
          <p>{COPY.stubbyLine}</p>
          <ul className="lp-rules">
            {COPY.stubbyRules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
        <div className="lp-stubby-stage">
          <LandingStubby ref={sb} size={300} tappable label={COPY.stubbyLabel} />
          <span className="lp-tag">{COPY.stubbyCaption}</span>
        </div>
      </div>
    </section>
  );
}

function Keep() {
  const sb = useRef<StubbyHandle>(null);
  const [dropped, setDropped] = useState(false);
  // The newest Stub drops onto the Shelf, then the Stubby above it celebrates.
  const newest = useOnceInView<HTMLDivElement>(() => {
    setDropped(true);
    window.setTimeout(() => sb.current?.happy(16), 500);
  }, 0.8);
  return (
    <section id="keep" className="lp-section lp-band">
      <div className="lp-wide lp-keep-grid">
        <div>
          <Says text={COPY.keepSays} stubbyRef={sb} onDark />
          <h2 className="lp-h2 lp-keep-h2">
            {COPY.keepA}
            <span>{COPY.keepB}</span>
            {COPY.keepC}
          </h2>
          <p className="lp-lede-light">{COPY.keepLede}</p>
          <blockquote className="lp-quote">{COPY.keepQuote}</blockquote>
        </div>
        <div className="lp-shelf" role="group" aria-label={COPY.shelfName}>
          <div className="lp-shelf-label">
            <span>{COPY.shelfLabel}</span>
            <span>{COPY.shelfExample}</span>
          </div>
          {COPY.stubs.map((s, i) => {
            const last = i === COPY.stubs.length - 1;
            return (
              <div
                key={s.title}
                ref={last ? newest : undefined}
                className={`lp-stub lp-stub-${STUB_TONES[i % STUB_TONES.length]} ${last && dropped ? "lp-stub-new" : ""}`}
              >
                <div className="lp-stub-photo">
                  <LandingPhoto image={s.image} widths={[400, 800]} sizes="(min-width: 960px) 150px, 30vw" />
                  <div className="lp-stub-pills">
                    <span className="lp-pill-tag">{s.tag}</span>
                    <span className="lp-pill-tag">{s.who}</span>
                  </div>
                </div>
                <div className="lp-stub-body">
                  <b>{s.title}</b>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Ask() {
  return (
    <section id="ask" className="lp-section lp-surface">
      <div className="lp-wide lp-ask-grid">
        <div>
          <Says text={COPY.askSays} />
          <h2 className="lp-ask-h2">
            {COPY.askLead}
            <span>{COPY.askAccent}</span>
          </h2>
          <p className="lp-lede">{COPY.askLede}</p>
          <ul className="lp-spread">
            {COPY.spread.map((s) => (
              <li key={s.title}>
                <b>{s.title}</b>
                <span>{s.line}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="lp-phone" role="group" aria-label={COPY.phoneLabel}>
          <span className="lp-tag lp-phone-tag">{COPY.phoneTag}</span>
          <div className="lp-msg lp-msg-card">
            <div>
              <small>{COPY.stubCard.tag}</small>
              <b>{COPY.stubCard.title}</b>
            </div>
            <p>{COPY.stubCard.from}</p>
          </div>
          {COPY.texts.map((m) => (
            <div key={m.text} className={`lp-msg ${m.out ? "lp-msg-out" : ""}`}>
              {m.text}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="lp-section lp-surface-alt">
      <div className="lp-wide lp-faq">
        <div>
          <Says text={COPY.faqSays} />
          <h2 className="lp-h2">{COPY.faqHeading}</h2>
        </div>
        <div className="lp-faq-list">
          {COPY.faq.map((f, i) => (
            <details key={f.q} open={i === 0}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Final() {
  const sb = useRef<StubbyHandle>(null);
  const last = useRef(0);
  // Stubby cheers when the pointer or focus reaches the button, at most every 1.8s.
  const cheer = () => {
    const now = Date.now();
    if (now - last.current < 1800) return;
    last.current = now;
    sb.current?.happy(18);
  };
  return (
    <section className="lp-section lp-surface lp-final">
      <div className="lp-wide">
        <div className="lp-final-card">
          <div>
            <h2 className="lp-h2">{COPY.finalHeading}</h2>
            <p>{COPY.finalLine}</p>
            <Link to="/onboarding" className="lp-btn lp-btn-lg lp-btn-ink" onPointerEnter={cheer} onFocus={cheer}>
              {COPY.heroCta}
            </Link>
          </div>
          <LandingStubby ref={sb} size={220} className="lp-final-sb" />
        </div>
      </div>
    </section>
  );
}

/** Every picture the page uses, once. */
function usedKeys(): PhotoKey[] {
  const keys = new Set<PhotoKey>();
  for (const p of COPY.heroPicks) keys.add(p.image);
  for (const p of Object.values(COPY.demoPicks)) keys.add(p.image);
  for (const s of COPY.stubs) keys.add(s.image);
  return [...keys].filter((k) => PHOTOS[k].photo);
}

function PhotoCredits() {
  const [open, setOpen] = useState(false);
  const credits = usedCredits(usedKeys());
  return (
    <div className="lp-credits">
      <button type="button" className="lp-credits-btn" aria-expanded={open} aria-controls="lp-credits-list" onClick={() => setOpen((o) => !o)}>
        {COPY.photosLink}
      </button>
      {open && (
        <ul id="lp-credits-list" className="lp-credits-list">
          {credits.map((c) => (
            <li key={c.source}>
              <a href={c.source} target="_blank" rel="noopener noreferrer">
                {c.credit}
              </a>
            </li>
          ))}
          <li>
            <a href={COPY.photosUnsplashUrl} target="_blank" rel="noopener noreferrer">
              {COPY.photosUnsplash}
            </a>
          </li>
        </ul>
      )}
    </div>
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
      <PhotoCredits />
    </footer>
  );
}

/** The signed-out home page. Rendered by Home.tsx; it brings its own nav. */
export function Landing() {
  return (
    <div className="lp">
      <div className="lp-body">
        <Nav />
        <main>
          <Hero />
          <Nights />
          <Solo />
          <Demo />
          <How />
          <StubbySection />
          <Keep />
          <Ask />
          <Faq />
          <Final />
        </main>
        <Footer />
      </div>
    </div>
  );
}
