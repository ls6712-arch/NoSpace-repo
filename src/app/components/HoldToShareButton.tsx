import { useEffect, useRef, useState } from "react";
import { Globe2 } from "lucide-react";
import { usePrefersReducedMotion } from "../lib/useReducedMotion";

const HOLD_MS = 600;

/**
 * The one deliberate gesture in Step 3's logging flow: sharing with Everyone
 * needs a ~0.6s hold, not a tap, because it's the one save that exposes a
 * photo and a name to strangers — friction proportional to consequence, the
 * same idea Apple uses for "slide to power off." Every narrower audience
 * (Only me, Followers) still saves on a plain tap; this component is only
 * ever rendered for the Everyone case.
 *
 * Falls back to an ordinary button — same label, immediate on click — for
 * anyone who prefers reduced motion or is driving this by keyboard: a timed
 * physical hold isn't something either can reliably perform, and the brief
 * is explicit that this is exactly when the fallback belongs, not just
 * under reduced motion. There's no reliable way to *predict* "this person
 * uses a keyboard" ahead of a first interaction, so the keyboard case is
 * covered functionally instead — Enter/Space activates the same fill-then-
 * confirm animation instantly rather than requiring a held keydown, which
 * browsers don't repeat at a fixed physical rate anyway.
 */
export function HoldToShareButton({
  onConfirm,
  disabled = false,
  label = "Hold to share with everyone",
}: {
  onConfirm: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [pct, setPct] = useState(0);
  const holding = useRef(false);
  const startedAt = useRef(0);
  const rafId = useRef<number | null>(null);

  const stop = () => {
    holding.current = false;
    if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    rafId.current = null;
    setPct(0);
  };

  useEffect(() => stop, []);

  const tick = () => {
    if (!holding.current) return;
    const elapsed = Date.now() - startedAt.current;
    const next = Math.min(1, elapsed / HOLD_MS);
    setPct(next);
    if (next >= 1) {
      stop();
      onConfirm();
      return;
    }
    rafId.current = requestAnimationFrame(tick);
  };

  const start = () => {
    if (disabled || holding.current) return;
    holding.current = true;
    startedAt.current = Date.now();
    tick();
  };

  if (reducedMotion) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onConfirm}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-control bg-accent text-small font-semibold text-accent-foreground transition-colors hover:brightness-110 disabled:pointer-events-none disabled:opacity-50"
      >
        <Globe2 className="size-4" />
        Share with everyone
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      // Enter/Space: a real hold can't be timed reliably from a keyboard, so
      // activation is immediate instead of requiring HOLD_MS of held keydown.
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) {
          e.preventDefault();
          onConfirm();
        }
      }}
      aria-label={label}
      className="relative flex h-12 w-full select-none items-center justify-center gap-2 overflow-hidden rounded-control text-small font-semibold text-accent-foreground [background:color-mix(in_srgb,var(--accent)_55%,var(--foreground)_15%)] disabled:pointer-events-none disabled:opacity-50"
    >
      <span
        className="absolute inset-y-0 left-0 bg-accent"
        style={{ width: `${pct * 100}%`, transition: pct === 0 ? "width var(--duration-fast) var(--ease-standard)" : "none" }}
        aria-hidden="true"
      />
      <span className="relative flex items-center gap-2">
        <Globe2 className="size-4" />
        {pct > 0 ? "Keep holding…" : label}
      </span>
    </button>
  );
}
