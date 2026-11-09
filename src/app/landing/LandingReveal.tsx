import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  motion, useAnimationFrame, useMotionValue, useScroll, useSpring, useTransform, useVelocity,
  type MotionProps,
} from "motion/react";
import { Ticket } from "lucide-react";
import { PAGE_FROM, PAGE_TO, page, pop, settle, shared, staggerDelay } from "../lib/motionTokens";
import { RollNumber } from "../components/ui/RollNumber";
import { useLandingMotion } from "./LandingMotion";

/**
 * The landing page's motion, built on the app's movements (motionTokens.ts) so it
 * matches the Corner carousel: Enter for sections and lists, Pop for the last
 * beat, Roll for numbers, Grow into for cards. Everything runs once, when it
 * first scrolls into view. With reduced motion or the landing's motion off,
 * nothing here hides or moves anything.
 */

const VIEWPORT = { once: true, amount: 0.25 } as const;

/** With motion off (or switched off mid-visit), snap anything mid-entry to rest at once. */
const STILL: MotionProps = { initial: false, animate: { opacity: 1, y: 0, scale: 1, rotate: 0 }, transition: { duration: 0 } };

/** Motion on, and a browser that can tell when something scrolls into view. */
function useAnimated(): boolean {
  const { enabled } = useLandingMotion();
  return enabled && typeof IntersectionObserver !== "undefined";
}

/** Enter: opacity 0 to 1 and y 12 to 0, staggered by index. Empty props when motion is off. */
export function useEnter() {
  const enabled = useAnimated();
  return (index = 0, extra?: { from?: Record<string, number>; to?: Record<string, number>; transition?: MotionProps["transition"] }): MotionProps => enabled
    ? { initial: { ...PAGE_FROM, ...extra?.from }, whileInView: { ...PAGE_TO, ...extra?.to }, viewport: VIEWPORT, transition: { ...(extra?.transition ?? page), delay: staggerDelay(index) } }
    : STILL;
}

/** A word whose letters rise one after another (React Bits' Split Text, on the Enter curve). */
export function SplitWord({ text, className, delay = 0, onView = false }: { text: string; className?: string; delay?: number; onView?: boolean }) {
  const enabled = useAnimated();
  if (!enabled) return <span className={className}>{text}</span>;
  const trigger = onView ? { whileInView: "in", viewport: VIEWPORT } : { animate: "in" };
  return <motion.span className={className} initial="out" {...trigger}>
    {[...text].map((ch, i) => <motion.span key={i} className="lp-split-char"
      variants={{ out: { opacity: 0, y: "0.4em" }, in: { opacity: 1, y: 0 } }}
      transition={{ ...settle, delay: delay + i * 0.06 }}>{ch}</motion.span>)}
  </motion.span>;
}

/** Hook lines entering one by one after the wordmark; the last one pops. */
export function HookLine({ children, index, last }: { children: ReactNode; index: number; last?: boolean }) {
  const enabled = useAnimated();
  const Tag = last ? motion.em : motion.span;
  if (!enabled) return last ? <em>{children}</em> : <span>{children}</span>;
  return <Tag initial={last ? { opacity: 0, scale: 0.9, y: 8 } : PAGE_FROM} animate={last ? { opacity: 1, scale: 1, y: 0 } : PAGE_TO}
    style={last ? { transformOrigin: "left center" } : undefined}
    transition={{ ...(last ? pop : page), delay: 0.35 + index * 0.12 }}>{children}</Tag>;
}

/** A step number that rolls up from 0 the first time the steps are on screen. */
export function StepNumber({ n }: { n: number }) {
  const enabled = useAnimated();
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    let timer = 0;
    const io = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      io.disconnect();
      timer = window.setTimeout(() => setValue(n), staggerDelay(n) * 1000 + 120);
    }, { threshold: VIEWPORT.amount });
    io.observe(el);
    return () => { io.disconnect(); window.clearTimeout(timer); };
  }, [enabled, n]);
  return <span ref={ref} className="lp-step-n" aria-hidden="true">{enabled ? <RollNumber value={value}/> : <span aria-label={String(n)}>{n}</span>}</span>;
}

/** Grow into: a card that lands from slightly smaller, on the shared spring. */
export function useLand() {
  const enabled = useAnimated();
  return (index = 0): MotionProps => enabled
    ? { initial: { opacity: 0, y: 24, scale: 0.94 }, whileInView: { opacity: 1, y: 0, scale: 1 }, viewport: VIEWPORT, transition: { ...shared, delay: staggerDelay(index) * 3 } }
    : STILL;
}

/** Pop: the last beat of a sequence (the "You?" at the end of Passed along). */
export function usePop() {
  const enabled = useAnimated();
  return (delay = 0): MotionProps => enabled
    ? { initial: { opacity: 0, scale: 0.6 }, whileInView: { opacity: 1, scale: 1 }, viewport: VIEWPORT, transition: { ...pop, delay } }
    : STILL;
}

const wrap = (min: number, max: number, v: number) => {
  const range = max - min;
  return ((((v - min) % range) + range) % range) + min;
};

/**
 * A ticker of Corner names (React Bits' Scroll Velocity): it drifts on its own and
 * speeds up, or turns round, with the speed and direction of the page scroll.
 * Decorative: screen readers skip it, and it stands still when motion is off.
 */
export function CornerTicker({ names }: { names: string[] }) {
  const enabled = useAnimated();
  const x = useMotionValue(0);
  const { scrollY } = useScroll();
  const velocity = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 400 });
  const factor = useTransform(velocity, [0, 1000], [0, 5], { clamp: false });
  const direction = useRef(-1);
  const moved = useTransform(x, v => `${wrap(-50, 0, v)}%`);
  useAnimationFrame((_, delta) => {
    if (!enabled) return;
    const f = factor.get();
    if (f < 0) direction.current = 1; else if (f > 0) direction.current = -1;
    x.set(x.get() + direction.current * 1.6 * (delta / 1000) * (1 + Math.abs(f)));
  });
  const row = (copy: number) => names.map(name => <span key={`${copy}-${name}`} className="lp-ticker-item">{name}<Ticket size={18} aria-hidden="true"/></span>);
  return <div className="lp-ticker" aria-hidden="true">
    <motion.div className="lp-ticker-track" style={enabled ? { x: moved } : undefined}>{row(0)}{row(1)}</motion.div>
  </div>;
}

