import { useRef, type RefObject } from "react";
import { Link } from "react-router";
import { formatDuration } from "../lib/dates";
import { startPath } from "../lib/startContent";
import { ACTIVITY_EXAMPLES, type ActivityExample } from "./examples";
import { ActivityArt } from "./ActivityArt";
import { LANDING_COPY as COPY } from "./copy";
import { LandingStubby, type StubbyHandle } from "./LandingStubby";

export function ExamplePreview({ example, onChoose, headingRef }: {
  example: ActivityExample;
  onChoose: (id: string) => void;
  headingRef: RefObject<HTMLHeadingElement>;
}) {
  const stubby = useRef<StubbyHandle>(null);
  const choose = (id: string) => {
    onChoose(id);
    stubby.current?.think();
  };
  const another = () => {
    const options = ACTIVITY_EXAMPLES.filter(e => e.setting === example.setting);
    choose(options[(options.findIndex(e => e.id === example.id) + 1) % options.length].id);
  };
  return <div className="lp-example-wrap" role="group" aria-label={COPY.exampleLabel}>
    <LandingStubby ref={stubby} size={140} followPointer className="lp-example-stubby"/>
    <div className="lp-example" data-example-id={example.id}>
      <p className="lp-tag">{COPY.example}</p>
      <fieldset className="lp-choices">
        <legend className="sr-only">{COPY.setting}</legend>
        {(["home", "outside"] as const).map(setting => <button type="button" key={setting}
          aria-pressed={example.setting === setting}
          onClick={() => {
            choose(setting === example.setting ? example.id : ACTIVITY_EXAMPLES.find(e => e.setting === setting)!.id);
          }}>
          {setting === "home" ? COPY.atHome : COPY.outside}
        </button>)}
      </fieldset>
      <ActivityArt art={example.art} tone={example.tone}/>
      <div className="lp-example-copy">
        <p className="lp-tag">{example.setting === "home" ? COPY.atHome : COPY.outside} · {example.social}</p>
        <h2 ref={headingRef} tabIndex={-1}>{example.title}</h2>
        <p className="lp-example-step">{example.step}</p>
      </div>
      <p className="sr-only" role="status">{COPY.example}: {example.title}</p>
      <details key={example.id} className="lp-details">
        <summary>{COPY.details}<span aria-hidden="true">+</span></summary>
        <div className="lp-details-body">
          {example.required.length > 1 && <p className="lp-detail-label">{COPY.alternatives}</p>}
          <ul className="lp-bundles">
            {example.required.map(bundle => <li key={bundle.join("|")}><ul>{bundle.map(item => <li key={item}>{item}</li>)}</ul></li>)}
          </ul>
          {example.optional.length > 0 && <div><h3>{COPY.optional}</h3><ul>{example.optional.map(item => <li key={item}>{item}</li>)}</ul></div>}
          <dl className="lp-facts">
            <div><dt>{COPY.time}</dt><dd>{formatDuration(example.minutes)}</dd></div>
            <div><dt>{COPY.cost}</dt><dd>{COPY.costUnknown}</dd></div>
          </dl>
          <Link className="lp-guide" to={startPath(...example.corner)}>{COPY.source}: {example.interest}</Link>
        </div>
      </details>
      <div className="lp-example-actions">
        <button type="button" className="lp-btn lp-btn-ghost" onClick={another}>{COPY.another}</button>
        <Link className="lp-text-link" to="/calendar" state={{ landingExample: example.id }}>Ask Stubby</Link>
      </div>
    </div>
    <p className="lp-example-note">{COPY.exampleNote}</p>
  </div>;
}
