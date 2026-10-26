import type { CSSProperties } from "react";

/**
 * The Corner's emoji as cover art, until a cover photo is added. It is
 * decoration (the Corner's name is always beside it), so it is hidden from
 * screen readers. Sized in px through style, since it is a picture rather
 * than text on the type scale.
 */
const SIZES: Record<"card" | "hero", CSSProperties> = {
  card: { fontSize: 64, lineHeight: 1 },
  hero: { fontSize: "clamp(120px, 24vw, 200px)", lineHeight: 1 },
};

export function CoverEmoji({ emoji, size, className = "" }: { emoji: string; size: "card" | "hero"; className?: string }) {
  return (
    <span aria-hidden="true" className={className} style={SIZES[size]}>
      {emoji}
    </span>
  );
}
