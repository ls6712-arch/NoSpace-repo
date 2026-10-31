import { PressLink } from "../common/PressLink";
import type { LiveEvent, LiveSpace } from "../../lib/cornersLive";
import { formatStarts } from "../../lib/dates";

/** An event this week, as a card in a row: time, title, Space. Opens the Space's events. */
export function WeekEventCard({ event, space }: { event: LiveEvent; space?: LiveSpace }) {
  return (
    <li className="w-[260px] shrink-0 snap-start tab:w-[300px]">
      <PressLink to={`/space/${space?.slug ?? ""}?tab=events`} className="block h-full rounded-card border border-border bg-card p-4">
        <span className="block text-caption text-muted-foreground">{formatStarts(event.startsAt, { timeZone: event.timezone })}</span>
        <span className="mt-1 line-clamp-2 block break-words text-small font-semibold">{event.title}</span>
        {space && <span className="mt-1 block truncate text-caption text-muted-foreground">{space.name}</span>}
      </PressLink>
    </li>
  );
}
