import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { ArrowUpRight, Instagram } from "lucide-react";
import { APP_NAME, CONTACT_EMAIL, INSTAGRAM_URL, TIKTOK_URL, X_URL } from "../config";
import { Stubby } from "../components/stubby/Stubby";
import { LANDING_COPY } from "./copy";

const COPY = LANDING_COPY.footer;

/** The X mark. Lucide only ships the old bird, so this is drawn inline. */
function XMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
      <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.32l4.37 5.78L17.75 3Zm-1.08 16.17h1.7L7.4 4.74H5.58l11.09 14.43Z" />
    </svg>
  );
}

/**
 * Signed-out landing footer. Layout follows the founder's reference
 * (Nov 9, 2026): brand mark, link columns, then a bottom row with legal
 * links and a pill form. The pill sends a wish to CONTACT_EMAIL through the
 * visitor's own mail app, so it needs no table and stores nothing.
 */
export function LandingFooter({ onSection }: { onSection: (id: string) => void }) {
  const [wish, setWish] = useState("");
  const socials = [
    X_URL && { href: X_URL, label: "X", icon: <XMark /> },
    INSTAGRAM_URL && { href: INSTAGRAM_URL, label: "Instagram", icon: <Instagram size={20} aria-hidden="true" /> },
    TIKTOK_URL && { href: TIKTOK_URL, label: "TikTok", icon: <ArrowUpRight size={20} aria-hidden="true" /> },
  ].filter(Boolean) as { href: string; label: string; icon: JSX.Element }[];

  function send(e: FormEvent) {
    e.preventDefault();
    const body = wish.trim();
    if (!body || !CONTACT_EMAIL) return;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(COPY.wishSubject)}&body=${encodeURIComponent(body)}`;
    setWish("");
  }

  return (
    <footer className="lp-foot">
      <div className="lp-wide lp-foot-top">
        <Link to="/" className="lp-foot-brand" aria-label={APP_NAME}>
          <span className="lp-foot-disc"><Stubby size={64} motionEnabled={false} /></span>
          <span className="lp-foot-word">{APP_NAME}</span>
        </Link>
        <nav aria-labelledby="lp-foot-explore">
          <p id="lp-foot-explore" className="lp-foot-label">{COPY.exploreLabel}</p>
          <ul className="lp-foot-links">
            {COPY.explore.map((item) => (
              <li key={item.section}><button type="button" onClick={() => onSection(item.section)}>{item.label}</button></li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="lp-foot-label">{COPY.aboutLabel}</p>
          <p className="lp-foot-about">{COPY.about}</p>
        </div>
        {socials.length > 0 && (
          <div>
            <p className="lp-foot-label">{COPY.followLabel}</p>
            <ul className="lp-foot-socials">
              {socials.map((s) => (
                <li key={s.label}><a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={`${APP_NAME} on ${s.label}`}>{s.icon}</a></li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="lp-wide lp-foot-bottom">
        <div className="lp-foot-legal">
          <p>© {APP_NAME}</p>
          <nav aria-label="Legal">
            <Link to="/privacy-policy">{COPY.privacy}</Link>
            <Link to="/terms">{COPY.terms}</Link>
            {CONTACT_EMAIL && <a href={`mailto:${CONTACT_EMAIL}`}>{COPY.contact}</a>}
          </nav>
        </div>
        {CONTACT_EMAIL && (
          <form className="lp-foot-wish" onSubmit={send}>
            <label htmlFor="lp-foot-wish" className="lp-foot-label">{COPY.wishLabel}</label>
            <div className="lp-foot-pill">
              <input id="lp-foot-wish" value={wish} onChange={(e) => setWish(e.target.value)} placeholder={COPY.wishPlaceholder} maxLength={500} autoComplete="off" />
              <button type="submit" disabled={!wish.trim()}>{COPY.wishSend}</button>
            </div>
          </form>
        )}
      </div>
    </footer>
  );
}
