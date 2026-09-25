import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { MapPin, Star, Users } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { requestOrJoinSpace, cancelJoinRequest, leaveSpace, spaceMomentCount30d, listEventTeasers, type SpaceRow, type SpaceMemberRow } from "../lib/spaces";
import { capitalizeCornerName } from "../context/CornersContext";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { AddMomentToSpaceDialog } from "../components/AddMomentToSpaceDialog";
import { SpaceMomentsTab } from "../components/space/SpaceMomentsTab";
import { SpaceEventsTab } from "../components/space/SpaceEventsTab";
import { SpacePeopleTab } from "../components/space/SpacePeopleTab";
import { SpaceManageTab } from "../components/space/SpaceManageTab";

type CornerLite = { slug: string; name: string; isPrimary: boolean };
type HostLite = { id: string; name: string };
/** Just enough to render the featured-event banner — the direct
 * space_events row (members) or a list_event_teasers row (outsiders of a
 * Closed Space, who can't read space_events directly) both satisfy this. */
type FeaturedEventLite = { title: string; starts_at: string; timezone: string };

function fmt(iso: string, tz: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: tz });
  } catch {
    return new Date(iso).toLocaleString();
  }
}

const TABS = ["moments", "events", "people", "manage"] as const;

export function SpacePage({ space }: { space: SpaceRow }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab = (TABS as readonly string[]).includes(rawTab ?? "") ? (rawTab as (typeof TABS)[number]) : "moments";

  const [membership, setMembership] = useState<SpaceMemberRow | null | "loading">("loading");
  const [momentCount, setMomentCount] = useState<number | null>(null);
  const [corners, setCorners] = useState<CornerLite[]>([]);
  const [hosts, setHosts] = useState<HostLite[]>([]);
  const [spaceAddress, setSpaceAddress] = useState<string | null>(null);
  const [featuredEvent, setFeaturedEvent] = useState<FeaturedEventLite | null>(null);
  const [featuredEventAddress, setFeaturedEventAddress] = useState<string | null>(null);
  const [addMomentOpen, setAddMomentOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const refetchMembership = async () => {
    if (!supabase || !user) return setMembership(null);
    const { data } = await supabase
      .from("space_members")
      .select("*")
      .eq("space_id", space.id)
      .eq("user_id", user.id)
      .maybeSingle();
    setMembership((data as SpaceMemberRow) ?? null);
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) return;
      const [{ data: cornerRows }, { data: hostRows }, momentCountResult, { data: addressRow }, { data: featuredRows }] = await Promise.all([
        supabase
          .from("space_corners")
          .select("is_primary, added_at, corners(slug, name)")
          .eq("space_id", space.id)
          .order("is_primary", { ascending: false })
          .order("added_at", { ascending: true }),
        supabase
          .from("space_members")
          .select("user_id")
          .eq("space_id", space.id)
          .eq("role", "host")
          .eq("status", "active"),
        spaceMomentCount30d(space.id),
        // space_private_details' own RLS ("members read the exact
        // address") already limits this to an active member — a
        // non-member's query just returns 0 rows.
        supabase.from("space_private_details").select("exact_address").eq("space_id", space.id).maybeSingle(),
        supabase
          .from("space_events")
          .select("*")
          .eq("space_id", space.id)
          .eq("featured", true)
          .eq("status", "scheduled")
          .gt("starts_at", new Date().toISOString())
          .limit(1),
      ]);
      const count = momentCountResult.data;
      if (cancelled) return;
      setCorners(
        (cornerRows ?? [])
          .map((r: any) => r.corners && { slug: r.corners.slug, name: capitalizeCornerName(r.corners.name), isPrimary: r.is_primary })
          .filter(Boolean),
      );
      setSpaceAddress(addressRow?.exact_address ?? null);
      const directFe = (featuredRows as { id: number; title: string; starts_at: string; timezone: string }[] | null)?.[0] ?? null;
      let feId: number | null = null;
      if (directFe) {
        setFeaturedEvent(directFe);
        feId = directFe.id;
      } else if (space.access === "closed") {
        // RLS hides space_events entirely from a non-member of a Closed
        // Space — list_event_teasers is the sanctioned way for them to
        // see which upcoming event (if any) is featured. No address:
        // event_private_details is gated the same way space_events is,
        // so there's nothing further to fetch for an outsider.
        const { data: teasers } = await listEventTeasers(space.id);
        if (!cancelled) setFeaturedEvent(teasers?.find((t) => t.featured) ?? null);
      } else {
        setFeaturedEvent(null);
      }
      if (feId != null) {
        // Same RLS-decides pattern as the Space's own address — a
        // "going" RSVP or active membership is what unlocks this row.
        const { data: feAddress } = await supabase
          .from("event_private_details")
          .select("exact_address")
          .eq("event_id", feId)
          .maybeSingle();
        if (!cancelled) setFeaturedEventAddress(feAddress?.exact_address ?? null);
      } else {
        setFeaturedEventAddress(null);
      }
      // space_members.user_id references auth.users, not profiles — no FK
      // PostgREST can embed through, so profiles is a separate lookup.
      const hostIds = (hostRows ?? []).map((r) => r.user_id as string);
      const { data: hostProfiles } = hostIds.length
        ? await supabase.from("profiles").select("id, display_name").in("id", hostIds)
        : { data: [] as { id: string; display_name: string }[] };
      if (cancelled) return;
      setHosts((hostProfiles ?? []).map((p) => ({ id: p.id, name: p.display_name || "Someone" })));
      setMomentCount(count ?? 0);
    }
    load();
    refetchMembership();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space.id, user?.id]);

  const activeMembership: SpaceMemberRow | null = membership === "loading" ? null : membership;
  const isHost = !!activeMembership && activeMembership.role === "host" && activeMembership.status === "active";
  const isActiveMember = !!activeMembership && activeMembership.status === "active";
  const isPending = !!activeMembership && activeMembership.status === "pending";
  const isBanned = !!activeMembership && activeMembership.status === "banned";
  const canManage = isHost || (isActiveMember && !!space.host_handoff_started_at);

  const setTab = (next: string) => setSearchParams((p) => ({ ...Object.fromEntries(p), tab: next }), { replace: true });

  const join = async () => {
    setActionBusy(true);
    setActionError(null);
    const { error } = await requestOrJoinSpace(space.id);
    setActionBusy(false);
    if (error) return setActionError(error);
    await refetchMembership();
  };
  const cancelRequest = async () => {
    setActionBusy(true);
    setActionError(null);
    const { error } = await cancelJoinRequest(space.id);
    setActionBusy(false);
    if (error) return setActionError(error);
    await refetchMembership();
  };
  const leave = async () => {
    if (!confirm(`Leave ${space.name}?`)) return;
    setActionBusy(true);
    setActionError(null);
    const { error } = await leaveSpace(space.id);
    setActionBusy(false);
    if (error) return setActionError(error);
    await refetchMembership();
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="relative aspect-[21/9] w-full max-h-80 overflow-hidden bg-surface-muted sm:aspect-[3/1]">
        <img src={space.cover_image} alt="" className="size-full object-cover" />
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 pt-6">
        {space.status === "read_only" && (
          <div className="mb-4 rounded-2xl border border-[var(--coral-deep)]/30 bg-[var(--coral-deep)]/5 px-4 py-3 text-sm">
            This Space is read-only right now — no new members, requests, or events until it's reactivated.
          </div>
        )}
        {space.status === "deleted" && (
          <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
            This Space has been deleted. You're seeing it as an admin.
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>{space.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{space.description}</p>
          </div>
          <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
            {space.access === "open" ? "Open" : "Closed"}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {corners.map((c) => (
            <Link
              key={c.slug}
              to={`/corner/${c.slug}`}
              className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-foreground/30"
            >
              {c.name}
            </Link>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {(space.neighborhood || space.city) && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" />
              {[space.neighborhood, space.city].filter(Boolean).join(", ")}
            </span>
          )}
          {hosts.length > 0 && (
            <span className="flex items-center gap-1">
              <Users className="size-3.5" />
              Hosted by {hosts.map((h) => h.name).join(", ")}
            </span>
          )}
          <span>{momentCount ?? 0} Moment{momentCount === 1 ? "" : "s"} this month</span>
        </div>

        {spaceAddress && (
          <p className="mt-1.5 flex items-center gap-1 text-xs">
            <MapPin className="size-3.5 text-[var(--coral-deep)]" />
            {spaceAddress}
          </p>
        )}

        {featuredEvent && (
          <Link
            to={`/space/${space.slug}?tab=events`}
            className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--coral-deep)]/40 bg-[var(--coral-deep)]/5 px-4 py-3 hover:border-[var(--coral-deep)]"
          >
            <Star className="size-4 shrink-0 fill-current text-[var(--coral-deep)]" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{featuredEvent.title}</p>
              <p className="text-xs text-muted-foreground">{fmt(featuredEvent.starts_at, featuredEvent.timezone)}</p>
              {featuredEventAddress && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" />
                  {featuredEventAddress}
                </p>
              )}
            </div>
          </Link>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {isBanned ? null : isActiveMember ? (
            <>
              {isHost && hosts.length <= 1 ? (
                <p className="text-xs text-muted-foreground">Invite a co-host before leaving.</p>
              ) : (
                <Button variant="outline" size="sm" disabled={actionBusy} onClick={leave}>Leave</Button>
              )}
              <Button variant="coral" size="sm" onClick={() => setAddMomentOpen(true)}>Add Moment</Button>
            </>
          ) : isPending ? (
            <Button variant="outline" size="sm" disabled={actionBusy} onClick={cancelRequest}>Requested — cancel</Button>
          ) : space.access === "open" ? (
            <Button variant="coral" size="sm" disabled={actionBusy || !user || space.status !== "active"} onClick={join}>
              Join
            </Button>
          ) : (
            <RequestToJoinButton spaceId={space.id} disabled={actionBusy || !user || space.status !== "active"} onDone={refetchMembership} setError={setActionError} />
          )}
          {isHost && (
            <Link to={`/space/${space.slug}/edit`}>
              <Button variant="outline" size="sm">Edit Space</Button>
            </Link>
          )}
        </div>
        {actionError && <p className="mt-2 text-xs text-destructive">{actionError}</p>}
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 pt-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="moments">Moments</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="people">People</TabsTrigger>
            {canManage && <TabsTrigger value="manage">Manage</TabsTrigger>}
          </TabsList>
          <TabsContent value="moments">
            <SpaceMomentsTab space={space} isActiveMember={!!isActiveMember} />
          </TabsContent>
          <TabsContent value="events">
            <SpaceEventsTab space={space} isActiveMember={!!isActiveMember} isHost={!!isHost} />
          </TabsContent>
          <TabsContent value="people">
            <SpacePeopleTab space={space} />
          </TabsContent>
          {canManage && (
            <TabsContent value="manage">
              <SpaceManageTab space={space} isHost={isHost} viewerJoinedAt={activeMembership?.joined_at} />
            </TabsContent>
          )}
        </Tabs>
      </div>

      <AddMomentToSpaceDialog
        spaceId={space.id}
        open={addMomentOpen}
        onOpenChange={setAddMomentOpen}
      />
    </div>
  );
}

/** Closed-Space "Request to join": an optional message + an optional one
 * of the caller's own public Moments, in a small inline dialog. */
function RequestToJoinButton({
  spaceId,
  disabled,
  onDone,
  setError,
}: {
  spaceId: string;
  disabled?: boolean;
  onDone: () => void;
  setError: (e: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [posts, setPosts] = useState<{ id: number; caption: string }[]>([]);
  const [postId, setPostId] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!open || !supabase || !user) return;
    supabase
      .from("posts")
      .select("id, caption")
      .eq("user_id", user.id)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setPosts(data ?? []));
  }, [open, user]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const { error } = await requestOrJoinSpace(spaceId, message.trim() || undefined, postId);
    setBusy(false);
    if (error) return setError(error);
    setOpen(false);
    onDone();
  };

  if (!open) {
    return (
      <Button variant="coral" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        Request to join
      </Button>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-border p-3">
      <textarea
        className="w-full resize-none rounded-lg border border-border bg-transparent p-2 text-sm"
        rows={2}
        maxLength={300}
        placeholder="A short note to the hosts (optional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      {posts.length > 0 && (
        <select
          className="mt-2 w-full rounded-lg border border-border bg-transparent p-2 text-sm"
          value={postId ?? ""}
          onChange={(e) => setPostId(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">Attach one of your Moments (optional)</option>
          {posts.map((p) => (
            <option key={p.id} value={p.id}>{p.caption?.slice(0, 60) || `Moment #${p.id}`}</option>
          ))}
        </select>
      )}
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
        <Button variant="coral" size="sm" onClick={submit} disabled={busy}>{busy ? "Sending…" : "Send request"}</Button>
      </div>
    </div>
  );
}
