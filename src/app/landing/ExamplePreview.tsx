import { useState, type RefObject } from "react";
import { LANDING_EXAMPLES, type ActivityExample } from "./examples";
import { ActivityPhoto, activityPhoto } from "./ActivityPhoto";
import { usePhotoInteraction } from "./usePhotoInteraction";
import { LANDING_COPY as COPY } from "./copy";
import { useLandingTransition } from "./useLandingTransition";

export function ExamplePreview({ example, onChoose, headingRef }: {
  example: ActivityExample;
  onChoose: (id: string) => void;
  headingRef: RefObject<HTMLHeadingElement>;
}) {
  const [loadedPhoto, setLoadedPhoto] = useState<string | null>(null);
  const transitionRef = useLandingTransition(example.id);
  const cycle = (direction: 1 | -1 = 1) => {
    const index = LANDING_EXAMPLES.findIndex(e => e.id === example.id);
    onChoose(LANDING_EXAMPLES[(index + direction + LANDING_EXAMPLES.length) % LANDING_EXAMPLES.length].id);
  };
  const interaction = usePhotoInteraction(cycle);
  const photo = activityPhoto(example);
  return <div className="lp-example-wrap" role="group" aria-label={COPY.exampleLabel}>
    <div className="lp-example" data-example-id={example.id}>
      <p className="lp-tag">{COPY.example}</p>
      <div className="lp-photo-stage" {...interaction}>
        <div ref={transitionRef} key={example.id} className="lp-photo-swap">
          <ActivityPhoto example={example} priority onLoad={() => setLoadedPhoto(example.id)} onFail={() => setLoadedPhoto(null)}/>
        </div>
      </div>
      <div className="lp-photo-credit-row">{loadedPhoto === example.id && <a className="lp-photo-credit" href={photo.source} target="_blank" rel="noopener noreferrer">{COPY.photo}: {photo.credit}</a>}</div>
      <div className="lp-example-copy"><h2 ref={headingRef} tabIndex={-1}>{example.title}</h2></div>
      <p className="sr-only" role="status">{COPY.example}: {example.title}</p>
      <div className="lp-example-actions"><button type="button" className="lp-btn lp-btn-ghost" onClick={() => cycle()}>{COPY.another}</button></div>
    </div>
  </div>;
}
