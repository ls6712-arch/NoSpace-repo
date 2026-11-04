import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight } from "lucide-react";
import { APP_NAME, CONTACT_EMAIL, INSTAGRAM_URL, TIKTOK_URL } from "../config";
import { humanOnboardingEnabled } from "../lib/personalization";
import { QUESTION_TITLES } from "../components/settings/PreferenceFields";
import { LANDING_COPY as COPY } from "./copy";
import { ACTIVITY_EXAMPLES, FEATURED_EXAMPLES } from "./examples";
import { ActivityArt } from "./ActivityArt";
import { ExamplePreview } from "./ExamplePreview";
import { LandingStubby } from "./LandingStubby";
import { reducedMotion } from "./motion";
import "./landing.css";

function scrollToHow() {
  const heading = document.getElementById("how-heading");
  heading?.focus({ preventScroll: true });
  document.getElementById("how")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
}

/** Rendered inside Root's main landmark. Example choices stay local and never save personal answers. */
export function Landing() {
  const [example, setExample] = useState(ACTIVITY_EXAMPLES[0]);
  const [chosen, setChosen] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const preview = useRef<HTMLDivElement>(null);
  const exampleHeading = useRef<HTMLHeadingElement>(null);
  const entry = chosen ? { landingExample: example.id } : undefined;
  const choose = (id: string) => {
    const next = ACTIVITY_EXAMPLES.find(e => e.id === id);
    if (next) { setExample(next); setChosen(true); }
  };
  useEffect(() => {
    if (!focusRequest) return;
    const details = preview.current?.querySelector("details");
    if (details) details.open = true;
    exampleHeading.current?.focus({ preventScroll: true });
    preview.current?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  }, [focusRequest]);
  const tryLink = (className = "lp-btn") => <Link to="/calendar" state={entry} className={className}>{COPY.heroCta}</Link>;
  const footerLinks = [
    { label: "Privacy Policy", to: "/privacy-policy" },
    { label: "Terms", to: "/terms" },
  ];
  return <div className="lp">
    <button type="button" className="lp-skip" onClick={() => document.getElementById("landing-heading")?.focus()}>Skip to content</button>
    <header className="lp-nav">
      <div className="lp-wide lp-nav-inner">
        <Link to="/" className="lp-logo" aria-label={APP_NAME}><LandingStubby size={42}/>{APP_NAME}</Link>
        <nav aria-label="Main" className="lp-nav-actions">
          <button type="button" className="lp-nav-how" onClick={scrollToHow}>{COPY.heroSecondary}</button>
          <Link to="/login?mode=signin" className="lp-login">{COPY.logIn}</Link>
          {tryLink("lp-btn lp-btn-ink")}
        </nav>
      </div>
    </header>
    <section className="lp-hero" aria-labelledby="landing-heading">
      <div className="lp-wide lp-hero-grid">
        <div className="lp-hero-text">
          <p className="lp-eyebrow">{COPY.heroLabel}</p>
          <h1 id="landing-heading" tabIndex={-1}>{COPY.heroLead}<br/>{COPY.heroTail}</h1>
          <p className="lp-hero-sub">{COPY.heroSub}</p>
          <div className="lp-cta-row">
            {tryLink("lp-btn lp-btn-lg")}
            <button type="button" className="lp-btn lp-btn-lg lp-btn-ghost" onClick={scrollToHow}>{COPY.heroSecondary}</button>
          </div>
          <p className="lp-hero-hint">{COPY.heroHint}</p>
          <p className="lp-city">{COPY.city}</p>
        </div>
        <div ref={preview} className="lp-preview" id="activity-example">
          <ExamplePreview example={example} onChoose={choose} headingRef={exampleHeading}/>
        </div>
      </div>
    </section>
    <section className="lp-section" aria-labelledby="examples-heading">
      <div className="lp-wide">
        <h2 className="lp-h2" id="examples-heading">{COPY.examplesHeading}</h2>
        <p className="lp-lede">{COPY.examplesLine}</p>
        <div className="lp-activity-grid">
          {FEATURED_EXAMPLES.map(item => <button type="button" key={item.id} className="lp-activity"
            aria-pressed={example.id === item.id} aria-controls="activity-example"
            onClick={() => { choose(item.id); setFocusRequest(n => n + 1); }}>
            <ActivityArt art={item.art} tone={item.tone}/>
            <span className="lp-tag">{item.interest}</span>
            <span className="lp-activity-title">{item.title}</span>
            <span className="lp-activity-meta">{item.setting === "home" ? COPY.atHome : COPY.outside} · {item.social}</span>
            <span className="lp-activity-open">{COPY.details}<ArrowUpRight size={16} aria-hidden="true"/></span>
          </button>)}
        </div>
        <p className="lp-example-note">{COPY.examplesHint}</p>
        <ul className="lp-benefits">{COPY.benefits.map(b => <li key={b.title}><h3>{b.title}</h3><p>{b.line}</p></li>)}</ul>
      </div>
    </section>
    <section id="how" className="lp-section lp-how" aria-labelledby="how-heading">
      <div className="lp-wide">
        <h2 id="how-heading" tabIndex={-1} className="lp-h2">{COPY.howHeading}</h2>
        <ol className="lp-steps">{COPY.steps.map(s => <li key={s.title}><h3>{s.title}</h3><p>{s.line}</p></li>)}</ol>
        {humanOnboardingEnabled && <div className="lp-preferences">
          <div><h3>{COPY.preferencesHeading}</h3><p>{COPY.preferencesLine}</p><p className="lp-private">{COPY.preferencesPrivate}</p><Link className="lp-text-link" to="/onboarding">{COPY.signUp}</Link></div>
          <ul>{Object.values(QUESTION_TITLES).map(q => <li key={q}>{q}</li>)}</ul>
        </div>}
      </div>
    </section>
    <section className="lp-section lp-plans" aria-labelledby="plans-heading">
      <div className="lp-wide lp-plan-row">
        <div><p className="lp-eyebrow">{COPY.planLabel}</p><h2 className="lp-h2" id="plans-heading">{COPY.planHeading}</h2><p className="lp-lede">{COPY.planLine}</p></div>
        <LandingStubby size={160}/>
      </div>
    </section>
    <section id="faq" className="lp-section" aria-labelledby="faq-heading">
      <div className="lp-wide lp-faq"><h2 id="faq-heading" className="lp-h2">{COPY.faqHeading}</h2><div className="lp-faq-list">
        {COPY.faq.map(f => <details key={f.q}><summary>{f.q}<span aria-hidden="true">+</span></summary><p>{f.a}</p></details>)}
      </div></div>
    </section>
    <section className="lp-section lp-final" aria-labelledby="final-heading"><div className="lp-wide lp-final-card">
      <h2 id="final-heading" className="lp-h2">{COPY.finalHeading}</h2>{tryLink("lp-btn lp-btn-lg lp-btn-ink")}
    </div></section>
    <footer className="lp-footer"><nav aria-label="Footer">
      {footerLinks.map(l => <Link key={l.to} to={l.to}>{l.label}</Link>)}
      {CONTACT_EMAIL && <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>}
      {INSTAGRAM_URL && <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">Instagram</a>}
      {TIKTOK_URL && <a href={TIKTOK_URL} target="_blank" rel="noopener noreferrer">TikTok</a>}
    </nav></footer>
  </div>;
}
