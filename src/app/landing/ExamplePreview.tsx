import { useEffect, useRef, useState, type RefObject } from "react";
import { Link } from "react-router";
import { Pause, Play } from "lucide-react";
import { track } from "../lib/analytics";
import { formatDuration } from "../lib/dates";
import { startPath } from "../lib/startContent";
import { ACTIVITY_EXAMPLES, type ActivityExample } from "./examples";
import { ActivityPhoto, activityPhoto } from "./ActivityPhoto";
import { useLandingMotion } from "./LandingMotion";
import { usePhotoInteraction } from "./usePhotoInteraction";
import { LANDING_COPY as COPY } from "./copy";
import { LandingStubby, type StubbyHandle } from "./LandingStubby";

export function ExamplePreview({ example, onChoose, headingRef }: {
  example: ActivityExample;
  onChoose: (id: string) => void;
  headingRef: RefObject<HTMLHeadingElement>;
}) {
  const [loadedPhoto, setLoadedPhoto] = useState<string | null>(null);
  const stubby = useRef<StubbyHandle>(null);
  const { enabled, reduced, toggle } = useLandingMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (!wrap.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(wrap.current);
    return () => observer.disconnect();
  }, []);
  const choose = (id: string) => {
    onChoose(id);
    stubby.current?.think();
  };
  const cycle = (direction: 1 | -1 = 1) => {
    const options = ACTIVITY_EXAMPLES.filter(e => e.setting === example.setting);
    choose(options[(options.findIndex(e => e.id === example.id) + direction + options.length) % options.length].id);
  };
  const interaction = usePhotoInteraction(cycle);
  const photo = activityPhoto(example);
  return <div ref={wrap} className="lp-example-wrap" role="group" aria-label={COPY.exampleLabel} data-active={visible}>
    <div className="lp-example" data-example-id={example.id}>
      <div className="lp-example-header"><p className="lp-tag">{COPY.example}</p>
        <button type="button" className="lp-motion-toggle" disabled={reduced} onClick={toggle}
          aria-label={reduced ? COPY.motionDevice : enabled ? COPY.pauseMotion : COPY.playMotion}>
          {enabled ? <Pause size={15} aria-hidden="true"/> : <Play size={15} aria-hidden="true"/>}
          {reduced ? COPY.motionOff : enabled ? COPY.pauseMotion : COPY.playMotion}
        </button>
      </div>
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
      <p className="lp-interaction-hint">{COPY.exampleHint}</p>
      <div className="lp-photo-stage" {...interaction}>
        <div key={example.id} className="lp-photo-swap">
          <ActivityPhoto example={example} priority onLoad={() => setLoadedPhoto(example.id)} onFail={() => setLoadedPhoto(null)}/>
        </div>
        <div className="lp-stubby-dock">
          {enabled ? <button type="button" className="lp-play-stubby" aria-label={COPY.playStubby} onClick={() => stubby.current?.happy(0)}>
            <LandingStubby ref={stubby} size={100} followPointer className="lp-example-stubby"/>
            <span className="lp-stubby-hint" aria-hidden="true">{COPY.tapStubby}</span>
          </button> : <LandingStubby ref={stubby} size={100} className="lp-example-stubby"/>}
        </div>
      </div>
      {loadedPhoto === example.id && <a className="lp-photo-credit" href={photo.source} target="_blank" rel="noopener noreferrer">{COPY.photo}: {photo.credit}</a>}
      <p className="lp-swipe-hint">{COPY.swipeHint}</p>
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
        <button type="button" className="lp-btn lp-btn-ghost" onClick={() => cycle()}>{COPY.another}</button>
        <Link className="lp-text-link" to="/calendar" state={{ landingExample: example.id }} onClick={() => track({ name: "landing_action_clicked", action: "ask", placement: "example", hasExample: true })}>{COPY.askExample}</Link>
      </div>
    </div>
    <p className="lp-example-note">{COPY.exampleNote}</p>
  </div>;
}
