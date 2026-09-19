const KEY = "sushii.myspace.lastVisit";

/** When the contact sheet last drew its line, so "since my last visit"
 * means something across sessions. A first-ever visit has nothing to
 * compare against, so it falls back to 24 hours — enough for the sheet to
 * show something rather than come up empty the very first time. */
export function getLastVisit(): number {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) return Number(stored);
  } catch {
    // Private mode / blocked storage — fall through to the default below.
  }
  return Date.now() - 24 * 60 * 60 * 1000;
}

/** Called on leaving My Space, not on arrival — updating it immediately
 * would make a same-session refresh look like nothing new ever happened. */
export function markVisited(): void {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Best effort — the sheet just falls back to the 24h window next time.
  }
}
