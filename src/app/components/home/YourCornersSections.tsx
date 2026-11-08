import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { WALL_COPY, WallCard } from "../corners/WallCard";
import { Skeleton } from "../ui/skeleton";
import { HorizontalRow } from "../HorizontalRow";
import { PressLink } from "../common/PressLink";
import { PillButton } from "../ui/PillButton";
import { formatStarts } from "../../lib/dates";
import type { HomeEvent, HomeWallCard } from "../../lib/homeYourCorners";

/** Home v3 wording (docs/glossary.md, Home v3). Wall and event words are reused from the Corner page. */
export const HOME_V3_COPY = {
  stillMakingYours: "Still making in your Corners",
  stillMakingAll: "Still making on Soosh",
  followMore: "Follow a few Corners to make this yours.",
  seeAllCorners: "See all Corners",
  happening: "Happening this week",
  peopleTitle: "Soosh is better with your people",
  peopleLine: "Bring a friend and start your first Pursuit together.",
  invite: "Invite on WhatsApp",
  findContacts: "Find contacts",
} as const;

const INVITE_TEXT = "I'm using Soosh to try new things with friends. Come along?";

function SectionHead({ id, title, link }: { id: string; title: string; link?: { to: string; label: string } }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 id={id} className="text-lead" style={{ fontFamily: "var(--font-display)" }}>
        {title}
      </h2>
      {link && (
        <Link to={link.to} className="inline-flex min-h-11 shrink-0 items-center gap-0.5 text-small font-semibold text-accent-text">
          {link.label}
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

/**
 * The newest Still making cards from your Corners, with Make your version on
 * each. Not shown at all when there is nothing to show; a loading wall shows
 * the card shapes.
 */
export function StillMakingSection({
  cards,
  fallback,
  onOpen,
  onMake,
}: {
  cards: HomeWallCard[] | null;
  fallback: boolean;
  onOpen: (c: HomeWallCard) => void;
  onMake: (c: HomeWallCard) => void;
}) {
  if (cards && cards.length === 0) return null;
  return (
    <section aria-labelledby="home-still-making" className="mt-8">
      <SectionHead id="home-still-making" title={fallback ? HOME_V3_COPY.stillMakingAll : HOME_V3_COPY.stillMakingYours} link={{ to: "/corners", label: HOME_V3_COPY.seeAllCorners }} />
      <p className="-mt-2 mb-3 text-small text-muted-foreground">{fallback ? HOME_V3_COPY.followMore : WALL_COPY.stillMakingLine}</p>
      <HorizontalRow name="home-still-making" label={fallback ? HOME_V3_COPY.stillMakingAll : HOME_V3_COPY.stillMakingYours}>
        {cards === null
          ? [0, 1, 2, 3].map((i) => (
              <li key={i} aria-hidden="true" className="w-[260px] shrink-0 tab:w-[280px]">
                <Skeleton className="h-[320px] w-full rounded-card" />
              </li>
            ))
          : cards.map((c) => (
              <WallCard key={c.card.postId} card={c.card} kind="making" yoursStarted={false} onOpen={() => onOpen(c)} onMake={() => onMake(c)} className="w-[260px] shrink-0 snap-start tab:w-[280px]" />
            ))}
      </HorizontalRow>
    </section>
  );
}

/** Event tickets for the next 7 days. Not shown when there are none. */
export function HappeningSection({ events }: { events: HomeEvent[] }) {
  if (events.length === 0) return null;
  return (
    <section aria-labelledby="home-happening" className="mt-8">
      <SectionHead id="home-happening" title={HOME_V3_COPY.happening} />
      <HorizontalRow name="home-happening" label={HOME_V3_COPY.happening}>
        {events.map((e) => (
          <li key={e.id} className="w-[260px] shrink-0 snap-start tab:w-[300px]">
            <PressLink to={`/space/${e.spaceSlug}?tab=events`} className="block h-full rounded-card border border-border bg-card p-4">
              <span className="block text-caption text-muted-foreground">{formatStarts(e.startsAt, { timeZone: e.timezone })}</span>
              <span className="mt-1 line-clamp-2 block break-words text-small font-semibold">{e.title}</span>
              <span className="mt-1 block truncate text-caption text-muted-foreground">{e.spaceName}</span>
            </PressLink>
          </li>
        ))}
      </HorizontalRow>
    </section>
  );
}

/** In place of From your people while it is empty: bring someone in. */
export function BringPeopleCard() {
  const invite = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(`${INVITE_TEXT} ${window.location.origin}`)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };
  return (
    <section className="mt-8 rounded-card border border-border bg-card p-5">
      <h2 className="text-lead font-semibold">{HOME_V3_COPY.peopleTitle}</h2>
      <p className="mt-2 text-body text-muted-foreground">{HOME_V3_COPY.peopleLine}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <PillButton onClick={invite}>{HOME_V3_COPY.invite}</PillButton>
        <Link to="/people" className="inline-flex min-h-11 items-center rounded-full border border-foreground/30 px-5 text-body font-semibold">
          {HOME_V3_COPY.findContacts}
        </Link>
      </div>
    </section>
  );
}
