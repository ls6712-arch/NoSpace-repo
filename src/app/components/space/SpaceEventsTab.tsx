import { useEffect, useState } from "react";
import { MapPin, Star } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import {
  rsvpToEvent,
  cancelRsvp,
  cancelEvent,
  featureEvent,
  unfeatureEvent,
  listEventTeasers,
  type SpaceRow,
  type SpaceEventRow,
} from "../../lib/spaces";
import { Button } from "../ui/button";
import { CreateEventDialog } from "./CreateEventDialog";

function fmt(iso: string, tz: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: tz,
    });
  } catch {
    return new Date(iso).toLocaleString();
  }
}

type Teaser = { id: number; title: string; starts_at: string; timezone: string };

export function SpaceEventsTab({
  space,
  isActiveMember,
  isHost,
}: {
  space: SpaceRow;
  isActiveMember: boolean;
  isHost: boolean;
}) {
  const { user } = useAuth();
  const canSeeFull = space.access === "open" || isActiveMember;
  const [events, setEvents] = useState<SpaceEventRow[] | "loading">("loading");
  const [teasers, setTeasers] = useState<Teaser[] | "loading">("loading");
  const [myRsvps, setMyRsvps] = useState<Set<number>>(new Set());
  const [addressByEventId, setAddressByEventId] = useState<Map<number, string>>(new Map());
  const [createOpen, setCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<SpaceEventRow | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canCreate =
    isActiveMember && space.status === "active" && (space.events_created_by === "members" || isHost);

  const refetch = async () => {
    if (!supabase) return;
    if (!canSeeFull) {
      const { data } = await listEventTeasers(space.id);
      setTeasers(data ?? []);
      return;
    }
    const { data } = await supabase
      .from("space_events")
      .select("*")
      .eq("space_id", space.id)
      .order("starts_at", { ascending: true });
    const rows = (data as SpaceEventRow[]) ?? [];
    setEvents(rows);

    // event_private_details' own RLS already limits this to events the
    // caller is an active Space member for, or has a "going" RSVP on —
    // a plain select just returns whichever of those actually apply.
    if (rows.length > 0) {
      const { data: addressRows } = await supabase
        .from("event_private_details")
        .select("event_id, exact_address")
        .in("event_id", rows.map((r) => r.id));
      setAddressByEventId(new Map((addressRows ?? []).map((r) => [r.event_id as number, r.exact_address as string])));
    } else {
      setAddressByEventId(new Map());
    }

    if (user) {
      const { data: rsvps } = await supabase.from("event_rsvps").select("event_id").eq("user_id", user.id);
      setMyRsvps(new Set((rsvps ?? []).map((r) => r.event_id as number)));
    }
  };

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space.id, canSeeFull, user?.id]);

  const rsvp = async (eventId: number) => {
    setBusyId(eventId);
    setError(null);
    const { error: err } = await rsvpToEvent(eventId);
    setBusyId(null);
    if (err) return setError(err);
    refetch();
  };
  const unrsvp = async (eventId: number) => {
    setBusyId(eventId);
    setError(null);
    const { error: err } = await cancelRsvp(eventId);
    setBusyId(null);
    if (err) return setError(err);
    refetch();
  };
  const cancel = async (eventId: number) => {
    if (!confirm("Cancel this event? Everyone who RSVP'd will be notified.")) return;
    setBusyId(eventId);
    setError(null);
    const { error: err } = await cancelEvent(eventId);
    setBusyId(null);
    if (err) return setError(err);
    refetch();
  };
  const toggleFeature = async (event: SpaceEventRow) => {
    setBusyId(event.id);
    setError(null);
    const { error: err } = event.featured ? await unfeatureEvent(event.id) : await featureEvent(event.id);
    setBusyId(null);
    if (err) return setError(err);
    refetch();
  };

  if (!canSeeFull) {
    return (
      <div className="py-6">
        <p className="mb-4 text-xs text-muted-foreground">
          Join this Space to see event details and RSVP.
        </p>
        {teasers === "loading" ? (
          <div className="min-h-[20vh]" />
        ) : teasers.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No upcoming events.</p>
        ) : (
          <ul className="space-y-2">
            {teasers.map((t) => (
              <li key={t.id} className="rounded-2xl border border-border px-4 py-3">
                <p className="text-sm">{t.title}</p>
                <p className="text-xs text-muted-foreground">{fmt(t.starts_at, t.timezone)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (events === "loading") return <div className="min-h-[30vh]" />;

  const now = Date.now();
  const upcoming = events
    .filter((e) => e.status === "scheduled" && new Date(e.starts_at).getTime() > now)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const featured = upcoming.find((e) => e.featured);
  const rest = upcoming.filter((e) => e.id !== featured?.id);
  const ordered = featured ? [featured, ...rest] : rest;

  return (
    <div className="py-6">
      {canCreate && (
        <div className="mb-4">
          <Button variant="coral" size="sm" onClick={() => setCreateOpen(true)}>Create event</Button>
        </div>
      )}
      {error && <p className="mb-3 text-xs text-destructive">{error}</p>}

      {ordered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No upcoming events.</p>
      ) : (
        <ul className="space-y-3">
          {ordered.map((e) => {
            const going = myRsvps.has(e.id);
            const canEdit = isHost || e.created_by === user?.id;
            const address = addressByEventId.get(e.id);
            return (
              <li key={e.id} className="rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      {e.featured === true && <Star className="size-3.5 fill-current text-[var(--coral-deep)]" />}
                      {e.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{fmt(e.starts_at, e.timezone)}</p>
                    {(e.neighborhood || e.city) && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" />
                        {[e.neighborhood, e.city].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {address && (
                      <p className="mt-1 flex items-center gap-1 text-xs">
                        <MapPin className="size-3 text-[var(--coral-deep)]" />
                        {address}
                      </p>
                    )}
                    {e.description && <p className="mt-1.5 text-sm">{e.description}</p>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {going ? (
                    <Button variant="outline" size="sm" disabled={busyId === e.id} onClick={() => unrsvp(e.id)}>
                      Going — cancel
                    </Button>
                  ) : (
                    <Button
                      variant="coral"
                      size="sm"
                      disabled={busyId === e.id || space.status !== "active" || (space.access === "closed" && !isActiveMember)}
                      onClick={() => rsvp(e.id)}
                    >
                      RSVP
                    </Button>
                  )}
                  {isHost && (
                    <Button variant="outline" size="sm" disabled={busyId === e.id} onClick={() => toggleFeature(e)}>
                      {e.featured ? "Unfeature" : "Feature"}
                    </Button>
                  )}
                  {canEdit && (
                    <Button variant="outline" size="sm" disabled={busyId === e.id} onClick={() => setEditingEvent(e)}>
                      Edit
                    </Button>
                  )}
                  {canEdit && (
                    <Button variant="outline" size="sm" disabled={busyId === e.id} onClick={() => cancel(e.id)}>
                      Cancel event
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CreateEventDialog space={space} open={createOpen} onOpenChange={setCreateOpen} onSaved={refetch} />
      {editingEvent && (
        <CreateEventDialog
          space={space}
          event={editingEvent}
          eventAddress={addressByEventId.get(editingEvent.id)}
          open={!!editingEvent}
          onOpenChange={(o) => !o && setEditingEvent(null)}
          onSaved={refetch}
        />
      )}
    </div>
  );
}
