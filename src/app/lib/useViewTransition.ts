/**
 * Whether a link may play a view transition (a tile growing into the next
 * page's header). Off under prefers-reduced-motion; in a browser without view
 * transitions React Router simply navigates, so nothing else is needed here.
 */
export function viewTransitionAllowed(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
