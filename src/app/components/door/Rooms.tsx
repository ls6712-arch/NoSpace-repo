import { PressLink } from "../afterhours/PressLink";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { categoryStyle } from "../../lib/categoryStyle";
import { displayStyle } from "../../lib/doorList";
import { SECTION_GAP } from "../../lib/pageGrid";
import { ROOMS_SHOWN, type RankedRoom } from "../../lib/ranking";
import { useHistoryState } from "../../lib/useHistoryState";

/**
 * "Rooms": the 18 groups of Corners as 64px rows, best first, each a dot in its
 * colour, its name, and on the right up to 2 faces of people you follow who
 * logged there this week with a line saying so ("Ana is here", "New this
 * week", "Quiet right now"). A quiet room is drawn in muted text. Never a
 * number of people, never a stranger. Six show, then "See all rooms".
 */
export function Rooms({ rooms, avatarOf }: { rooms: RankedRoom[]; avatarOf: (userId: string) => string | undefined }) {
  const [showAll, setShowAll] = useHistoryState("discover.roomsAll", false);
  const shown = showAll ? rooms : rooms.slice(0, ROOMS_SHOWN);
  return (
    <section className={SECTION_GAP} aria-labelledby="rooms-title">
      <div className="mb-2 flex items-baseline justify-between gap-4 border-t-2 border-foreground pt-3">
        <h2 id="rooms-title" style={displayStyle(34, { lineHeight: 1.05 })}>
          Rooms
        </h2>
        <span className="text-small text-muted-foreground">Who’s in where</span>
      </div>
      <ul>
        {shown.map((r) => (
          <li key={r.slug} style={categoryStyle(r.slug)} className="border-b border-border">
            <PressLink to={`/browse/${r.slug}`} className="flex h-16 items-center gap-3">
              <span className="size-3 shrink-0 rounded-full bg-[var(--cat)]" aria-hidden="true" />
              <span
                style={displayStyle(26, { lineHeight: 1.1 })}
                className={`min-w-0 flex-1 truncate ${r.quiet ? "text-muted-foreground" : "text-foreground"}`}
              >
                {r.name}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {r.here.length > 0 && (
                  <span className="flex -space-x-1.5" aria-hidden="true">
                    {r.here.map((h) => (
                      <Avatar key={h.userId} className="size-6 border border-background">
                        <AvatarImage src={avatarOf(h.userId)} alt="" />
                        <AvatarFallback className="text-caption">{h.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    ))}
                  </span>
                )}
                <span className={`max-w-[9rem] truncate text-caption ${r.quiet ? "text-muted-foreground" : "text-foreground"}`}>
                  {r.presence}
                </span>
              </span>
            </PressLink>
          </li>
        ))}
      </ul>
      {!showAll && rooms.length > ROOMS_SHOWN && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2 inline-flex min-h-11 items-center text-small text-[var(--accent-text)] hover:underline"
        >
          See all rooms
        </button>
      )}
    </section>
  );
}
