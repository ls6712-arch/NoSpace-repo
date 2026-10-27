import type { CornerLive, LiveEvent, LiveSpace } from "./cornersLive";

/** A ticket to a real event: the soonest upcoming one in an Open Space linked to the Corner. */
export interface EventTicket {
  event: LiveEvent;
  space: LiveSpace;
}

/**
 * The event a Corner's ticket is for, or null (the Corner then shows its
 * "How to start" card). Soonest first; ties go to the lower id. Closed Spaces
 * never qualify, and neither does an event that has already started.
 */
export function nextEventTicket(live: CornerLive | undefined, now = Date.now()): EventTicket | null {
  if (!live) return null;
  const open = new Map(live.spaces.filter((s) => s.access === "open").map((s) => [s.id, s]));
  let best: EventTicket | null = null;
  for (const event of live.events) {
    const space = open.get(event.spaceId);
    if (!space || event.teaser) continue;
    const t = new Date(event.startsAt).getTime();
    if (!(t > now)) continue;
    const bt = best ? new Date(best.event.startsAt).getTime() : Infinity;
    if (t < bt || (t === bt && best && event.id < best.event.id)) best = { event, space };
  }
  return best;
}

/** Where it happens: "Riverside, Portland", else "Online" for an online-only event, else nothing. */
export function eventPlace(event: Pick<LiveEvent, "meets" | "neighborhood" | "city">): string {
  const place = [event.neighborhood, event.city].filter(Boolean).join(", ");
  if (place) return place;
  return event.meets === "online" ? "Online" : "";
}
