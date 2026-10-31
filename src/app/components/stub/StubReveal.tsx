import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Stubby, type StubbyState } from "../stubby/Stubby";
import { StubArt } from "./StubArt";
import { PillButton } from "../ui/PillButton";
import { haptic, pop } from "../../lib/motionTokens";
import { KIND_LABEL, type StubFace } from "../../lib/stubFace";
import { EDGE } from "../../lib/stubMaterials";

/**
 * The moment a Stub is earned (brief §5.3), about 2.8 seconds:
 *   dim     the screen goes dark, one soft haptic
 *   build   Stubby crouches, a line of light grows, ticks speed up
 *   print   the Stub rises out of the light and lands (heavy haptic)
 *   tear    the tear-off gives, Stubby stamps it
 *   shine   one sweep of foil; a drop's number rolls up from 000
 *   rest    the title, Put in front row and Done
 * A tap anywhere skips to rest. Under reduced motion it opens at rest.
 */
type Phase = "dim" | "build" | "print" | "tear" | "shine" | "rest";
const AT: [Phase, number][] = [
  ["build", 300],
  ["print", 1300],
  ["tear", 1900],
  ["shine", 2300],
  ["rest", 2800],
];
const STUBBY: Record<Phase, StubbyState> = { dim: "idle", build: "thinking", print: "stamped", tear: "stamped", shine: "done", rest: "done" };

export function StubReveal({
  face,
  onDone,
  onPin,
}: {
  face: StubFace;
  onDone: () => void;
  /** Pin to the front row. Resolves to an error message, or null when it worked. */
  onPin?: () => Promise<string | null>;
}) {
  const reduce = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<Phase>(reduce ? "rest" : "dim");
  const [shown, setShown] = useState(reduce ? face.edition ?? 0 : 0);
  const [pin, setPin] = useState<"idle" | "busy" | "done" | string>("idle");
  const timers = useRef<number[]>([]);
  const titleId = useId();
  const done = useRef<HTMLButtonElement>(null);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  useEffect(() => {
    if (reduce) return;
    haptic(8);
    for (const [p, ms] of AT) timers.current.push(window.setTimeout(() => setPhase(p), ms));
    // Ticks that quicken while the light grows.
    for (const ms of [520, 760, 940, 1080, 1180, 1250]) timers.current.push(window.setTimeout(() => haptic(4), ms));
    timers.current.push(window.setTimeout(() => haptic(28), 1420));
    for (const ms of [1960, 2040, 2120, 2200]) timers.current.push(window.setTimeout(() => haptic(6), ms));
    return clear;
  }, [reduce]);

  // A drop's number rolls up during the shine.
  useEffect(() => {
    if (!face.edition) return;
    if (phase === "rest") return setShown(face.edition);
    if (phase !== "shine") return;
    const target = face.edition;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 450);
      setShown(Math.round(target * k));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase, face.edition]);

  useEffect(() => {
    if (phase === "rest") done.current?.focus();
  }, [phase]);

  const skip = () => {
    if (phase === "rest") return;
    clear();
    setPhase("rest");
  };

  const after = (p: Phase) => ["dim", "build", "print", "tear", "shine", "rest"].indexOf(phase) >= ["dim", "build", "print", "tear", "shine", "rest"].indexOf(p);
  const printed = after("print");
  const title = face.kind === "drop" && face.edition ? `You’re No. ${String(face.edition).padStart(3, "0")}` : "You kept a Stub";

  const pinIt = async () => {
    if (!onPin || pin === "busy" || pin === "done") return;
    setPin("busy");
    const err = await onPin();
    setPin(err ?? "done");
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={skip}
      onKeyDown={(e) => {
        if (e.key === "Escape") onDone();
      }}
      // design-token-ignore: the reveal is always lights-down, whatever the theme
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-hidden bg-[#050404] text-[#F4EFE8]"
    >
      {/* The line of light. */}
      <motion.span
        aria-hidden="true"
        initial={false}
        animate={{ width: phase === "build" || phase === "print" ? 260 : 0, opacity: phase === "build" || phase === "print" ? 1 : 0 }}
        transition={{ duration: phase === "build" ? 0.9 : 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        // design-token-ignore: warm light, not a theme colour
        className="absolute top-1/2 h-[3px] rounded-full bg-[#FFF7E8] shadow-[0_0_24px_6px_rgba(255,214,150,0.8),0_0_80px_20px_rgba(255,107,74,0.45)]"
      />

      {/* The burst behind a drop. */}
      {face.kind === "drop" && (
        <motion.span
          aria-hidden="true"
          initial={false}
          animate={{ opacity: phase === "shine" ? 1 : 0 }}
          transition={{ duration: 0.5 }}
          // design-token-ignore: warm glow of the holographic burst
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,rgba(255,214,150,0.55),rgba(255,107,74,0.25)_30%,transparent_60%)]"
        />
      )}

      <div className="relative flex flex-col items-center gap-6">
        <motion.div
          initial={false}
          animate={{ opacity: phase === "dim" ? 0 : 1, y: printed ? 0 : 60 }}
          transition={pop}
          className={printed ? "order-first" : ""}
        >
          <Stubby state={STUBBY[phase]} size={printed ? 56 : 88} onDark label="" />
        </motion.div>

        <AnimatePresence>
          {printed && (
            <motion.div
              initial={reduce ? false : { y: 120, scale: 0.4, opacity: 0, rotate: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1, rotate: -3 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
            >
              <StubArt face={face.kind === "drop" ? { ...face, edition: shown || undefined } : face} width={232} interactive={phase === "rest"} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {phase === "rest" && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-[420px] flex-col gap-3 px-6 pb-[max(2rem,env(safe-area-inset-bottom))]"
          >
            <h2 id={titleId} className="text-center font-[family-name:var(--font-display)] text-title font-extrabold">
              {title}
            </h2>
            <p className="text-center text-small opacity-80">{`${KIND_LABEL[face.kind]} · ${face.title}`}</p>
            {typeof pin === "string" && !["idle", "busy", "done"].includes(pin) && (
              <p role="alert" className="text-center text-small">
                {pin}
              </p>
            )}
            {onPin && (
              <PillButton variant="primary" className="w-full" disabled={pin === "busy" || pin === "done"} onClick={() => void pinIt()}>
                {pin === "done" ? "In your front row" : "Put in front row"}
              </PillButton>
            )}
            <button ref={done} type="button" onClick={onDone} style={{ borderColor: EDGE.light }} className="min-h-12 rounded-full border text-body font-medium">
              Done
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {phase !== "rest" && <span className="sr-only">{title}</span>}
    </div>,
    document.body,
  );
}
