import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { cornerKey } from "../../data/homeCorners";
import type { MoodCard } from "../../data/moodCards";
import { fetchCornersLive, type CornerLive } from "../../lib/cornersLive";
import { nextEventTicket, type EventTicket } from "../../lib/eventTicket";
import { cancelRsvp, rsvpToEvent } from "../../lib/spaces";

/**
 * Event tickets for Discover's cards: for each card's Corner, the soonest
 * upcoming event in an Open Space, plus the signed-in viewer's "I’m going"
 * answers. A card with no event gets null and shows "How to start" instead.
 * Loads quietly after first paint; until it arrives every card is a
 * "How to start" card.
 */
export function useEventTickets(cards: readonly MoodCard[], userId: string | undefined) {
  const [live, setLive] = useState<Map<string, CornerLive>>(new Map());
  const [going, setGoing] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(new Set<string>());

  const targets = useMemo(
    () => cards.map((c) => ({ spaceSlug: c.spaceSlug, slug: c.cornerSlug })),
    [cards],
  );

  useEffect(() => {
    const fresh = targets.filter((t) => !loaded.current.has(cornerKey(t)));
    if (fresh.length === 0) return;
    let cancelled = false;
    // Open Spaces only, every upcoming event (not just this week).
    fetchCornersLive({ targets: fresh, full: true, openOnly: true }).then((m) => {
      if (cancelled) return;
      for (const k of m.keys()) loaded.current.add(k);
      setLive((prev) => new Map([...prev, ...m]));
    });
    return () => {
      cancelled = true;
    };
  }, [targets]);

  const tickets = useMemo(() => {
    const now = Date.now();
    return new Map(cards.map((c) => [cornerKey({ spaceSlug: c.spaceSlug, slug: c.cornerSlug }), nextEventTicket(live.get(cornerKey({ spaceSlug: c.spaceSlug, slug: c.cornerSlug })), now)]));
  }, [cards, live]);
  const ticketFor = useCallback(
    (c: MoodCard): EventTicket | null => tickets.get(cornerKey({ spaceSlug: c.spaceSlug, slug: c.cornerSlug })) ?? null,
    [tickets],
  );

  const eventIds = useMemo(
    () => [...tickets.values()].flatMap((t) => (t ? [t.event.id] : [])).sort((a, b) => a - b),
    [tickets],
  );
  const idsKey = eventIds.join(",");
  useEffect(() => {
    if (!supabase || !userId || eventIds.length === 0) return;
    let cancelled = false;
    Promise.resolve(supabase.from("event_rsvps").select("event_id").eq("user_id", userId).in("event_id", eventIds)).then(({ data }) => {
      if (cancelled) return;
      setGoing((prev) => new Set([...prev, ...(data ?? []).map((r) => r.event_id as number)]));
    });
    return () => {
      cancelled = true;
    };
    // eventIds is derived from idsKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, userId]);

  const toggleGoing = useCallback(
    async (eventId: number) => {
      setBusy(eventId);
      setError(null);
      const isGoing = going.has(eventId);
      const { error: err } = isGoing ? await cancelRsvp(eventId) : await rsvpToEvent(eventId);
      setBusy(null);
      if (err) return setError(err);
      setGoing((prev) => {
        const next = new Set(prev);
        if (isGoing) next.delete(eventId);
        else next.add(eventId);
        return next;
      });
    },
    [going],
  );

  return { ticketFor, going, busy, error, toggleGoing };
}
