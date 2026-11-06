import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, BookOpen, Camera, Users, UserRound, Layers, Compass } from "lucide-react";
import { APP_NAME, CONTACT_EMAIL, INSTAGRAM_URL, TIKTOK_URL, stubbyAskEnabled } from "../config";
import { humanOnboardingEnabled } from "../lib/personalization";
import { QUESTION_TITLES } from "../components/settings/PreferenceFields";
import { cornerPath } from "../lib/cornerPath";
import { track } from "../lib/analytics";
import { LANDING_COPY as COPY } from "./copy";
import { ACTIVITY_EXAMPLES, LANDING_EXAMPLES } from "./examples";
import { ActivityPhoto } from "./ActivityPhoto";
import { ExamplePreview } from "./ExamplePreview";
import { PursuitPreview } from "./PursuitPreview";
import { Stubby } from "../components/stubby/Stubby";
import { StubPreview } from "./StubPreview";
import { reducedMotion } from "./motion";
import { LandingMotionProvider, useLandingMotion } from "./LandingMotion";
import "./landing.css";

function scrollToSection(id: string) {
  document.getElementById(`${id}-heading`)?.focus({ preventScroll: true });
  document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
}

/** Rendered inside Root's main landmark. Example choices never save personal answers. */
export function Landing() {
  return <LandingMotionProvider><LandingPage/></LandingMotionProvider>;
}

