import { reducedMotion } from "./motion";

/** The six Shelf colors, as app tokens so they follow the theme. */
const COLORS = ["var(--accent)", "var(--cat-amber)", "var(--cat-violet)", "var(--cat-lime)", "var(--cat-blue)", "var(--cat-rose)"];

let layer: HTMLDivElement | null = null;
let live = 0;

function getLayer(): HTMLDivElement {
  if (layer && layer.isConnected) return layer;
  layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:40;overflow:hidden";
  document.body.appendChild(layer);
  return layer;
}

function release(piece: HTMLElement) {
  piece.remove();
  live -= 1;
  if (live <= 0) {
    live = 0;
    layer?.remove();
    layer = null;
  }
}

/**
 * Throws tiny ticket-shaped pieces from an element and lets them fall. Uses the
 * Web Animations API. Every piece removes itself when its animation ends, and the
 * one fixed layer goes with the last piece. Does nothing under reduced motion.
 */
export function burstFromElement(el: Element | null, count = 22) {
  if (!el || reducedMotion() || typeof el.animate !== "function") return;
  const root = getLayer();
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height * 0.35;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    const w = 6 + Math.random() * 6;
    piece.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;width:${w}px;height:${w * 1.45}px;border-radius:2px;background:${COLORS[i % COLORS.length]};will-change:transform,opacity`;
    root.appendChild(piece);
    live += 1;
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
    const v = 70 + Math.random() * 110;
    const dx = Math.cos(a) * v;
    const dy = Math.sin(a) * v;
    const rot = (Math.random() - 0.5) * 540;
    const at = (x: number, y: number, deg: number) => `translate(-50%,-50%) translate(${x}px,${y}px) rotate(${deg}deg)`;
    const anim = piece.animate(
      [
        { transform: at(0, 0, 0), opacity: 1 },
        { transform: at(dx, dy, rot / 2), opacity: 1, offset: 0.4 },
        { transform: at(dx * 1.25, dy + 150, rot), opacity: 0 },
      ],
      { duration: 1100 + Math.random() * 500, easing: "cubic-bezier(.2,.6,.4,1)" },
    );
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      release(piece);
    };
    anim.onfinish = finish;
    anim.oncancel = finish;
  }
}
