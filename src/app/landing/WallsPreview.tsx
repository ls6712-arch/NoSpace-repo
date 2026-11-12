import { ArrowRight, Ticket } from "lucide-react";
import { formatDate } from "../lib/dates";
import { HOME_TZ } from "../lib/homeWeek";
import { LANDING_COPY as COPY } from "./copy";
import { LANDING_EXAMPLES } from "./examples";
import { ActivityPhoto } from "./ActivityPhoto";
import { motion } from "motion/react";
import { useEnter, useLand, usePop } from "./LandingReveal";

/** Editorial examples of a Corner's two walls. Never loaded from anyone's Moments. */
const STILL_MAKING = [
  { example: "paint", title: "Watercolor oranges, round two", by: "Ana" },
  { example: "guitar", title: "First song, third try", by: "Leo" },
] as const;
const MADE_IT = { example: "cook", title: "Pasta from scratch", by: "Sam", finished: "2026-10-30T16:00:00Z" } as const;
const CHAIN = ["Ana", "Jon", "Priya"] as const;

const find = (id: string) => LANDING_EXAMPLES.find(e => e.id === id)!;
const SIZES = "(min-width: 1280px) 280px, (min-width: 744px) 22vw, calc(50vw - 40px)";

export function WallsPreview() {
  const land = useLand();
  const enter = useEnter();
  const popIn = usePop();
  return <div className="lp-walls" role="group" aria-label={COPY.wallsExample}>
    <p className="lp-tag">{COPY.wallsExample}</p>
    <div className="lp-wall-pair">
      <section className="lp-wall" aria-labelledby="wall-still">
        <h3 id="wall-still">{COPY.stillMaking}</h3>
        <p className="lp-wall-line">{COPY.stillMakingLine}</p>
        <ul>{STILL_MAKING.map((card, i) => <motion.li key={card.example} className="lp-wall-card" {...land(i * 2)}>
          <ActivityPhoto example={find(card.example)} sizes={SIZES}/>
          <p className="lp-wall-title">{card.title}</p>
          <p className="lp-wall-by">{card.by}</p>
          <span className="lp-wall-strip" aria-hidden="true">{COPY.makeYourVersion}</span>
        </motion.li>)}</ul>
      </section>
      <section className="lp-wall" aria-labelledby="wall-made">
        <h3 id="wall-made">{COPY.madeIt}</h3>
        <p className="lp-wall-line">{COPY.madeItLine}</p>
        <ul><motion.li className="lp-wall-card" {...land(1)}>
          <ActivityPhoto example={find(MADE_IT.example)} sizes={SIZES}/>
          <p className="lp-wall-title">{MADE_IT.title}</p>
          <p className="lp-wall-by">{MADE_IT.by} · Finished {formatDate(MADE_IT.finished, { timeZone: HOME_TZ })}</p>
          <p className="lp-wall-finisher"><Ticket size={16} aria-hidden="true"/>{COPY.finisher}</p>
          <span className="lp-wall-strip" aria-hidden="true">{COPY.makeYourVersion}</span>
        </motion.li></ul>
        <div className="lp-passed">
          <h3>{COPY.passedAlong}</h3>
          <p className="lp-wall-line">{COPY.passedAlongLine}</p>
          <ol>{CHAIN.map((name, i) => <motion.li key={name} {...enter(i * 4 + 2)}>{name}<ArrowRight size={14} aria-hidden="true"/></motion.li>)}<motion.li className="lp-passed-you" {...popIn(0.6)}>{COPY.passedAlongYou}</motion.li></ol>
        </div>
      </section>
    </div>
  </div>;
}
