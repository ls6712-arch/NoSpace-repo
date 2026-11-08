import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { DISMISS_VELOCITY, DURATION_BASE, DURATION_FAST, TOAST_DISMISS_OFFSET, exit, fuse as fuseTiming, settle, sheet } from "../../lib/motionTokens";
import "./SwipeToast.css";

/**
 * One toast (from React Bits' Swipe Toast, MIT, rebuilt on the motion tokens).
 * It rises on --duration-base, burns a fuse along its bottom edge for the time
 * it stays, and goes away the way a sheet does: drag it down past
 * TOAST_DISMISS_OFFSET, or flick it at DISMISS_VELOCITY. Let go short and it
 * springs back on `settle`. Hovering, focusing, holding it or leaving the tab
 * pauses the fuse, so an Undo is never lost while someone is reaching for it.
 *
 * Always rendered inside <Toaster>'s stack, which it collapses out of when gone.
 */
export type CloseReason = "timeout" | "swipe" | "action" | "escape" | "programmatic";

/** px/ms, the shared flick speed. */
const FLICK = DISMISS_VELOCITY / 1000;
const DEAD_ZONE = 3;
const RESIST_PX = 24;
/** How long the emptied slot takes to close up: --duration-fast. */
const COLLAPSE_MS = DURATION_FAST * 1000;
/** The closing slide in SwipeToast.css runs on --duration-base. */
const LEAVE_MS = DURATION_BASE * 1000;
const HAS_STARTING_STYLE = typeof window !== "undefined" && "CSSStartingStyleRule" in window;

const rubberband = (over: number, dim: number, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));
const velocityOf = (hist: [number, number][]) => {
  if (hist.length < 2) return 0;
  const [t0, y0] = hist[0];
  const [t1, y1] = hist[hist.length - 1];
  return performance.now() - t1 > 100 ? 0 : (y1 - y0) / Math.max(1, t1 - t0);
};

