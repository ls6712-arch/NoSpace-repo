import { useCallback, useEffect, useRef, type PointerEventHandler } from "react";
import { canHover } from "./motion";
import { useLandingMotion } from "./LandingMotion";

/** Tilt is mouse-only. Swipe is an extra shortcut; native buttons remain the primary controls. */
export function usePhotoInteraction(onSwipe: (direction: 1 | -1) => void) {
  const { enabled } = useLandingMotion();
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const start = useRef<{ id: number; x: number; y: number } | null>(null);
  const reset = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    ref.current?.style.setProperty("--lp-tilt-x", "0deg");
    ref.current?.style.setProperty("--lp-tilt-y", "0deg");
  }, []);
  useEffect(() => { if (!enabled) reset(); return reset; }, [enabled, reset]);
  const onPointerMove: PointerEventHandler<HTMLDivElement> = event => {
    if (!enabled || event.pointerType !== "mouse" || !canHover() || !ref.current) return;
    // Keep the actual click target steady even while its character artwork moves.
    if ((event.target as Element).closest("button,a")) { reset(); return; }
    const rect = ref.current.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      ref.current?.style.setProperty("--lp-tilt-x", `${-y * 4}deg`);
      ref.current?.style.setProperty("--lp-tilt-y", `${x * 4}deg`);
      frame.current = null;
    });
  };
  const onPointerDown: PointerEventHandler<HTMLDivElement> = event => {
    if (event.pointerType !== "touch" || !event.isPrimary || (event.target as Element).closest("button,a")) return;
    start.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const onPointerUp: PointerEventHandler<HTMLDivElement> = event => {
    const down = start.current;
    start.current = null;
    if (!down || down.id !== event.pointerId) return;
    const dx = event.clientX - down.x, dy = event.clientY - down.y;
    if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.5) onSwipe(dx < 0 ? 1 : -1);
  };
  return { ref, onPointerMove, onPointerLeave: reset, onPointerDown, onPointerUp,
    onPointerCancel: () => { start.current = null; reset(); } };
}
