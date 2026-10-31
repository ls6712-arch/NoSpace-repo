import { Link } from "react-router";
import { HorizontalRow } from "../HorizontalRow";
import { SuggestionPhoto } from "../home/SuggestionPhoto";
import { PillButton } from "../ui/PillButton";
import { formatWhen } from "../../lib/dates";
import { plural } from "../../lib/plural";
import { cornerName } from "../../lib/discoverCorners";
import type { DiscoverSpace } from "../../lib/discover";
import { useShownOnce } from "../../lib/useShownOnce";

/**
 * The line under a Space's name: its next event, or how many Moments it had this
 * month. An event Home already ranks in its top four is left out here (a dated
 * event never shows on both), so that Space shows its Moments instead. No member
 * count anywhere.
 */
export function spaceActivityLine(space: DiscoverSpace, homeEventKeys: ReadonlySet<string>): string {
  const ev = space.nextEvent;
  if (ev && !homeEventKeys.has(`${space.slug}|${ev.title}|${ev.startsAt}`)) return `${ev.title} · ${formatWhen(ev.startsAt)}`;
  return space.momentsThisMonth > 0 ? `${plural(space.momentsThisMonth, "Moment")} this month` : "";
}

function SpaceCard({
  space,
  position,
  activity,
  onJoin,
  onShown,
  onOpen,
}: {
  space: DiscoverSpace;
  position: number;
  activity: string;
  onJoin: (space: DiscoverSpace, position: number) => void;
  onShown: (space: DiscoverSpace, position: number) => void;
  onOpen: (space: DiscoverSpace, position: number) => void;
}) {
  const ref = useShownOnce<HTMLLIElement>(() => onShown(space, position));
  const [spaceSlug, slug] = (space.cornerKey ?? "").split("/");
  const sub = [slug ? cornerName(slug) : null, space.neighborhood].filter(Boolean).join(" · ");
  return (
    <li ref={ref} className="flex w-[200px] shrink-0 snap-start flex-col overflow-hidden rounded-card bg-card">
      <Link to={`/space/${space.slug}`} onClick={() => onOpen(space, position)} className="block flex-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {slug ? (
          <SuggestionPhoto corner={{ spaceSlug, slug }} className="aspect-[3/2] w-full" width={200} />
        ) : (
          <div className="aspect-[3/2] w-full bg-surface" aria-hidden="true" />
        )}
        <div className="p-3">
          <p className="truncate text-body font-semibold">{space.name}</p>
          {sub && <p className="truncate text-small text-muted-foreground">{sub}</p>}
          {activity && <p className="line-clamp-2 text-small text-muted-foreground">{activity}</p>}
        </div>
      </Link>
      <div className="p-3 pt-0">
        <PillButton variant="outline" className="w-full" onClick={() => onJoin(space, position)}>
          {space.access === "open" ? "Join" : "Ask to join"}
        </PillButton>
      </div>
    </li>
  );
}

/** Spaces near you, a row of cards. Open ones are joined, Closed ones are asked. */
export function SpacesRow({
  spaces,
  homeEventKeys,
  onJoin,
  onShown,
  onOpen,
}: {
  spaces: readonly DiscoverSpace[];
  homeEventKeys: ReadonlySet<string>;
  onJoin: (space: DiscoverSpace, position: number) => void;
  onShown: (space: DiscoverSpace, position: number) => void;
  onOpen: (space: DiscoverSpace, position: number) => void;
}) {
  return (
    <HorizontalRow name="discover.spaces" label="Spaces near you" contentKey={spaces.map((s) => s.id).join("|")}>
      {spaces.map((s, i) => (
        <SpaceCard key={s.id} space={s} position={i} activity={spaceActivityLine(s, homeEventKeys)} onJoin={onJoin} onShown={onShown} onOpen={onOpen} />
      ))}
    </HorizontalRow>
  );
}
