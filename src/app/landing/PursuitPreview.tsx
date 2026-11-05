import { useState } from "react";
import { Link } from "react-router";
import { Check, ArrowUpRight } from "lucide-react";
import { plural } from "../lib/plural";
import { track } from "../lib/analytics";
import { LANDING_COPY as COPY } from "./copy";
import { useLandingTransition } from "./useLandingTransition";

/** Editorial examples only: never import account progress into a public landing. */
export const PURSUIT_EXAMPLES = [
  { label: "Guitar", title: "Learn a song on guitar", hobby: "music", sub: "guitar", steps: ["Learn the chords", "Practice a chord progression", "Play the song"] },
  { label: "Drawing", title: "Make a collection of drawings", hobby: "art-creative", sub: "drawing", steps: ["Choose a subject", "Try a few sketches", "Finish a drawing"] },
  { label: "Cooking", title: "Learn a few recipes", hobby: "food-cooking", sub: "cooking", steps: ["Choose a recipe", "Cook it with someone", "Try another recipe"] },
] as const;

export function pursuitSignupHref(example: typeof PURSUIT_EXAMPLES[number]) {
  const query = new URLSearchParams({ title: example.title, hobby: example.hobby, sub: example.sub });
  return `/onboarding?${new URLSearchParams({ redirect: `/pursuits/new?${query}` })}`;
}

export function PursuitPreview() {
  const [index, setIndex] = useState(0);
  const example = PURSUIT_EXAMPLES[index];
  const transitionRef = useLandingTransition(example.sub);
  return <div className="lp-pursuit-preview">
    <fieldset className="lp-goal-choices"><legend>{COPY.pursuitExamples}</legend>
      {PURSUIT_EXAMPLES.map((item, i) => <button key={item.sub} type="button" aria-pressed={i === index} onClick={() => setIndex(i)}>{item.label}</button>)}
    </fieldset>
    <article className="lp-goal-card" aria-labelledby="goal-example-heading">
      <p className="lp-tag">{COPY.pursuitExample}</p>
      <div ref={transitionRef} className="lp-goal-content">
      <h3 id="goal-example-heading" aria-live="polite">{example.title}</h3>
      <p className="lp-goal-label">{COPY.pursuitSteps}</p>
      <div className="lp-goal-meter" aria-hidden="true"><span/></div>
      <ol>{example.steps.map((step, i) => <li key={step}><span className={i === 0 ? "lp-goal-done" : ""} aria-hidden="true">{i === 0 ? <Check size={14}/> : i + 1}</span>{step}</li>)}</ol>
      <p className="lp-example-note">{plural(1, "step")} complete. {COPY.pursuitSample}</p>
      </div>
      <Link className="lp-btn lp-btn-ink" to={pursuitSignupHref(example)} onClick={() => track({ name: "landing_action_clicked", action: "pursuit", placement: "pursuit" })}>{COPY.pursuitCta}<ArrowUpRight size={17} aria-hidden="true"/></Link>
    </article>
  </div>;
}
