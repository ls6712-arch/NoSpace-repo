import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { ImageWithFallback } from "../ImageWithFallback";
import { PillButton } from "../ui/PillButton";
import { fetchEventsThisWeek, fetchSuggestedSpaces, type NearbyEvent, type SuggestedSpace } from "../../lib/homeEmpty";
import { formatDateTime } from "../../lib/dates";

const INVITE_TEXT = "I'm using Soosh to try new things with friends. Come along?";

/** Home with nothing from your people yet: an invite, what is on near you, a few Spaces to follow. */
export function HomeEmpty() {
  const [events, setEvents] = useState<NearbyEvent[] | null>(null);
  const [spaces, setSpaces] = useState<SuggestedSpace[] | null>(null);
  useEffect(() => {
    void fetchEventsThisWeek().then(setEvents);
    void fetchSuggestedSpaces().then(setSpaces);
  }, []);
  const invite = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(`${INVITE_TEXT} ${window.location.origin}`)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-card border border-border bg-card p-5">
        <h2 className="text-lead font-semibold">Soosh is better with your people</h2>
        <p className="mt-2 text-body text-muted-foreground">Bring a friend and start your first Pursuit together.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <PillButton onClick={invite}>Invite on WhatsApp</PillButton>
          <Link to="/people" className="inline-flex min-h-11 items-center rounded-full border border-foreground/30 px-5 text-body font-semibold">
            Find contacts
          </Link>
        </div>
      </section>

      {events && events.length > 0 && (
        <section aria-labelledby="near-you">
          <h2 id="near-you" className="mb-3 text-lead font-semibold">
            Happening near you this week
          </h2>
          <ul className="flex flex-col gap-3">
            {events.map((e) => (
              <li key={e.id}>
                <Link to={`/space/${e.spaceSlug}?tab=events`} className="flex min-h-16 items-center gap-3 rounded-card bg-card p-3">
                  <span className="size-14 shrink-0 overflow-hidden rounded-control bg-surface-muted">
                    {e.coverImage && <ImageWithFallback src={e.coverImage} alt="" className="size-full object-cover" width={112} />}
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-body font-semibold">{`${e.title.slice(0, 60)} · ${formatDateTime(e.startsAt)}`}</span>
                    <span className="block truncate text-small text-muted-foreground">{[e.spaceName, e.where].filter(Boolean).join(" · ")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {spaces && spaces.length > 0 && (
        <section aria-labelledby="follow-spaces">
          <h2 id="follow-spaces" className="mb-3 text-lead font-semibold">
            Follow a few Spaces
          </h2>
          <ul className="grid grid-cols-3 gap-3">
            {spaces.map((s) => (
              <li key={s.id}>
                <Link to={`/space/${s.slug}`} className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-card bg-card p-3 text-center">
                  <Avatar className="size-12">
                    {s.coverImage && <AvatarImage src={s.coverImage} alt="" />}
                    <AvatarFallback className="text-small">{s.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="line-clamp-2 text-small">{s.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
