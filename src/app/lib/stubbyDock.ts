import { useSyncExternalStore } from "react";
import { nyParts } from "./homeWeek";

/**
 * The Stubby dock: where it shows, the once-a-session hello, the once-a-day nudge, and
 * whether a full-screen sheet is covering the page. Pure helpers, so each is tested on
 * its own (stubbyDock.test.ts).
 */

/**
 * The main signed-in pages, where Stubby waits in the corner: Home, Discover, Calendar,
 * You, a Space, a Corner and People. Everything else (signed out, onboarding, the door
 * and invite screens, Log a Moment, settings, admin, and any page not listed) has no dock.
 */
export function showStubbyDock(pathname: string, signedIn: boolean): boolean {
  if (!signedIn) return false;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === "/my-space" || path === "/discover" || path === "/calendar" || path === "/people") return true;
  if (path === "/you" || path.startsWith("/you/")) return true;
  // A Space's own page, not its edit form.
  if (/^\/space\/[^/]+$/.test(path)) return true;
  if (/^\/corners\/[^/]+$/.test(path)) return true;
  return false;
}

/** The pages the daily nudge may appear on. */
export function nudgePage(pathname: string): boolean {
  return pathname === "/my-space" || pathname === "/calendar";
}

/** Seconds a page has been open before the nudge appears, and how long it stays. */
export const NUDGE_DELAY_MS = 4000;
export const NUDGE_SHOW_MS = 8000;
export const NUDGE_KEY = "soosh.stubbyNudge.lastShown";
export const HELLO_KEY = "soosh.stubbyDock.hello";

/** The New York date of a moment, as YYYY-MM-DD. */
export function nyDayKey(ms: number): string {
  const p = nyParts(ms);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** Whether the nudge may show now: once a New York day, never at 0 asks, never over an open panel. */
export function canNudge({ lastShown, now, asksLeft, panelOpen }: { lastShown: string | null; now: number; asksLeft: number | null; panelOpen: boolean }): boolean {
  if (panelOpen) return false;
  if (asksLeft === null || asksLeft <= 0) return false;
  return lastShown !== nyDayKey(now);
}

export function readNudgeDay(): string | null {
  try {
    return window.localStorage.getItem(NUDGE_KEY);
  } catch {
    return null;
  }
}

export function writeNudgeDay(now: number): void {
  try {
    window.localStorage.setItem(NUDGE_KEY, nyDayKey(now));
  } catch {
    // Private mode or storage blocked: the nudge may show again, which is harmless.
  }
}

/**
 * True the first time it is asked in this browser session, then false. Without
 * sessionStorage the hello is skipped rather than replayed on every page.
 */
export function takeHello(): boolean {
  try {
    if (window.sessionStorage.getItem(HELLO_KEY)) return false;
    window.sessionStorage.setItem(HELLO_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

// ---------- full-screen sheets ----------
// A full BottomSheet (Log a Moment and the like) covers the whole screen, so the dock
// steps aside while one is open. BottomSheet marks itself here.
let fullSheets = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Call when a full-screen sheet opens; call the returned function when it closes. */
export function markFullSheetOpen(): () => void {
  fullSheets += 1;
  emit();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    fullSheets = Math.max(0, fullSheets - 1);
    emit();
  };
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export function useFullSheetOpen(): boolean {
  return useSyncExternalStore(subscribe, () => fullSheets > 0, () => false);
}
