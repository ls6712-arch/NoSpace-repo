import { useEffect } from "react";

/**
 * Long names and titles truncate with an ellipsis (`truncate` or
 * `line-clamp-*`), and the full text is always one gesture away:
 *
 * - Hover or keyboard focus: the element gets a `title` with its full text,
 *   but only while it is actually cut off, so short text never gets a
 *   redundant tooltip.
 * - Tap: a cut-off element that isn't itself a link or button expands in
 *   place (tap again to collapse). Inside a link or button the tap keeps
 *   its normal job; the page it opens shows the name in full.
 *
 * Installed once at the app root, so every `truncate` in the app gets this
 * without each component wiring it up.
 */
const SELECTOR = ".truncate, [class*='line-clamp-']";
const EXPANDED = "ns-truncate-open";

function isCutOff(el: HTMLElement): boolean {
  return el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
}

function truncatedFrom(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest<HTMLElement>(SELECTOR);
  return el;
}

function fullText(el: HTMLElement): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function useTruncationReveal() {
  useEffect(() => {
    const reveal = (e: Event) => {
      const el = truncatedFrom(e.target);
      if (!el) return;
      // Leave an author-set title alone.
      if (el.hasAttribute("title") && !el.dataset.nsAutoTitle) return;
      if (isCutOff(el)) {
        el.setAttribute("title", fullText(el));
        el.dataset.nsAutoTitle = "1";
      } else if (el.dataset.nsAutoTitle) {
        el.removeAttribute("title");
        delete el.dataset.nsAutoTitle;
      }
    };

    const toggle = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      const el = truncatedFrom(e.target);
      if (!el) return;
      if (el.closest("a, button, [role='button'], label, input, textarea, select")) return;
      if (el.classList.contains(EXPANDED)) {
        el.classList.remove(EXPANDED);
      } else if (isCutOff(el)) {
        el.classList.add(EXPANDED);
      }
    };

    document.addEventListener("pointerover", reveal, { passive: true });
    document.addEventListener("focusin", reveal);
    document.addEventListener("pointerup", toggle);
    return () => {
      document.removeEventListener("pointerover", reveal);
      document.removeEventListener("focusin", reveal);
      document.removeEventListener("pointerup", toggle);
    };
  }, []);
}
