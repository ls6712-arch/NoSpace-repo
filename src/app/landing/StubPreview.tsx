import { StubArt } from "../components/stub/StubArt";
import { formatWeekday } from "../lib/dates";
import { HOME_TZ } from "../lib/homeWeek";
import { plural } from "../lib/plural";
import type { StubFace } from "../lib/stubFace";
import { LANDING_COPY as COPY } from "./copy";
import { motion } from "motion/react";
import { useEnter } from "./LandingReveal";
import { shared } from "../lib/motionTokens";

/** Editorial examples, never loaded from someone's private Shelf. */
export function StubPreview() {
  const enter = useEnter();
  const friday = formatWeekday("2026-11-06T17:00:00Z", "short", HOME_TZ);
  const saturday = formatWeekday("2026-11-07T17:00:00Z", "short", HOME_TZ);
  const examples: { face: StubFace; caption: string }[] = [
    { face: { kind: "event", title: "Photo walk", cornerName: "Photography", day: saturday, color: "var(--cat-lime)" }, caption: `${saturday} · On your own` },
    { face: { kind: "event", title: "Pizza night", cornerName: "Cooking", day: friday, color: "var(--cat-orange)" }, caption: `${friday} · With ${plural(2, "friend")}` },
    { face: { kind: "finish", title: "Learn a song", cornerName: "Music", day: saturday, color: "var(--cat-violet)" }, caption: "A finished Pursuit" },
  ];
  return <section className="lp-section lp-stubs" aria-labelledby="stubs-heading"><div className="lp-wide">
    <p className="lp-eyebrow">{COPY.stubsExamples}</p><h2 className="lp-h2" id="stubs-heading">{COPY.stubsHeading}</h2><p className="lp-lede">{COPY.stubsLine}</p>
    <ul className="lp-stub-grid" aria-label={COPY.stubsExamples} tabIndex={0}>{examples.map(({ face, caption }, i) => <motion.li key={face.title} {...enter(i * 3, { from: { y: 40, rotate: (i - 1) * 8 }, to: { rotate: 0 }, transition: shared })}><figure><StubArt face={face} width={208}/><figcaption>{caption}</figcaption></figure></motion.li>)}</ul>
  </div></section>;
}
