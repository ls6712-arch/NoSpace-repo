import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Stubby, type StubbyState } from "../components/stubby/Stubby";
import { burstFromElement } from "./confetti";
import { canHover, reducedMotion, replayClass } from "./motion";

/** What the landing page can ask Stubby to do. */
export interface StubbyHandle {
  /** Jump, stamp, and throw confetti. About 1.8s, then back to rest. */
  happy: (confetti?: number) => void;
  /** A small head tilt and a look up. About 0.8s. */
  think: () => void;
  /** A quick head shake. About 0.5s. */
  nah: () => void;
  /** One small hop. */
  hop: () => void;
}

/**
 * The landing page's Stubby: the app's own Stubby (src/app/components/stubby)
 * with four moods on top. The component itself is untouched; this wrapper picks
 * its states and adds the head shake, the hop and the confetti around it.
 */
export const LandingStubby = forwardRef<
  StubbyHandle,
  {
    size?: number;
    /** Eyes follow the pointer. Only on devices that hover. */
    followPointer?: boolean;
    /** Makes Stubby a button that celebrates when tapped. */
    tappable?: boolean;
    label?: string;
    onDark?: boolean;
    className?: string;
  }
>(function LandingStubby({ size = 160, followPointer = false, tappable = false, label, onDark, className }, ref) {
  const box = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<StubbyState>("idle");
  const current = useRef<StubbyState>("idle");
  const timers = useRef<number[]>([]);

  const go = useCallback((s: StubbyState) => {
    current.current = s;
    setState(s);
  }, []);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  const clear = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => clear, [clear]);

  const happy = useCallback(
    (confetti = 22) => {
      clear();
      const play = () => {
        go("stamped");
        burstFromElement(box.current, confetti);
        later(() => go("unstamped"), 1800);
      };
      if (current.current === "stamped") {
        go("unstamped");
        later(play, 80);
      } else play();
    },
    [clear, go, later],
  );

  const handle: StubbyHandle = {
    happy,
    think: () => {
      clear();
      go("thinking");
      later(() => go("idle"), 800);
    },
    nah: () => replayClass(box.current, "lp-nah", 600),
    hop: () => replayClass(box.current, "lp-hop", 700),
  };
  useImperativeHandle(ref, () => handle);

  const follow = followPointer && !reducedMotion() && canHover();

  return (
    <span ref={box} className={`lp-stubby ${className ?? ""}`}>
      <Stubby
        state={state}
        size={size}
        onDark={onDark}
        followPointer={follow}
        label={label}
        onPoke={tappable ? () => happy() : undefined}
      />
    </span>
  );
});
