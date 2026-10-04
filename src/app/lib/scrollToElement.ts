/**
 * Smooth-scrolls the element with the given id into view, honoring
 * prefers-reduced-motion (jumps instantly instead of animating, the same
 * rule every motion treatment in this app follows). No-ops if the element
 * isn't on the page.
 *
 * No manual requestAnimationFrame fallback for browsers that lack
 * scrollIntoView's smooth behavior — every evergreen browser has supported
 * it for years (Chrome 61+, Firefox 36+, Safari 15.4+), and this app
 * already relies on other modern-only CSS elsewhere (color-mix, dvh units),
 * so there's no lower bar to hold this one feature to either.
 */
export function scrollToElementId(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

/** "smooth", or "auto" under prefers-reduced-motion — for any scrollTo or
 * scrollIntoView call that would otherwise animate. */
export function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
