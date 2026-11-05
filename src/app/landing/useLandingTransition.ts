import { useEffect, useRef } from "react";
import { animate } from "motion/mini";
import { page, PAGE_FROM, PAGE_TO } from "../lib/motionTokens";
import { useLandingMotion } from "./LandingMotion";

/** Animate presentation content only. Buttons remain outside the moving element. */
export function useLandingTransition(identity: string) {
  const ref = useRef<HTMLDivElement>(null);
  const { enabled } = useLandingMotion();
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reset = () => {
      node.style.opacity = String(PAGE_TO.opacity);
      node.style.transform = "none";
    };
    if (!enabled) { reset(); return; }
    const animation = animate(node, {
      opacity: [PAGE_FROM.opacity, PAGE_TO.opacity],
      transform: [`translateY(${PAGE_FROM.y}px)`, `translateY(${PAGE_TO.y}px)`],
    }, page);
    return () => { animation.cancel(); reset(); };
  }, [identity, enabled]);
  return ref;
}
