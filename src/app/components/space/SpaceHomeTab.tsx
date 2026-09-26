import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { MapPin, Star, ArrowRight, X, Pin, PinOff } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useJournal } from "../../lib/journal";
import { fetchFollowingIds } from "../../lib/profileFollows";
import { rowToPost } from "../../context/ContentContext";
import { rsvpToEvent, cancelRsvp, type SpaceRow, type SpaceEventRow } from "../../lib/spaces";
import { MomentCard } from "../MomentCard";
import { MomentDetail } from "../MomentDetail";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import type { Post } from "../../data/posts";

type HostLite = { id: string; name: string; avatarUrl?: string };
type Attendee = { userId: string; name: string; avatarUrl?: string };
type SpaceMoment = Post & { featured: boolean; status: "approved" | "pending" };

// Literal utility classes (Tailwind's scanner needs them written out, not
// built from a template) — alternating so adjacent cards never tilt the
// same way, "pinned to a table" rather than a stack. motion-safe: only,
// per prefers-reduced-motion.
const TILTS = ["motion-safe:-rotate-2", "motion-safe:rotate-3", "motion-safe:-rotate-3", "motion-safe:rotate-2"];

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function fmtTime(iso: string, tz: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: tz });
  } catch {
    return new Date(iso).toLocaleString();
  }
}

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short" });
}

function hoursUntil(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 3600000));
}

function AvatarRow({ people, max = 4 }: { people: Attendee[]; max?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  if (people.length === 0) return null;
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <Avatar key={p.userId} className={`size-7 border-2 border-paper ${i > 0 ? "-ml-2" : ""}`}>
          {p.avatarUrl && <AvatarImage src={p.avatarUrl} alt="" />}
          <AvatarFallback className="text-[9px]">{initials(p.name)}</AvatarFallback>
        </Avatar>
      ))}
      {extra > 0 && (
        <span className="-ml-2 flex size-7 items-center justify-center rounded-full border-2 border-paper bg-sand text-[10px] text-muted-foreground">
          +{extra}
        </span>
      )}
    </div>
  );
}

/** The Home tab: the event band, the "Settling in" (members) / "Set up
 * your Space" (hosts) checklist, and the "On the table" Moment grid — up
 * to 3 pinned Moments (space_moments.featured, now at most 3 per Space —
 * see 20261004000000_spaces_rework_moments_pin_limit.sql) grouped first,
 * then the rest newest-first — plus host badges. Everything here is read
 * from data that already exists; pin/unpin is a direct write through the
 * existing "hosts feature or remove" UPDATE policy, no new RPC. */
