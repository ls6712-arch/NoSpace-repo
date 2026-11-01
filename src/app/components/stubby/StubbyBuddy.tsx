import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Stubby, type StubbyState } from "./Stubby";

/** The reactions a screen can ask its Stubby for. Each plays once, then he settles back. */
export type BuddyReaction = Extract<
  StubbyState,
  "stamped" | "unstamped" | "shrug" | "torn" | "tilt" | "done" | "hello" | "eager" | "excited" | "peek"
>;

/** The happy little moves the dock asks for. They give way the moment Stubby has real work (thinking). */
const CHEERS: ReadonlySet<BuddyReaction> = new Set(["hello", "eager", "excited", "peek"]);

/** How Stubby rests between reactions: `idle` on a screen, `ready` (smiling) in the dock. */
export type BuddyRest = Extract<StubbyState, "idle" | "ready">;

export interface StubbyBuddyHandle {
  react: (r: BuddyReaction) => void;
}

/** How long a reaction is left on screen before Stubby goes back to resting. */
export const SETTLE_MS = 2600;

/**
 * A small Stubby who sits on a screen and reacts to what you do there. He never
 * talks (glossary: "It never talks; it reacts"), so he is decoration for screen
 * readers: whatever he reacts to already says so in words elsewhere.
 *
 * `waiting` shows him thinking while the screen loads; `upset` tilts his head when
 * it couldn't. After any reaction he settles back to `rest`, fresh (no stamp, no
 * torn tab), so the next reaction always reads clearly. A tap squishes him.
 */
export const StubbyBuddy = forwardRef<
  StubbyBuddyHandle,
  { size?: number; waiting?: boolean; upset?: boolean; rest?: BuddyRest; followPointer?: boolean; className?: string }
>(function StubbyBuddy({ size = 56, waiting = false, upset = false, rest = "idle", followPointer = false, className }, ref) {
  const [reaction, setReaction] = useState<BuddyReaction | null>(null);
  // A new key after a reaction gives a fresh, resting Stubby.
  const [round, setRound] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const react = useCallback((r: BuddyReaction) => {
    window.clearTimeout(timer.current);
    setReaction(r);
    timer.current = window.setTimeout(() => {
      setReaction(null);
      setRound((n) => n + 1);
    }, SETTLE_MS);
  }, []);
  useImperativeHandle(ref, () => ({ react }), [react]);

  const cheering = reaction !== null && CHEERS.has(reaction);
  const state: StubbyState = (cheering && (waiting || upset) ? null : reaction) ?? (upset ? "tilt" : waiting ? "thinking" : rest);
  return (
    <span aria-hidden="true" className={className} data-stubby-state={state}>
      <Stubby key={round} state={state} size={size} label="" followPointer={followPointer} />
    </span>
  );
});
