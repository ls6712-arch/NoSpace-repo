/**
 * "/" opens search on desktop. Root listens for the key and sends this event; whichever search is on screen answers:
 * the page's own box on /search, the rail's Search panel, or the header box when there is no rail.
 */
export const SEARCH_SHORTCUT_EVENT = "soosh:search";

/** True while someone is typing somewhere, so "/" is just a character. */
export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.closest("[role='textbox'], [role='combobox'], [role='searchbox']") !== null;
}
