/**
 * Word-by-word blur-in for a heading, from React Bits' BlurText
 * (https://github.com/DavidHDev/react-bits, MIT + Commons Clause, used as
 * part of this app, not redistributed). Trimmed to the one effect used here
 * (blur, by words, on load or when scrolled into view) and adapted:
 *   - no bounce: the move settles on the theme's easing, per the "ambient
 *     motion stays calm" rule;
 *   - under reduced motion it renders the plain text, no animation;
 *   - the real text sits in the DOM once, so screen readers read the title
 *     once and the animated words are aria-hidden.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

interface BlurTextProps {
  text: string;
  className?: string;
  /** Milliseconds between words. */
  delay?: number;
  /** Pixels each word rises from. */
  distance?: number;
  blur?: number;
  trigger?: "load" | "view";
}

export function BlurText({ text, className = "", delay = 90, distance = 24, blur = 10, trigger = "load" }: BlurTextProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(trigger === "load");
  const words = useMemo(() => text.split(" "), [text]);

  useEffect(() => {
    if (trigger !== "view" || shown) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setShown(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [trigger, shown]);

  if (reduce) return <span className={className}>{text}</span>;

  return (
    <span ref={ref} className={`flex flex-wrap ${className}`}>
      <span className="sr-only">{text}</span>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          aria-hidden="true"
          className="inline-block will-change-[transform,filter,opacity]"
          initial={{ filter: `blur(${blur}px)`, opacity: 0, y: distance }}
          animate={shown ? { filter: "blur(0px)", opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.55, delay: (i * delay) / 1000, ease: [0.22, 0.61, 0.36, 1] }}
        >
          {i < words.length - 1 ? `${word}\u00A0` : word}
        </motion.span>
      ))}
    </span>
  );
}
