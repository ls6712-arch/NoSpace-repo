import { ArrowRight, Ticket } from "lucide-react";
import { formatDate } from "../lib/dates";
import { HOME_TZ } from "../lib/homeWeek";
import { LANDING_COPY as COPY } from "./copy";
import { LANDING_EXAMPLES } from "./examples";
import { ActivityPhoto } from "./ActivityPhoto";

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
  return <div className="lp-walls" role="group" aria-label={COPY.wallsExample}>
    <p className="lp-tag">{COPY.wallsExample}</p>
    <div className="lp-wall-pair">
      <section className="lp-wall" aria-labelledby="wall-still">
        <h3 id="wall-still">{COPY.stillMaking}</h3>
        <p className="lp-wall-line">{COPY.stillMakingLine}</p>
        <ul>{STILL_MAKING.map(card => <li key={card.example} className="lp-wall-card">
          <ActivityPhoto example={find(card.example)} sizes={SIZES}/>
          <p className="lp-wall-title">{card.title}</p>
          <p className="lp-wall-by">{card.by}</p>
          <span className="lp-wall-strip" aria-hidden="true">{COPY.makeYourVersion}</span>
        </li>)}</ul>
      </section>
      <section className="lp-wall" aria-labelledby="wall-made">
        <h3 id="wall-made">{COPY.madeIt}</h3>
        <p className="lp-wall-line">{COPY.madeItLine}</p>
        <ul><li className="lp-wall-card">
          <ActivityPhoto example={find(MADE_IT.example)} sizes={SIZES}/>
          <p className="lp-wall-title">{MADE_IT.title}</p>
          <p className="lp-wall-by">{MADE_IT.by} · Finished {formatDate(MADE_IT.finished, { timeZone: HOME_TZ })}</p>
          <p className="lp-wall-finisher"><Ticket size={16} aria-hidden="true"/>{COPY.finisher}</p>
          <span className="lp-wall-strip" aria-hidden="true">{COPY.makeYourVersion}</span>
        </li></ul>
        <div className="lp-passed">
          <h3>{COPY.passedAlong}</h3>
          <p className="lp-wall-line">{COPY.passedAlongLine}</p>
          <ol>{CHAIN.map(name => <li key={name}>{name}<ArrowRight size={14} aria-hidden="true"/></li>)}<li className="lp-passed-you">{COPY.passedAlongYou}</li></ol>
        </div>
      </section>
    </div>
  </div>;
}