function LandingPage() {
  const { enabled } = useLandingMotion();
  const [example, setExample] = useState(ACTIVITY_EXAMPLES.find(e => e.id === "photo-walk")!);
  const [chosen, setChosen] = useState(false);
  const [filter, setFilter] = useState<typeof COPY.filters[number]["id"]>("all");
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
    exampleHeading.current?.focus({ preventScroll: true });
    preview.current?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  }, [focusRequest]);
  // The main button: Ask Stubby with the chosen example, or sign-up while Ask Stubby is off (config.ts).
  const tryLink = (placement: "header" | "hero" | "footer", className = "lp-btn") => <Link to={stubbyAskEnabled ? "/calendar" : "/onboarding"} state={stubbyAskEnabled ? entry : undefined} className={className}
    onClick={() => track({ name: "landing_action_clicked", action: stubbyAskEnabled ? "ask" : "signup", placement, hasExample: chosen })}><span>{COPY.heroCta}</span><ArrowUpRight size={17} aria-hidden="true"/></Link>;
  const filtered = LANDING_EXAMPLES.filter(item => filter === "all" || (filter === "creative" ? ["paint", "guitar", "photo-walk", "cook"].includes(item.id) : item.setting === filter));
  const visible = filtered.filter((item, i) => filtered.findIndex(other => other.corner[1] === item.corner[1]) === i);
  const icons = [Camera, Layers, BookOpen];
  return <div className="lp" data-motion={enabled ? "on" : "off"}>
    <button type="button" className="lp-skip" onClick={() => document.getElementById("landing-heading")?.focus()}>Skip to content</button>
    <header className="lp-nav"><div className="lp-wide lp-nav-inner">
      <Link to="/" className="lp-logo" aria-label={APP_NAME}><Stubby size={42} motionEnabled={false}/>{APP_NAME}</Link>
      <nav aria-label="Main" className="lp-nav-actions">
        <button type="button" className="lp-nav-how" onClick={() => scrollToSection("corners")}>{COPY.explore}</button>
        <Link to="/login?mode=signin" className="lp-login">{COPY.logIn}</Link>
        {tryLink("header", "lp-btn lp-btn-ink lp-nav-cta")}
      </nav>
    </div></header>
    <section className="lp-hero" aria-labelledby="landing-heading"><div className="lp-wide lp-hero-grid">
      <div className="lp-hero-text">
        <p className="lp-eyebrow">{COPY.heroLabel}</p>
        <h1 id="landing-heading" tabIndex={-1}>{COPY.heroLead} <em>{COPY.heroTail}</em></h1>
        <p className="lp-hero-sub">{COPY.heroSub}</p>
        <div className="lp-cta-row">{tryLink("hero", "lp-btn lp-btn-lg")}<button type="button" className="lp-text-link" onClick={() => scrollToSection("how")}>{COPY.heroSecondary}</button></div>
        {stubbyAskEnabled && <p className="lp-hero-hint">{COPY.heroHint}</p>}
        <ul className="lp-invitations"><li><UserRound size={18} aria-hidden="true"/>{COPY.solo}</li><li><Users size={18} aria-hidden="true"/>{COPY.shared}</li></ul>
      </div>
      <div ref={preview} className="lp-preview" id="activity-example"><ExamplePreview example={example} onChoose={choose} headingRef={exampleHeading}/></div>
    </div></section>
    <section id="corners" className="lp-section" aria-labelledby="corners-heading"><div className="lp-wide">
      <div className="lp-section-intro"><div><p className="lp-eyebrow">{COPY.explore}</p><h2 className="lp-h2" id="corners-heading" tabIndex={-1}>{COPY.examplesHeading}</h2></div><p className="lp-lede">{COPY.examplesLine}</p></div>
      <fieldset className="lp-filters"><legend className="sr-only">{COPY.explore}</legend>{COPY.filters.map(item => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}</fieldset>
      <p className="sr-only" role="status">{COPY.filters.find(item => item.id === filter)?.label}</p>
      <div className="lp-activity-grid">{visible.map(item => <article key={item.id} className="lp-activity">
        <ActivityPhoto example={item}/>
        <Link className="lp-corner-link" to={cornerPath(...item.corner)} onClick={() => track({ name: "landing_action_clicked", action: "corner", placement: "corner" })}><h3>{item.id === "guitar" ? "Guitar" : item.interest}</h3><ArrowUpRight size={18} aria-hidden="true"/><span className="sr-only">{COPY.cornerLink}</span></Link>
        <p className="lp-activity-title">{item.title}</p><p className="lp-activity-meta">{item.setting === "home" ? COPY.atHome : COPY.outside} · {item.social}</p>
        <button className="lp-text-link" type="button" aria-label={`${COPY.previewActivity}: ${item.interest}`} aria-controls="activity-example" onClick={() => { choose(item.id); setFocusRequest(n => n + 1); }}>{COPY.previewActivity}</button>
      </article>)}{filter === "all" && <article className="lp-activity lp-see-all"><Compass size={44} aria-hidden="true"/><p>{COPY.seeAllLine}</p><Link className="lp-corner-link" to="/corners" onClick={() => track({ name: "landing_action_clicked", action: "corner", placement: "corner" })}>{COPY.seeAllCorners}<ArrowUpRight size={18} aria-hidden="true"/></Link></article>}</div>
    </div></section>
    <section className="lp-section lp-pursuits" aria-labelledby="pursuits-heading"><div className="lp-wide lp-pursuit-grid">
      <div><p className="lp-eyebrow">{COPY.pursuitLabel}</p><h2 className="lp-h2" id="pursuits-heading">{COPY.pursuitHeading}</h2><p className="lp-lede">{COPY.pursuitLine}</p><p className="lp-lede">{COPY.pursuitTogether}</p><p className="lp-example-note">{COPY.pursuitOptional}</p></div><PursuitPreview/>
    </div></section>
    <section id="how" className="lp-section lp-how" aria-labelledby="how-heading"><div className="lp-wide">
      <p className="lp-eyebrow">{COPY.howLabel}</p><h2 id="how-heading" tabIndex={-1} className="lp-h2">{COPY.howHeading}</h2>
      <ol className="lp-steps">{COPY.steps.map(s => <li key={s.title}><h3>{s.title}</h3><p>{s.line}</p></li>)}</ol>
      {humanOnboardingEnabled && <div className="lp-preferences"><div><h3>{COPY.preferencesHeading}</h3><p>{COPY.preferencesLine}</p><p className="lp-private">{COPY.preferencesPrivate}</p><Link className="lp-text-link" to="/onboarding">{COPY.signUp}</Link></div><ul>{Object.values(QUESTION_TITLES).map(q => <li key={q}>{q}</li>)}</ul></div>}
    </div></section>
    <section className="lp-section lp-together" aria-labelledby="together-heading"><div className="lp-wide"><p className="lp-eyebrow">{COPY.togetherLabel}</p><h2 className="lp-h2" id="together-heading">{COPY.togetherHeading}</h2><div className="lp-pair">{COPY.together.map((item, i) => <article key={item.title}><ActivityPhoto example={LANDING_EXAMPLES.find(example => example.id === (i === 0 ? "read" : "cook"))!} sizes="(min-width: 1280px) 588px, (min-width: 360px) calc((100vw - 72px) / 2), calc(100vw - 48px)"/><h3>{item.title}</h3><p>{item.line}</p></article>)}</div></div></section>
    <section className="lp-section" aria-labelledby="features-heading"><div className="lp-wide"><h2 id="features-heading" className="lp-h2">{COPY.featuresHeading}</h2><div className="lp-feature-grid">{COPY.features.map((item, i) => { const Icon = icons[i]; return <article key={item.title}><Icon aria-hidden="true"/><h3>{item.title}</h3><p>{item.line}</p></article>; })}</div></div></section>
    <StubPreview/>
    <section id="faq" className="lp-section" aria-labelledby="faq-heading"><div className="lp-wide lp-faq"><h2 id="faq-heading" className="lp-h2">{COPY.faqHeading}</h2><div className="lp-faq-list">{COPY.faq.map(f => <details key={f.q}><summary>{f.q}<span aria-hidden="true">+</span></summary><p>{f.a}</p></details>)}</div></div></section>
    <section className="lp-section lp-final" aria-labelledby="final-heading"><div className="lp-wide lp-final-card"><div><h2 id="final-heading" className="lp-h2">{COPY.finalHeading}</h2><p>{COPY.finalLine}</p></div>{tryLink("footer", "lp-btn lp-btn-lg lp-btn-ink")}</div></section>
    <footer className="lp-footer"><nav aria-label="Footer"><Link to="/privacy-policy">Privacy Policy</Link><Link to="/terms">Terms</Link>{CONTACT_EMAIL && <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>}{INSTAGRAM_URL && <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">Instagram</a>}{TIKTOK_URL && <a href={TIKTOK_URL} target="_blank" rel="noopener noreferrer">TikTok</a>}</nav></footer>
  </div>;
}
