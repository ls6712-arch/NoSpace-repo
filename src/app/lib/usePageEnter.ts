import { useEffect, useRef, type RefObject } from "react";

/** The class that runs the page-enter fade (theme.css, `.page-enter`). */
export const PAGE_ENTER_CLASS = "page-enter";

/**
 * Fades the main column in when the page changes, so moving between tabs and
 * pages reads as one motion instead of a hard cut. Nothing remounts: the class
 * is taken off and put back on the same element, so scroll memory and a page's
 * own state are untouched.
 *
 * Opacity only. A transform on <main> would make it the containing block for
 * every position: fixed sheet and toast inside it while the animation runs.
 * Skipped on first load (the boot splash already covers that), when a view
 * transition is already animating the change, and, through the duration
 * token, with reduced motion (theme.css collapses --duration-base to 0ms).
 */
export function usePageEnter(ref: RefObject<HTMLElement | null>, pathname: string): void {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = ref.current;
    if (!el) return;
    if ((document as Document & { activeViewTransition?: unknown }).activeViewTransition) return;
    el.classList.remove(PAGE_ENTER_CLASS);
    // Reading layout restarts the animation on the same element.
    void el.offsetWidth;
    el.classList.add(PAGE_ENTER_CLASS);
    const done = () => el.classList.remove(PAGE_ENTER_CLASS);
    el.addEventListener("animationend", done, { once: true });
    return () => el.removeEventListener("animationend", done);
  }, [ref, pathname]);
}
