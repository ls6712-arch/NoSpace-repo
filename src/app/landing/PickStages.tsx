import { useRef, useState } from "react";
import { LANDING_COPY as COPY, type ExamplePick } from "./copy";
import { LandingStubby, type StubbyHandle } from "./LandingStubby";
import { PickTicket } from "./PickTicket";

/**
 * Two example tickets, the hero's and the demo's. They are examples only: they
 * keep their state in the page and never write, call or book anything.
 */

export function HeroStage() {
  const picks: readonly ExamplePick[] = COPY.heroPicks;
  const T = COPY.ticket;
  const sb = useRef<StubbyHandle>(null);
  const [i, setI] = useState(0);
  const [swaps, setSwaps] = useState(0);
  const [friend, setFriend] = useState(false);
  const [torn, setTorn] = useState(false);
  const [caption, setCaption] = useState(picks[0].caption);
  const before = useRef(caption);

  const going = () => {
    if (torn) return;
    before.current = caption;
    setTorn(true);
    setCaption(friend ? T.yesFriend : T.yesSolo);
    sb.current?.happy();
  };
  const undo = () => {
    setTorn(false);
    setCaption(before.current);
    sb.current?.nah();
  };
  const nah = () => {
    sb.current?.nah();
    const n = (i + 1) % picks.length;
    setI(n);
    setSwaps((s) => s + 1);
    setCaption(picks[n].caption);
  };
  const plus = () => {
    const f = !friend;
    setFriend(f);
    setCaption(f ? T.plusOnLine : T.plusOffLine);
    sb.current?.think();
  };

  return (
    <div className="lp-stage" role="group" aria-label={COPY.stageLabel}>
      <LandingStubby ref={sb} size={190} followPointer tappable label={COPY.stubbyLabel} className="lp-stage-sb" />
      <p className="lp-caption lp-stage-caption" aria-live="polite">
        {caption}
      </p>
      <PickTicket eager={swaps === 0} pick={picks[i]} swaps={swaps} torn={torn} friend={friend} badge={!friend} onGoing={going} onNah={nah} onPlus={plus} onUndo={undo} />
      <span className="lp-tag lp-stage-tag">{COPY.stageTag}</span>
    </div>
  );
}

type Answers = { when: string; budget: string; who: string };

export function DemoStage() {
  const T = COPY.ticket;
  const rows = COPY.demoRows;
  const sb = useRef<StubbyHandle>(null);
  const [answers, setAnswers] = useState<Answers>({ when: "tonight", budget: "25", who: "solo" });
  const [swaps, setSwaps] = useState(0);
  const [torn, setTorn] = useState(false);
  // A line Stubby's caption shows instead of the pick's own, after Nah or I’m going.
  const [override, setOverride] = useState<string | null>(null);
  const before = useRef<string | null>(null);

  const solo = answers.who === "solo";
  const pick = (COPY.demoPicks as Record<string, ExamplePick>)[`${answers.when}|${answers.budget}|${answers.who}`];
  const caption = override ?? pick.caption;

  const choose = (key: keyof Answers, v: string) => {
    if (answers[key] === v) return;
    setAnswers((a) => ({ ...a, [key]: v }));
    setTorn(false);
    setOverride(null);
    setSwaps((s) => s + 1);
    sb.current?.think();
  };
  const going = () => {
    if (torn) return;
    before.current = override;
    setTorn(true);
    setOverride(solo ? T.yesSolo : T.yesFriend);
    sb.current?.happy();
  };
  const undo = () => {
    setTorn(false);
    setOverride(before.current);
    sb.current?.nah();
  };

  return (
    <div className="lp-panel">
      {(Object.keys(rows) as (keyof typeof rows)[]).map((key) => (
        <div key={key} className="lp-pill-row" role="group" aria-label={rows[key].label}>
          <span className="lp-tag lp-pill-label" aria-hidden="true">
            {rows[key].label}
          </span>
          {rows[key].options.map((o) => (
            <button key={o.v} type="button" className="lp-pill" aria-pressed={answers[key] === o.v} onClick={() => choose(key, o.v)}>
              {o.label}
            </button>
          ))}
        </div>
      ))}
      <div className="lp-says lp-says-panel">
        <LandingStubby ref={sb} size={96} label={COPY.stubbyLabel} />
        <p className="lp-caption" aria-live="polite">
          {caption}
        </p>
      </div>
      <PickTicket
        inPanel
        pick={pick}
        swaps={swaps}
        torn={torn}
        friend={!solo}
        badge={solo}
        onGoing={going}
        onNah={() => {
          sb.current?.nah();
          setOverride(T.demoNah);
        }}
        onPlus={() => choose("who", solo ? "friend" : "solo")}
        onUndo={undo}
      />
      <span className="lp-tag">{COPY.demoTag}</span>
    </div>
  );
}
