import type { TabKey } from "../lib/routeHandle";

/**
 * The town behind every page: which part of it each screen looks at. Plain
 * data with no three.js in it, so the shell can import it and it can be tested
 * without a canvas. The town itself (town.ts) is only loaded on demand.
 *
 * One town, many views: moving between tabs glides the camera from one corner
 * of the same park to another, instead of swapping backgrounds.
 */

export type TownView = "wide" | "meetup" | "painter" | "finish" | "picnic" | "chess";

export interface TownCamera {
  /** The point the camera looks at, in world units. */
  target: [number, number, number];
  /** Distance from the target along the ground. */
  dist: number;
  /** Height above the target. */
  height: number;
  /** Direction around the target, in radians. */
  angle: number;
}

export const TOWN_CAMERAS: Record<TownView, TownCamera> = {
  wide: { target: [0, 0, 0], dist: 32, height: 19, angle: 0.6 },
  meetup: { target: [-1.9, 0.6, -2.7], dist: 15, height: 8.5, angle: 0.5 },
  painter: { target: [-3.8, 0.8, -6], dist: 14, height: 8, angle: 0.3 },
  finish: { target: [9, 0.8, 0.4], dist: 15, height: 8.5, angle: 1.1 },
  picnic: { target: [-6.2, 0.4, 3.4], dist: 14, height: 8, angle: -0.4 },
  chess: { target: [5.6, 0.6, 4.2], dist: 14, height: 8, angle: 0.5 },
};

/** Which view a tab shows. A screen with no tab (landing, sign in) sees the whole park. */
const BY_TAB: Record<TabKey, TownView> = {
  "my-space": "meetup",
  discover: "wide",
  create: "painter",
  calendar: "chess",
  inbox: "picnic",
  you: "finish",
};

export function viewForTab(tab: TabKey | undefined): TownView {
  return tab ? BY_TAB[tab] : "wide";
}

/** How much the town moves. "still" draws one frame and stops (reduced motion, or a page that needs calm). */
export type TownMotion = "calm" | "still";