export function SwipeToast({
  message,
  actionLabel,
  onAction,
  open = true,
  onClose,
  duration,
  tone,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  open?: boolean;
  /** After the exit and the collapse. */
  onClose?: (reason: CloseReason) => void;
  /** Milliseconds; the fuse burns over this. 0 keeps it until dismissed. */
  duration: number;
  tone?: "error";
}) {
  const reduce = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<"open" | "closing" | "gone">("open");
  const [instant, setInstant] = useState(false);
  const [mounted, setMounted] = useState(HAS_STARTING_STYLE);
  const cardRef = useRef<HTMLDivElement>(null);
  const fuseRef = useRef<HTMLElement>(null);
  const anim = useRef<Animation | null>(null);
  const drag = useRef<{ id: number; startY: number; grab: number | null; moved: boolean; hist: [number, number][] } | null>(null);
  const flags = useRef({ hover: false, interacting: false, focus: false, hidden: false });
  const lastInput = useRef<"pointer" | "keyboard">("pointer");
  const pendingClose = useRef<CloseReason | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const leaving = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const latest = useRef({ onClose, onAction });
  latest.current = { onClose, onAction };

  const y = useMotionValue(0);
  const fade = useMotionValue(1);
  const transform = useTransform(y, (v) => `translateY(${v}px)`);

  const syncFuse = () => {
    const a = anim.current;
    if (!a) return;
    const f = flags.current;
    if (f.hover || f.interacting || f.focus || f.hidden) a.pause();
    else if (a.playState === "paused") a.play();
  };
  const finish = (why: CloseReason) => {
    setPhase("gone");
    leaving.current = false;
    closeTimer.current = setTimeout(() => latest.current.onClose?.(why), COLLAPSE_MS);
  };
  const close = (why: CloseReason) => {
    if (phaseRef.current !== "open" || leaving.current) return;
    if (drag.current) {
      pendingClose.current = why;
      return;
    }
    anim.current?.pause();
    const now = why === "escape" || (why === "action" && lastInput.current === "keyboard");
    setInstant(now);
    setPhase("closing");
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => finish(why), now ? 0 : LEAVE_MS);
  };
  const rescue = () => {
    clearTimeout(closeTimer.current);
    setInstant(false);
    y.set(0);
    fade.set(1);
    setPhase("open");
  };

  useEffect(() => {
    if (!open) close("programmatic");
    else if (phaseRef.current !== "open") rescue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (!HAS_STARTING_STYLE) requestAnimationFrame(() => setMounted(true));
  }, []);
  useEffect(() => {
    if (phase !== "open" || duration <= 0 || !fuseRef.current?.animate) return;
    anim.current?.cancel();
    const a = fuseRef.current.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], {
      duration,
      easing: fuseTiming(duration).ease,
      fill: "forwards",
    });
    a.onfinish = () => close("timeout");
    anim.current = a;
    syncFuse();
    return () => {
      a.onfinish = null;
      a.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, duration]);
  useEffect(() => {
    const onVisibility = () => {
      flags.current.hidden = document.hidden;
      syncFuse();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimeout(closeTimer.current);
      anim.current?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const swipeOut = (dy: number, v: number) => {
    anim.current?.pause();
    leaving.current = true;
    pendingClose.current = null;
    if (!reduce && cardRef.current) animate(y, dy + cardRef.current.offsetHeight, { ...sheet, velocity: v * 1000 });
    animate(fade, 0, exit).then(() => finish("swipe"));
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    lastInput.current = "pointer";
    if (e.button !== 0 || drag.current || leaving.current || (e.target as HTMLElement).closest("button")) return;
    if (phaseRef.current === "closing") rescue();
    try {
      cardRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // Capture is a nicety; the drag still works without it.
    }
    y.stop();
    drag.current = { id: e.pointerId, startY: e.clientY, grab: null, moved: false, hist: [[performance.now(), y.get()]] };
    flags.current.interacting = true;
    syncFuse();
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (d.grab === null) {
      if (Math.abs(e.clientY - d.startY) < DEAD_ZONE) return;
      d.grab = e.clientY - y.get();
      if (cardRef.current) cardRef.current.dataset.swiping = "";
    }
    const raw = e.clientY - d.grab;
    const next = raw >= 0 ? raw : rubberband(raw, RESIST_PX);
    y.set(next);
    d.moved = true;
    d.hist.push([performance.now(), next]);
    if (d.hist.length > 4) d.hist.shift();
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (cardRef.current) delete cardRef.current.dataset.swiping;
    try {
      cardRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // Already released.
    }
    flags.current.interacting = false;
    const dy = y.get();
    const v = velocityOf(d.hist);
    if (dy > 0 && (v > FLICK || (dy >= TOAST_DISMISS_OFFSET && v >= 0))) {
      swipeOut(dy, v);
      return;
    }
    if (d.moved) animate(y, 0, reduce ? exit : { ...settle, velocity: v * 1000 });
    const queued = pendingClose.current;
    pendingClose.current = null;
    if (queued) close(queued);
    else syncFuse();
  };

  return (
    <div
      className="swipe-toast"
      data-phase={phase}
      data-fuse={duration > 0 ? "on" : "off"}
      data-tone={tone}
      data-instant={instant ? "" : undefined}
      data-mounted={mounted ? "true" : "false"}
    >
      <div className="swipe-toast__gate">
        <div className="swipe-toast__lift">
          <motion.div
            ref={cardRef}
            className="swipe-toast__card"
            role={tone === "error" ? "alert" : "status"}
            aria-live={tone === "error" ? "assertive" : "polite"}
            aria-atomic="true"
            tabIndex={0}
            style={{ transform, opacity: fade }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") {
                flags.current.hover = true;
                syncFuse();
              }
            }}
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse") {
                flags.current.hover = false;
                syncFuse();
              }
            }}
            onFocus={() => {
              flags.current.focus = true;
              syncFuse();
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                flags.current.focus = false;
                syncFuse();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") lastInput.current = "keyboard";
              if (e.key === "Escape") {
                e.stopPropagation();
                close("escape");
              }
            }}
          >
            <span className="swipe-toast__message">{message}</span>
            {actionLabel ? (
              <button
                type="button"
                className="swipe-toast__action"
                onClick={() => {
                  latest.current.onAction?.();
                  close("action");
                }}
              >
                {actionLabel}
              </button>
            ) : null}
            <i ref={fuseRef} className="swipe-toast__fuse" aria-hidden="true" />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
