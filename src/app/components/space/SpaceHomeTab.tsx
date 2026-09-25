import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { MapPin, Star, ArrowRight, X } from "lucide-react";
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
type SpaceMoment = Post & { featured: boolean };

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

/** The Home tab: the event band, the members-only "Settling in" checklist,
 * the "On the table" Moment grid, the hosts' single featured Moment (space_
 * moments.featured — DB-enforced to at most one per Space, sql/…-schema's
 * space_moments_one_featured), and host badges. Everything here is read
 * from data that already exists — no new tables, no new RPCs. */
export function SpaceHomeTab({
  space,
  isActiveMember,
  hosts,
}: {
  space: SpaceRow;
  isActiveMember: boolean;
  hosts: HostLite[];
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

  const [followsMember, setFollowsMember] = useState(false);
  const [rsvpedHere, setRsvpedHere] = useState(false);
  const [sharedHere, setSharedHere] = useState(false);
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

  const dismissKey = user ? `sushii.spaces.settlingIn.dismissed.${user.id}.${space.id}` : null;

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
      // already limits this to what the caller can actually see (Open, or
      // an active member) — same trust-RLS pattern as SpaceMomentsTab.
      const { data } = await supabase
        .from("space_moments")
        .select("added_at, featured, posts(*)")
        .eq("space_id", space.id)
        .order("featured", { ascending: false })
        .order("added_at", { ascending: false })
        .limit(9);
      if (cancelled) return;
      const rows = (data ?? []).filter((r: any) => r.posts);
      const userIds = [...new Set(rows.map((r: any) => r.posts.user_id as string))];
      const { data: profilesData } = userIds.length
        ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
        : { data: [] as { id: string; display_name: string }[] };
      if (cancelled) return;
      const nameById = new Map((profilesData ?? []).map((p) => [p.id, p.display_name]));
      const posts = rows.map((r: any) => ({
        ...rowToPost(r.posts, nameById.get(r.posts.user_id) ?? "Someone"),
        featured: !!r.featured,
      })) as SpaceMoment[];
      setMoments(posts);
      if (user) setSharedHere(posts.some((p) => p.userId === user.id));
    }
    loadMoments();
    return () => {
      cancelled = true;
    };
  }, [space.id, user?.id]);

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

  const checklist = [
    { key: "join", label: "Join the Space", done: isActiveMember },
    { key: "follow", label: "Follow a fellow member", done: followsMember },
    { key: "pursuit", label: "Start a Pursuit", done: startedPursuit },
    { key: "rsvp", label: "RSVP to an event", done: rsvpedHere },
    { key: "moment", label: "Share a Moment here", done: sharedHere },
  ];
  const nextStep = checklist.find((c) => !c.done);
  const checklistComplete = checklistReady && !nextStep;

  const momentsLoaded = moments !== "loading" ? moments : [];
  const featuredMoment = momentsLoaded.find((m) => m.featured);
  const tableMoments = momentsLoaded.filter((m) => m.id !== featuredMoment?.id).slice(0, 6);

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

      {/* ── Settling in ────────────────────────────────────────────────── */}
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
          <p className="pr-6 text-lg" style={{ fontFamily: "var(--font-display)" }}>Settling in</p>
          <ul className="mt-3 space-y-1.5">
            {checklist.map((c) => (
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
            <p className="mt-3 text-xs text-muted-foreground">Next: {nextStep.label}</p>
          )}
        </div>
      )}

      {/* ── Featured by the hosts ──────────────────────────────────────── */}
      {featuredMoment && (
        <div>
          <p className="ns-section-kicker text-muted-foreground">Featured by the hosts</p>
          <div className="mt-2 overflow-hidden rounded-2xl border border-line bg-paper">
            <MomentCard post={featuredMoment} surface="feed" onOpen={() => setOpenPost(featuredMoment)} />
          </div>
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
        {moments === "loading" ? (
          <div className="min-h-[20vh]" />
        ) : tableMoments.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">The table's clear. Add the first Moment.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
            {tableMoments.map((post, i) => (
              <div key={post.id} className={TILTS[i % TILTS.length]}>
                <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_10px_20px_-14px_rgba(43,33,28,0.35)]">
                  <MomentCard post={post} surface="feed" onOpen={() => setOpenPost(post)} />
                </div>
              </div>
            ))}
          </div>
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
