/**
 * Where focus goes back to when a dialog or sheet closes: the button that
 * opened it.
 *
 * Radix returns focus to whatever was focused when the dialog opened, but
 * Safari doesn't focus a button on tap, so on iOS (and for any dialog opened
 * from a tap) that is <body>, and closing a dialog dropped keyboard and
 * screen-reader users at the top of the page. We remember the last thing
 * tapped and fall back to it.
 */
const OPENER = "button, a[href], [role='button'], [role='menuitem'], [role='tab'], [tabindex]:not([tabindex='-1'])";

let lastTapped: HTMLElement | null = null;

if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (e) => {
      const el = e.target instanceof Element ? e.target.closest<HTMLElement>(OPENER) : null;
      if (el) lastTapped = el;
    },
    { capture: true, passive: true },
  );
}

/** Call as the dialog opens (before focus moves into it). */
export function captureOpener(): HTMLElement | null {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body) return active;
  return lastTapped;
}

/** Call as the dialog closes. Returns true if focus was restored. */
export function restoreFocus(opener: HTMLElement | null): boolean {
  if (!opener || !opener.isConnected) return false;
  opener.focus({ preventScroll: true });
  return document.activeElement === opener;
}
