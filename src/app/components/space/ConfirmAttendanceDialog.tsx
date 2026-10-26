import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { confirmEventAttendance, type SpaceEventRow } from "../../lib/spaces";
import { plural } from "../../lib/plural";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { EmptyState, InlineError } from "../StateViews";
import { notify } from "../ui/toaster";

interface Guest {
  userId: string;
  name: string;
  avatarUrl?: string;
  confirmed: boolean;
}

const initials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

/**
 * After an event ends, a host ticks who showed up from the people who said
 * "I'm going", then confirms. Each confirmed person gets one Stub. The host's
 * own name is not listed: another host confirms them.
 */
export function ConfirmAttendanceDialog({
  event,
  open,
  onOpenChange,
}: {
  event: SpaceEventRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const [guests, setGuests] = useState<Guest[] | "loading">("loading");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !supabase) return;
    let cancelled = false;
    (async () => {
      setGuests("loading");
      setPicked(new Set());
      setError(null);
      const [rsvps, stubs] = await Promise.all([
        supabase!.from("event_rsvps").select("user_id").eq("event_id", event.id),
        supabase!.from("stubs").select("user_id").eq("event_id", event.id),
      ]);
      const ids = (rsvps.data ?? []).map((r) => r.user_id as string).filter((id) => id !== user?.id);
      const done = new Set((stubs.data ?? []).map((s) => s.user_id as string));
      const { data: profiles } = ids.length
        ? await supabase!.from("profiles").select("id, display_name, avatar_url").in("id", ids)
        : { data: [] as { id: string; display_name: string | null; avatar_url: string | null }[] };
      if (cancelled) return;
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      setGuests(
        ids.map((id) => ({
          userId: id,
          name: byId.get(id)?.display_name?.trim() || "Someone",
          avatarUrl: byId.get(id)?.avatar_url ?? undefined,
          confirmed: done.has(id),
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [open, event.id, user?.id]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function confirm() {
    setBusy(true);
    setError(null);
    const { data, error: err } = await confirmEventAttendance(event.id, [...picked]);
    setBusy(false);
    if (err) return setError(err);
    notify(`${plural(data ?? picked.size, "Stub")} confirmed.`);
    onOpenChange(false);
  }

  const list = Array.isArray(guests) ? guests : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>Who came?</DialogTitle>
          <DialogDescription className="line-clamp-2 break-words">{event.title}</DialogDescription>
        </DialogHeader>
        {guests !== "loading" && list.length === 0 ? (
          <EmptyState size="inline" line="No one said they were going." />
        ) : (
          <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
            {list.map((g) => (
              <li key={g.userId}>
                <label className="flex min-h-11 items-center gap-3 rounded-control px-2 hover:bg-surface-muted">
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--accent)]"
                    checked={g.confirmed || picked.has(g.userId)}
                    disabled={g.confirmed || busy}
                    onChange={() => toggle(g.userId)}
                  />
                  <Avatar className="size-8">
                    {g.avatarUrl && <AvatarImage src={g.avatarUrl} alt="" />}
                    <AvatarFallback className="text-caption">{initials(g.name)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-small">{g.name}</span>
                  {g.confirmed && <span className="text-caption text-muted-foreground">Confirmed</span>}
                </label>
              </li>
            ))}
          </ul>
        )}
        <InlineError message={error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="coral" disabled={busy || picked.size === 0} onClick={confirm}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