export function SpaceHomeTab({
  space,
  isActiveMember,
  isHost,
  hosts,
  onAddMoment,
  momentsRefreshKey,
}: {
  space: SpaceRow;
  isActiveMember: boolean;
  isHost: boolean;
  hosts: HostLite[];
  onAddMoment: () => void;
  /** Bumped by the parent right after a Moment is linked into this Space
   * (from the Add Moment dialog) — included below so that refetches the
   * grid, which in turn recomputes the "Share a Moment" checklist step.
   * Pin/unpin already update local state directly and don't need this. */
  momentsRefreshKey?: number;
}) {
  const { user } = useAuth();
  const journal = useJournal();

  const [upcoming, setUpcoming] = useState<SpaceEventRow[] | "loading">("loading");
  const [myRsvps, setMyRsvps] = useState<Set<number>>(new Set());
  const [todayAttendees, setTodayAttendees] = useState<Attendee[]>([]);
  const [todayGoing, setTodayGoing] = useState(0);
  const [todayAddress, setTodayAddress] = useState<string | null>(null);
  const [rsvpBusy, setRsvpBusy] = useState(false);

  const [moments, setMoments] = useState<SpaceMoment[] | "loading">("loading");
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [pinBusyId, setPinBusyId] = useState<number | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  const [followsMember, setFollowsMember] = useState(false);
  const [rsvpedHere, setRsvpedHere] = useState(false);
  const [sharedHere, setSharedHere] = useState(false);
  const [hasEverHadEvent, setHasEverHadEvent] = useState(false);
  const [checklistReady, setChecklistReady] = useState(false);
  // Starts visible — only hidden once localStorage actually confirms a
  // prior dismissal (read in the effect below). Defaulting to true would
  // hide it before that read ever runs, permanently, for anyone the
  // dismissKey effect never reaches (no user yet on first paint, storage
  // blocked, etc.) — never dismissed shouldn't mean never shown.
  const [dismissed, setDismissed] = useState(false);

  const startedPursuit = useMemo(
    () => !!space.category_slug && journal.projects.some((p) => p.hobbySlug === space.category_slug),
    [journal.projects, space.category_slug],
  );

  const dismissKey = user
    ? `sushii.spaces.settlingIn.dismissed.${isHost ? "host" : "member"}.${user.id}.${space.id}`
    : null;

  useEffect(() => {
    if (!dismissKey) return;
    try {
      setDismissed(window.localStorage.getItem(dismissKey) === "1");
    } catch {
      setDismissed(false);
    }
  }, [dismissKey]);

  const dismiss = () => {
    setDismissed(true);
    if (!dismissKey) return;
    try {
      window.localStorage.setItem(dismissKey, "1");
    } catch {
      // best effort — a checklist that reappears next visit is a minor cost
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function loadEvents() {
      if (!supabase || !isActiveMember) {
        if (!cancelled) setUpcoming([]);
        return;
      }
      const { data } = await supabase
        .from("space_events")
        .select("*")
        .eq("space_id", space.id)
        .eq("status", "scheduled")
        .gt("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(6);
      if (cancelled) return;
      const rows = (data as SpaceEventRow[]) ?? [];
      setUpcoming(rows);

      if (user) {
        const { data: mine } = await supabase
          .from("event_rsvps")
          .select("event_id")
          .eq("user_id", user.id)
          .in("event_id", rows.map((r) => r.id).length ? rows.map((r) => r.id) : [-1]);
        if (!cancelled) setMyRsvps(new Set((mine ?? []).map((r) => r.event_id as number)));
        // Also used by the "Settling in" checklist — has this member ever
        // RSVP'd to anything in this Space, not just an upcoming one.
        const { data: everRsvped } = await supabase
          .from("event_rsvps")
          .select("event_id, space_events!inner(space_id)")
          .eq("user_id", user.id)
          .eq("space_events.space_id", space.id)
          .limit(1);
        if (!cancelled) setRsvpedHere((everRsvped ?? []).length > 0);
      }

      const today = rows.find((r) => new Date(r.starts_at).toDateString() === new Date().toDateString());
      if (today) {
        const { data: rsvps } = await supabase.from("event_rsvps").select("user_id").eq("event_id", today.id);
        const userIds = [...new Set((rsvps ?? []).map((r) => r.user_id as string))];
        if (!cancelled) setTodayGoing(userIds.length);
        const { data: profilesData } = userIds.length
          ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", userIds)
          : { data: [] as { id: string; display_name: string; avatar_url: string | null }[] };
        if (!cancelled) {
          setTodayAttendees(
            (profilesData ?? []).map((p) => ({ userId: p.id, name: p.display_name || "Someone", avatarUrl: p.avatar_url ?? undefined })),
          );
        }
        const { data: addressRow } = await supabase
          .from("event_private_details")
          .select("exact_address")
          .eq("event_id", today.id)
          .maybeSingle();
        if (!cancelled) setTodayAddress(addressRow?.exact_address ?? null);
      } else {
        setTodayGoing(0);
        setTodayAttendees([]);
        setTodayAddress(null);
      }
    }
    loadEvents();
    return () => {
      cancelled = true;
    };
  }, [space.id, space.category_slug, isActiveMember, user?.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadMoments() {
      if (!supabase) return;
      // space_moments' own "follows the space's access" SELECT policy
      // already limits this to what the caller can actually see: every
      // approved link (Open, or an active member), plus — pending ones
      // only — the poster's own and a host's view of every pending one.
      // This grid deliberately shows less than that raw set, though: it's
      // a public-facing preview of the Space (same thing "N Moments this
      // month" in the header counts, which only ever counts approved
      // ones), not a moderation queue, so a pending Moment only ever
      // renders here for its own author (labelled), never for a host
      // looking at someone else's — that review happens on Manage.
      const { data } = await supabase
        .from("space_moments")
        .select("added_at, featured, status, posts(*)")
        .eq("space_id", space.id)
        .order("featured", { ascending: false })
        .order("added_at", { ascending: false })
        .limit(15);
      if (cancelled) return;
      const rows = (data ?? []).filter((r: any) => r.posts);
      const userIds = [...new Set(rows.map((r: any) => r.posts.user_id as string))];
      const { data: profilesData } = userIds.length
        ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
        : { data: [] as { id: string; display_name: string }[] };
      if (cancelled) return;
      const nameById = new Map((profilesData ?? []).map((p) => [p.id, p.display_name]));
      const allRows = rows.map((r: any) => ({
        ...rowToPost(r.posts, nameById.get(r.posts.user_id) ?? "Someone"),
        featured: !!r.featured,
        status: r.status as "approved" | "pending",
      })) as SpaceMoment[];
      const posts = allRows.filter((p) => p.status === "approved" || (user && p.userId === user.id));
      setMoments(posts);
      // Submitting (even still pending) already counts as having shared
      // one — the checklist step is "Share a Moment here", not "get one
      // approved".
      if (user) setSharedHere(allRows.some((p) => p.userId === user.id));
    }
    loadMoments();
    return () => {
      cancelled = true;
    };
  }, [space.id, user?.id, momentsRefreshKey]);

  useEffect(() => {
    let cancelled = false;
    async function loadHostChecklistData() {
      if (!supabase || !isHost) return;
      // Any event this Space has ever had, scheduled or not — not just an
      // upcoming one (`upcoming` above only ever holds future, scheduled
      // rows) — the host checklist's "Plan your first event" just wants
      // to know one was ever made.
      const { count } = await supabase
        .from("space_events")
        .select("id", { count: "exact", head: true })
        .eq("space_id", space.id);
      if (!cancelled) setHasEverHadEvent((count ?? 0) > 0);
    }
    loadHostChecklistData();
    return () => {
      cancelled = true;
    };
  }, [space.id, isHost]);

  useEffect(() => {
    let cancelled = false;
    async function loadFollow() {
      if (!supabase || !user || !isActiveMember) {
        if (!cancelled) setChecklistReady(true);
        return;
      }
      const { data: memberRows } = await supabase
        .from("space_members")
        .select("user_id")
        .eq("space_id", space.id)
        .eq("status", "active")
        .neq("user_id", user.id);
      const memberIds = new Set((memberRows ?? []).map((r) => r.user_id as string));
      const followingIds = await fetchFollowingIds(user.id);
      if (!cancelled) {
        setFollowsMember(followingIds.some((id) => memberIds.has(id)));
        setChecklistReady(true);
      }
    }
    loadFollow();
    return () => {
      cancelled = true;
    };
  }, [space.id, user?.id, isActiveMember]);

  const rsvp = async (eventId: number) => {
    setRsvpBusy(true);
    const going = myRsvps.has(eventId);
    const { error } = going ? await cancelRsvp(eventId) : await rsvpToEvent(eventId);
    setRsvpBusy(false);
    if (error) return;
    setMyRsvps((prev) => {
      const next = new Set(prev);
      going ? next.delete(eventId) : next.add(eventId);
      return next;
    });
    setTodayGoing((n) => n + (going ? -1 : 1));
  };

  const upcomingList = upcoming === "loading" ? [] : upcoming;
  const todayEvent = upcomingList.find((e) => new Date(e.starts_at).toDateString() === new Date().toDateString());
  const nextEvent = !todayEvent ? upcomingList[0] : undefined;
  const nextWithinWeek = nextEvent && new Date(nextEvent.starts_at).getTime() - Date.now() <= 7 * 24 * 3600 * 1000;
  const laterThisWeek = todayEvent
    ? upcomingList.filter((e) => e.id !== todayEvent.id && new Date(e.starts_at).getTime() - Date.now() <= 7 * 24 * 3600 * 1000).slice(0, 3)
    : [];

  type ChecklistItem = {
    key: string;
    label: string;
    done: boolean;
    // The step's "Next: …" action — a Link when `to` is set, an
    // onClick button (opening a dialog owned by an ancestor, e.g. Add
    // Moment) otherwise. The button always reads "Next: <label>" (the
    // step's own name, e.g. "Next: Add rules") — it names the step, not
    // a separately-worded call to action, so it's never in doubt which
    // checklist item pressing it addresses.
    to?: string;
    onClick?: () => void;
  };

  const checklist: ChecklistItem[] = [
    { key: "join", label: "Join the Space", done: isActiveMember },
    { key: "follow", label: "Follow a fellow member", done: followsMember, to: `/space/${space.slug}?tab=people` },
    { key: "pursuit", label: "Start a Pursuit", done: startedPursuit, to: "/pursuits/new" },
    { key: "rsvp", label: "RSVP to an event", done: rsvpedHere, to: `/space/${space.slug}?tab=events` },
    { key: "moment", label: "Share a Moment here", done: sharedHere, onClick: onAddMoment },
  ];

  const hostChecklist: ChecklistItem[] = [
    { key: "cover", label: "Add a cover photo", done: !!space.cover_image, to: `/space/${space.slug}/edit` },
    { key: "rules", label: "Add rules", done: !!space.rules?.trim(), to: `/space/${space.slug}/edit` },
    { key: "event", label: "Plan your first event", done: hasEverHadEvent, to: `/space/${space.slug}?tab=events` },
    // The People tab (task: real "Invite as co-host" action per member)
    // is where inviting actually happens now, not Manage.
    { key: "cohost", label: "Invite a co-host", done: hosts.length > 1, to: `/space/${space.slug}?tab=people` },
    { key: "moment", label: "Share the first Moment", done: sharedHere, onClick: onAddMoment },
  ];

  const activeChecklist = isHost ? hostChecklist : checklist;
  const checklistTitle = isHost ? "Set up your Space" : "Settling in";
  const nextStep = activeChecklist.find((c) => !c.done);
  const checklistComplete = checklistReady && !nextStep;

  const momentsLoaded = moments !== "loading" ? moments : [];
  const approvedMoments = momentsLoaded.filter((m) => m.status === "approved");
  const myPendingMoments = user ? momentsLoaded.filter((m) => m.status === "pending" && m.userId === user.id) : [];
  const pinnedMoments = approvedMoments.filter((m) => m.featured).slice(0, 3);
  const pinnedIds = new Set(pinnedMoments.map((m) => m.id));
  const restMoments = approvedMoments.filter((m) => !pinnedIds.has(m.id)).slice(0, 12);
  const tableEmpty = pinnedMoments.length === 0 && restMoments.length === 0;

  const togglePin = async (post: SpaceMoment) => {
    if (!supabase) return;
    setPinError(null);
    if (!post.featured && pinnedMoments.length >= 3) {
      setPinError("Unpin one first.");
      return;
    }
    setPinBusyId(post.id);
    const { error } = await supabase
      .from("space_moments")
      .update({ featured: !post.featured })
      .eq("space_id", space.id)
      .eq("post_id", post.id);
    setPinBusyId(null);
    if (error) {
      setPinError(error.message || "Couldn't update that Moment.");
      return;
    }
    setMoments((prev) =>
      prev === "loading" ? prev : prev.map((m) => (m.id === post.id ? { ...m, featured: !post.featured } : m)),
    );
  };

  return (
    <div className="space-y-8 py-6">
      {/* ── Event band ─────────────────────────────────────────────────── */}
      {isActiveMember && todayEvent && (
        <div className="-mx-4 rounded-2xl bg-bark px-5 py-5 text-paper sm:mx-0">
          <p className="text-[11px] uppercase tracking-wide text-paper/70">Starts in {hoursUntil(todayEvent.starts_at)}h</p>
          <p className="mt-1 text-xl" style={{ fontFamily: "var(--font-display)" }}>{todayEvent.title}</p>
          <p className="mt-1 text-sm text-paper/80">{fmtTime(todayEvent.starts_at, todayEvent.timezone)}</p>
          {(todayEvent.neighborhood || todayEvent.city || todayAddress) && (
            <p className="mt-1 flex items-center gap-1 text-sm text-paper/80">
              <MapPin className="size-3.5" />
              {todayAddress || [todayEvent.neighborhood, todayEvent.city].filter(Boolean).join(", ")}
            </p>
          )}
          <div className="mt-3 flex items-center gap-3">
            <AvatarRow people={todayAttendees} max={4} />
            {todayGoing > 0 && <span className="text-xs text-paper/70">{todayGoing} going</span>}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="coral" size="sm" disabled={rsvpBusy} onClick={() => rsvp(todayEvent.id)}>
              {myRsvps.has(todayEvent.id) ? "I'm going ✓" : "I'm going"}
            </Button>
            <Link to={`/space/${space.slug}?tab=events`} className="text-xs text-paper/70 underline">
              See all events
            </Link>
          </div>
          {laterThisWeek.length > 0 && (
            <div className="mt-4 border-t border-paper/20 pt-3">
              <p className="text-[11px] uppercase tracking-wide text-paper/60">Later this week</p>
              <ul className="mt-1.5 space-y-1">
                {laterThisWeek.map((e) => (
                  <li key={e.id} className="text-sm text-paper/85">
                    {fmtDay(e.starts_at)} · {e.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {isActiveMember && !todayEvent && nextEvent && nextWithinWeek && (
        <Link
          to={`/space/${space.slug}?tab=events`}
          className="-mx-4 flex items-center justify-between gap-3 rounded-2xl bg-bark px-5 py-3 text-sm text-paper sm:mx-0"
        >
          <span className="truncate">
            Next: {fmtDay(nextEvent.starts_at)} · {nextEvent.title}
          </span>
          <ArrowRight className="size-4 shrink-0" />
        </Link>
      )}

      {/* ── Settling in / Set up your Space ───────────────────────────── */}
      {isActiveMember && checklistReady && !checklistComplete && !dismissed && (
        <div className="relative rounded-2xl border border-line bg-paper p-5">
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
          <p className="pr-6 text-lg" style={{ fontFamily: "var(--font-display)" }}>{checklistTitle}</p>
          <ul className="mt-3 space-y-1.5">
            {activeChecklist.map((c) => (
              <li key={c.key} className="flex items-center gap-2 text-sm">
                <span
                  className={`flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                    c.done ? "border-clay bg-clay text-paper" : "border-line text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span className={c.done ? "text-muted-foreground line-through" : ""}>{c.label}</span>
              </li>
            ))}
          </ul>
          {nextStep && (
            <div className="mt-3">
              {nextStep.onClick ? (
                <Button variant="outline" size="sm" onClick={nextStep.onClick}>
                  Next: {nextStep.label}
                </Button>
              ) : nextStep.to ? (
                <Button variant="outline" size="sm" asChild>
                  <Link to={nextStep.to}>Next: {nextStep.label}</Link>
                </Button>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* ── On the table ───────────────────────────────────────────────── */}
      <div>
        <div className="flex items-baseline justify-between">
          <p className="text-lg" style={{ fontFamily: "var(--font-display)" }}>On the table</p>
          <Link to={`/space/${space.slug}?tab=moments`} className="text-xs text-muted-foreground underline">
            See all Moments
          </Link>
        </div>
        {myPendingMoments.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="ns-section-kicker text-muted-foreground">Waiting for a host to approve</p>
            {myPendingMoments.map((post) => (
              <div key={post.id} className="flex items-center gap-3 rounded-xl border border-line bg-paper px-3 py-2">
                {post.media && <img src={post.media} alt="" className="size-10 shrink-0 rounded-md object-cover" />}
                <p className="line-clamp-1 flex-1 text-sm">{post.caption || `Moment #${post.id}`}</p>
              </div>
            ))}
          </div>
        )}
        {pinError && <p className="mt-2 text-xs text-destructive">{pinError}</p>}
        {moments === "loading" ? (
          <div className="min-h-[20vh]" />
        ) : tableEmpty ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">The table's clear.</p>
            <Button variant="coral" size="sm" className="mt-3" onClick={onAddMoment}>
              Add the first Moment
            </Button>
          </div>
        ) : (
          <>
            {pinnedMoments.length > 0 && (
              <p className="mt-4 ns-section-kicker text-muted-foreground">Pinned by the hosts</p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
              {pinnedMoments.map((post, i) => (
                <div key={post.id} className={`relative ${TILTS[i % TILTS.length]}`}>
                  {isHost && (
                    <button
                      type="button"
                      disabled={pinBusyId === post.id}
                      onClick={() => togglePin(post)}
                      className="absolute left-2 top-2 z-10 flex items-center gap-1 whitespace-nowrap rounded-full border border-line bg-paper/90 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur hover:text-foreground disabled:opacity-50"
                    >
                      <PinOff className="size-3" />
                      Unpin
                    </button>
                  )}
                  <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_10px_20px_-14px_rgba(43,33,28,0.35)]">
                    <MomentCard post={post} surface="feed" onOpen={() => setOpenPost(post)} />
                  </div>
                </div>
              ))}
            </div>
            {restMoments.length > 0 && (
              <div className={`grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 ${pinnedMoments.length > 0 ? "mt-8" : "mt-3"}`}>
                {restMoments.map((post, i) => (
                  <div key={post.id} className={`relative ${TILTS[i % TILTS.length]}`}>
                    {isHost && (
                      <button
                        type="button"
                        disabled={pinBusyId === post.id}
                        onClick={() => togglePin(post)}
                        className="absolute left-2 top-2 z-10 flex items-center gap-1 whitespace-nowrap rounded-full border border-line bg-paper/90 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur hover:text-foreground disabled:opacity-50"
                      >
                        <Pin className="size-3" />
                        Pin to Home
                      </button>
                    )}
                    <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_10px_20px_-14px_rgba(43,33,28,0.35)]">
                      <MomentCard post={post} surface="feed" onOpen={() => setOpenPost(post)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── People here ────────────────────────────────────────────────── */}
      {hosts.length > 0 && (
        <div>
          <p className="ns-section-kicker text-muted-foreground">People here</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {hosts.map((h) => (
              <span
                key={h.id}
                className="flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-xs"
              >
                <Avatar className="size-5">
                  {h.avatarUrl && <AvatarImage src={h.avatarUrl} alt="" />}
                  <AvatarFallback className="text-[8px]">{initials(h.name)}</AvatarFallback>
                </Avatar>
                {h.name}
                <Star className="size-2.5 fill-current text-clay" />
              </span>
            ))}
          </div>
        </div>
      )}

      <MomentDetail
        post={openPost}
        owned={!!user && openPost?.userId === user.id}
        onOpenChange={(o) => !o && setOpenPost(null)}
      />
    </div>
  );
}
