import { useMatches, type Params } from "react-router";

/**
 * What every route says about itself, so the shell can draw the right back
 * control and the tabs can remember where you were. One source of truth: the
 * bottom bar, the rail, the back chevron and `useBack` all read this, never a
 * list of their own. Set on each route in routes.ts (routes.handle.test.ts
 * fails if one is missing).
 *
 * kind
 *  - "tab":  a tab root, or a screen with no back at all (nothing top-left).
 *  - "page": pushed onto a tab (bare chevron-left, back goes through history).
 *  - "flow": a task you can walk away from (an X, with a discard check).
 *
 * tab: which bottom tab the screen belongs to. It matches what the bar
 * highlighted before this existed (including its quirks); a screen the bar
 * never highlighted has none. "inbox" has no slot on the bar: it is the
 * header's bell and chats.
 *
 * parent: where back goes when this is the first page of the visit (a shared
 * link) and there is no history inside the app to go back through. Required
 * for "page" and "flow".
 *
 * legacyBack: TEMPORARY. The page still draws its own back control (removed in
 * step 3 of the back navigation brief), so the shell holds its chevron back to
 * avoid two of them. Step 3 deletes this flag with the old controls.
 */
export type TabKey = "my-space" | "discover" | "create" | "calendar" | "inbox" | "you";

export interface RouteHandle {
  kind: "tab" | "page" | "flow";
  tab?: TabKey;
  legacyBack?: boolean;
  parent?: (params: Params<string>, search: URLSearchParams) => string;
}

/** The handle of the screen on show (the deepest match), or undefined for one that has none. */
export function useRouteHandle(): { handle: RouteHandle | undefined; params: Params<string> } {
  const matches = useMatches();
  for (let i = matches.length - 1; i >= 0; i--) {
    const h = matches[i].handle as RouteHandle | undefined;
    if (h) return { handle: h, params: matches[i].params };
  }
  return { handle: undefined, params: {} };
}

/** The bottom tab the screen on show belongs to, if any. */
export function useCurrentTab(): TabKey | undefined {
  return useRouteHandle().handle?.tab;
}
