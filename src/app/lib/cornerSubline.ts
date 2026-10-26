import type { HomeCorner } from "../data/homeCorners";
import { cornerMeta } from "../data/curatedCorners";
import { thisWeek, type CornerLive } from "./cornersLive";
import { plural } from "./plural";

/**
 * The one line under a Corner's name on a card, first that applies:
 * events this week, Spaces, then how long it takes and where (curated Corners
 * only). Otherwise nothing: a card never invites you to start a Space.
 */
export function cornerSubline(corner: HomeCorner, live: CornerLive | undefined): string {
  if (live) {
    const events = thisWeek(live.events).length;
    if (events > 0) return `${plural(events, "event")} this week`;
    if (live.spaces.length > 0) return plural(live.spaces.length, "Space");
  }
  return corner.curated ? cornerMeta(corner.curated) : "";
}
