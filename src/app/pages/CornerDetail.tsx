import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Check, Lock } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { ImageWithFallback } from "../components/ImageWithFallback";
import { HorizontalRow } from "../components/HorizontalRow";
import { CornerCard } from "../components/corners/CornerCard";
import { CoverEmoji } from "../components/corners/CoverEmoji";
import { PressLink } from "../components/afterhours/PressLink";
import { Reveal } from "../components/afterhours/Reveal";
import { MomentTile } from "../components/afterhours/MomentTile";
import { MomentDetail } from "../components/MomentDetail";
import { type Post, postCorner } from "../data/posts";
import {
  curatedBySlug,
  curatedCategory,
  curatedInCategory,
  howToStart,
  type CuratedCorner,
} from "../data/curatedCorners";
import { cornerGuide } from "../data/cornerGuides";
import { cornerStyle } from "../lib/categoryStyle";
import { fetchCornersLive, thisWeek, type CornerLive, type LiveEvent, type LiveSpace } from "../lib/cornersLive";
import { formatStarts } from "../lib/dates";
import { displayStyle } from "../lib/doorList";
import { PAGE_X, SECTION_GAP } from "../lib/pageGrid";
import { plural } from "../lib/plural";
import { cancelRsvp, requestOrJoinSpace, rsvpToEvent } from "../lib/spaces";
import { tieNumbers } from "../lib/typography";
import { cornerSignal } from "./CornersHome";

/**
 * A single curated Corner (/corners/:slug), open to signed-out and
 * not-yet-approved visitors, who see Corners, guides, Open Spaces and event
 * titles and times only (no people, Moments, hosts or Closed Spaces) and one
 * line saying members see who's going.
 * Top to bottom: the next event, this week's events, the Corner's Spaces,
 * the people into it, recent Moments, how to start and what you'll need,
 * then more Corners like it. A section with nothing in it is not shown, and
 * the two guide sections always come after the people and event sections.
 * Nothing from a Closed Space reaches a non-member beyond an event's title
 * and time.
 */

const MOMENTS_PAGE = 8;
const initials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

type Person = { id: string; name: string; avatarUrl?: string; username?: string };
type Membership = { role: string; status: string };

function SectionTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="mb-4" style={displayStyle(26, { lineHeight: 1.1 })}>
      {children}
    </h2>
  );
}

export function CornerDetail() {
  const { slug = "" } = useParams();
  const corner = curatedBySlug(slug);
  if (!corner) {
    return (
      <div className="min-h-viewport flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-title mb-4">That Corner doesn’t exist</h2>
          <Link to="/corners">
            <Button variant="outline">Back to Corners</Button>
          </Link>
        </div>
      </div>
    );
  }
  return <CornerBody key={corner.slug} corner={corner} />;
}

function CornerBody({ corner }: { corner: CuratedCorner }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { publicFeed } = useContent();
  const [live, setLive] = useState<CornerLive | null>(null);
  const [hosts, setHosts] = useState<Map<string, Person>>(new Map());
  const [memberships, setMemberships] = useState<Map<string, Membership>>(new Map());
  const [going, setGoing] = useState<Set<number>>(new Set());
  const [momentCounts, setMomentCounts] = useState<Map<string, number>>(new Map());
  const [stubSpaces, setStubSpaces] = useState<Set<string>>(new Set());
  const [people, setPeople] = useState<Map<string, Person>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [momentPages, setMomentPages] = useState(1);

  // Signed out, or signed in but not approved yet.
  const restricted = !user || profile?.access === "pending";
  const here = encodeURIComponent(`/corners/${corner.slug}`);
  const signIn = () => navigate(`/login?redirect=${here}`);

  const posts = useMemo(
    () => publicFeed.filter((p) => p.hobbySlug === corner.spaceSlug && postCorner(p) === corner.slug),
    [publicFeed, corner],
  );

  // Everything live about this Corner.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = (await fetchCornersLive({ only: corner.slug, full: !restricted, openOnly: restricted })).get(corner.slug);
      if (cancelled || !result) return;
      setLive(result);
      if (!supabase) return;

      const spaces = result.spaces;
      const hostIds = [...new Set(spaces.map((s) => s.created_by).filter((id): id is string => !!id))];
      const [hostRows, counts] = await Promise.all([
        hostIds.length && !restricted
          ? supabase.from("profiles").select("id, display_name, avatar_url, username").in("id", hostIds)
          : Promise.resolve({ data: [] }),
        Promise.all(
          spaces
            .filter((s) => s.access === "open")
            .map(async (s) => [s.id, (await supabase!.rpc("space_moment_count_30d", { p_space_id: s.id })).data as number | null] as const),
        ),
      ]);
      if (cancelled) return;
      setHosts(new Map((hostRows.data ?? []).map((r) => [r.id as string, toPerson(r)])));
      setMomentCounts(new Map(counts.filter(([, n]) => typeof n === "number").map(([id, n]) => [id, n as number])));

      if (user && !restricted && spaces.length > 0) {
        const spaceIds = spaces.map((s) => s.id);
        const eventIds = result.events.map((e) => e.id);
        const [mine, rsvps, stubs] = await Promise.all([
          supabase.from("space_members").select("space_id, role, status").eq("user_id", user.id).in("space_id", spaceIds),
          eventIds.length
            ? supabase.from("event_rsvps").select("event_id").eq("user_id", user.id).in("event_id", eventIds)
            : Promise.resolve({ data: [] }),
          // Fails soft: before the Stubs migration is applied the table is missing,
          // and the page just leaves out the "You've been to one of their events." line.
          Promise.resolve(supabase.from("stubs").select("space_id").eq("user_id", user.id).in("space_id", spaceIds)).then(
            (r) => (r.error ? { data: [] as { space_id: string }[] } : r),
            () => ({ data: [] as { space_id: string }[] }),
          ),
        ]);
        if (cancelled) return;
        setMemberships(new Map((mine.data ?? []).map((m) => [m.space_id as string, { role: m.role as string, status: m.status as string }])));
        setGoing(new Set((rsvps.data ?? []).map((r) => r.event_id as number)));
        setStubSpaces(new Set((stubs.data ?? []).map((s) => s.space_id as string)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [corner, user?.id, restricted]);

  // People into this Corner: whoever shared a public Moment here most recently, newest first. No counts.
  const ranked = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; latest?: Post }[] = [];
    for (const p of [...posts].sort((a, b) => b.createdAt - a.createdAt)) {
      if (!p.userId || seen.has(p.userId)) continue;
      seen.add(p.userId);
      out.push({ id: p.userId, latest: p.type === "photo" ? p : posts.filter((q) => q.userId === p.userId && q.type === "photo").sort((a, b) => b.createdAt - a.createdAt)[0] });
      if (out.length === 8) break;
    }
    return out;
  }, [posts]);

  useEffect(() => {
    if (!supabase || restricted || ranked.length === 0) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("id, display_name, avatar_url, username")
      .in("id", ranked.map((r) => r.id))
      .then(({ data }) => {
        if (!cancelled) setPeople(new Map((data ?? []).map((r) => [r.id as string, toPerson(r)])));
      });
    return () => {
      cancelled = true;
    };
  }, [ranked, restricted]);

  const spaceById = useMemo(() => new Map((live?.spaces ?? []).map((s) => [s.id, s])), [live]);
  const events = live?.events ?? [];
  const heroEvent = events[0];
  const week = live ? thisWeek(events) : [];
  const steps = howToStart(corner);
  const about = cornerGuide(corner.spaceSlug, corner.slug)?.about;
  const prefill = `hobby=${encodeURIComponent(corner.spaceSlug)}&sub=${encodeURIComponent(corner.slug)}`;
  const more = (() => {
    const cat = curatedCategory(corner);
    return cat ? curatedInCategory(cat).filter((x) => x.slug !== corner.slug) : [];
  })();

  const showMoments = !restricted && posts.length > 0;
  const isMember = (s: LiveSpace) => memberships.get(s.id)?.status === "active";
  const isPending = (s: LiveSpace) => memberships.get(s.id)?.status === "pending";

  async function toggleGoing(e: LiveEvent) {
    if (!user) return signIn();
    setBusy(`event-${e.id}`);
    setError(null);
    const isGoing = going.has(e.id);
    const { error: err } = isGoing ? await cancelRsvp(e.id) : await rsvpToEvent(e.id);
    setBusy(null);
    if (err) return setError(err);
    setGoing((prev) => {
      const next = new Set(prev);
      if (isGoing) next.delete(e.id);
      else next.add(e.id);
      return next;
    });
  }

  async function joinOpen(s: LiveSpace) {
    if (!user) return signIn();
    setBusy(`space-${s.id}`);
    setError(null);
    const { error: err } = await requestOrJoinSpace(s.id);
    setBusy(null);
    if (err) return setError(err);
    setMemberships((prev) => new Map(prev).set(s.id, { role: "member", status: "active" }));
  }

  const buttonClass =
    "inline-flex min-h-12 items-center justify-center rounded-control bg-[var(--ink)] px-6 text-body font-semibold text-[var(--cat)] disabled:opacity-60";

  return (
    <div className="ns-afterhours min-h-viewport" style={cornerStyle(corner.spaceSlug, corner.slug)}>
      {/* Hero: the next event, or the Corner's cover and a way to start a Space. */}
      <header className="relative overflow-hidden bg-[var(--cat)] text-[var(--ink)]">
        <CoverEmoji emoji={corner.emoji} size="hero" className="pointer-events-none absolute right-6 top-6 md:right-16" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background to-transparent" />
        <div className={`${PAGE_X} relative pb-16 pt-6 md:pb-20`}>
          <Link to="/corners" className="inline-flex min-h-11 items-center text-small hover:underline">
            ← Back to Corners
          </Link>
          {live && heroEvent ? (
            <HeroEvent
              corner={corner}
              event={heroEvent}
              space={spaceById.get(heroEvent.spaceId)}
              host={restricted ? undefined : hosts.get(spaceById.get(heroEvent.spaceId)?.created_by ?? "")}
              going={going.has(heroEvent.id)}
              member={!!spaceById.get(heroEvent.spaceId) && isMember(spaceById.get(heroEvent.spaceId)!)}
              pending={!!spaceById.get(heroEvent.spaceId) && isPending(spaceById.get(heroEvent.spaceId)!)}
              busy={busy === `event-${heroEvent.id}`}
              onGoing={() => toggleGoing(heroEvent)}
              buttonClass={buttonClass}
            />
          ) : (
            <div className="mt-6">
              <h1 className="text-display">{corner.name}</h1>
              {live && (
                <PressLink to={user ? "/create-space" : `/login?redirect=${encodeURIComponent("/create-space")}`} className={`${buttonClass} mt-5`}>
                  Create a Space
                </PressLink>
              )}
            </div>
          )}
        </div>
      </header>

      <div className={`${PAGE_X} pb-24 pt-8`}>
        {error && <p role="alert" className="mb-6 text-small text-destructive">{error}</p>}

        {week.length > 0 && (
          <section className={SECTION_GAP} aria-labelledby="week-title">
            <SectionTitle id="week-title">Happening this week</SectionTitle>
            <HorizontalRow name={`corner.${corner.slug}.week`} label="Happening this week">
              {week.map((e) => {
                const space = spaceById.get(e.spaceId);
                return (
                  <li key={`${e.spaceId}-${e.id}`} className="w-[260px] shrink-0 snap-start sm:w-[300px]">
                    <PressLink
                      to={`/space/${space?.slug ?? ""}?tab=events`}
                      className="block h-full rounded-card border border-border bg-card p-4"
                    >
                      <span className="block text-caption text-muted-foreground">
                        {formatStarts(e.startsAt, { timeZone: e.timezone })}
                      </span>
                      <span className="mt-1 line-clamp-2 block break-words text-small font-semibold">{e.title}</span>
                      {space && <span className="mt-1 block truncate text-caption text-muted-foreground">{space.name}</span>}
                    </PressLink>
                  </li>
                );
              })}
            </HorizontalRow>
          </section>
        )}

        {live && live.spaces.length > 0 && (
          <section className={SECTION_GAP} aria-labelledby="spaces-title">
            <SectionTitle id="spaces-title">{`Spaces in ${corner.name}`}</SectionTitle>
            <HorizontalRow name={`corner.${corner.slug}.spaces`} label={`Spaces in ${corner.name}`}>
              {live.spaces.map((s) => (
                <SpaceCard
                  key={s.id}
                  space={s}
                  host={restricted ? undefined : hosts.get(s.created_by ?? "")}
                  moments={momentCounts.get(s.id)}
                  member={isMember(s)}
                  pending={isPending(s)}
                  beenToOne={stubSpaces.has(s.id)}
                  busy={busy === `space-${s.id}`}
                  onJoin={() => joinOpen(s)}
                  onRequest={() => (user ? navigate(`/space/${s.slug}`) : signIn())}
                />
              ))}
            </HorizontalRow>
          </section>
        )}

        {!restricted && ranked.length > 0 && (
          <section className={SECTION_GAP} aria-labelledby="people-title">
            <SectionTitle id="people-title">{`People into ${corner.name}`}</SectionTitle>
            <HorizontalRow name={`corner.${corner.slug}.people`} label={`People into ${corner.name}`}>
              {ranked.map((r) => {
                const person = people.get(r.id);
                if (!person) return null;
                return (
                  <li key={r.id} className="w-[220px] shrink-0 snap-start">
                    <PressLink
                      to={person.username ? `/u/${encodeURIComponent(person.username)}` : "/people"}
                      className="flex h-full items-center gap-3 rounded-card border border-border bg-card p-3"
                    >
                      <Avatar className="size-11 shrink-0">
                        {person.avatarUrl && <AvatarImage src={person.avatarUrl} alt="" />}
                        <AvatarFallback className="text-caption">{initials(person.name)}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate text-small font-semibold">{person.name}</span>
                      {r.latest && (
                        <ImageWithFallback src={r.latest.media} alt="" className="size-11 shrink-0 overflow-hidden rounded-control" />
                      )}
                    </PressLink>
                  </li>
                );
              })}
            </HorizontalRow>
          </section>
        )}

        {restricted && (
          <p className={`${SECTION_GAP} text-body text-muted-foreground`}>Members see who’s going.</p>
        )}

        {showMoments && (
          <section className={SECTION_GAP} aria-labelledby="moments-title">
            <SectionTitle id="moments-title">Recent Moments</SectionTitle>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {posts.slice(0, momentPages * MOMENTS_PAGE).map((post, i) => (
                <Reveal key={post.id} index={i % MOMENTS_PAGE}>
                  <MomentTile post={post} onOpen={() => setOpenPost(post)} />
                </Reveal>
              ))}
            </div>
            {posts.length > momentPages * MOMENTS_PAGE && (
              <div className="mt-10 border-t border-border pt-4">
                <Button variant="outline" onClick={() => setMomentPages((n) => n + 1)}>
                  Show more
                </Button>
              </div>
            )}
          </section>
        )}

        <div className={`${SECTION_GAP} grid gap-10 md:grid-cols-2 md:gap-8`}>
          <section aria-labelledby="start-title">
            <SectionTitle id="start-title">How to start</SectionTitle>
            {about && <p className="mb-4 text-body text-muted-foreground">{about}</p>}
            <ol className="space-y-3">
              {steps.map((step, i) => (
                <li key={step} className="flex gap-4 rounded-card border border-border bg-card p-4">
                  <span className="text-lead font-semibold text-[var(--accent-text)]" aria-hidden="true">{i + 1}</span>
                  <span className="text-body">{tieNumbers(step)}</span>
                </li>
              ))}
            </ol>
            {!restricted && (
              <div className="mt-5 flex flex-col gap-3 md:flex-row">
                <PressLink
                  to={`/pursuits/new?${prefill}`}
                  className="flex min-h-12 w-full items-center justify-center rounded-control bg-[var(--accent)] px-6 text-body font-semibold text-[var(--accent-foreground)] md:w-auto"
                >
                  Start a Pursuit
                </PressLink>
                <PressLink
                  to={`/create?${prefill}`}
                  className="flex min-h-12 w-full items-center justify-center rounded-control border border-border px-6 text-body font-semibold text-foreground md:w-auto"
                >
                  Log a Moment
                </PressLink>
              </div>
            )}
          </section>
          <section aria-labelledby="need-title">
            <SectionTitle id="need-title">What you’ll need</SectionTitle>
            <ul className="space-y-3">
              {corner.needs.map((need) => (
                <li key={need} className="rounded-card border border-border bg-card p-4 text-body">
                  {need}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {more.length > 0 && (
          <section className={SECTION_GAP} aria-labelledby="more-title">
            <SectionTitle id="more-title">More Corners like this</SectionTitle>
            <HorizontalRow name={`corner.${corner.slug}.more`} label="More Corners like this">
              {more.map((x) => (
                <CornerCard key={x.slug} corner={x} signal={cornerSignal(undefined)} />
              ))}
            </HorizontalRow>
          </section>
        )}
      </div>

      <MomentDetail
        post={openPost}
        owned={!!user && openPost?.userId === user.id}
        onOpenChange={(o) => !o && setOpenPost(null)}
      />
    </div>
  );
}

function toPerson(r: Record<string, unknown>): Person {
  return {
    id: r.id as string,
    name: ((r.display_name as string | null) ?? "").trim() || "Someone",
    avatarUrl: (r.avatar_url as string | null) ?? undefined,
    username: (r.username as string | null) ?? undefined,
  };
}

function HeroEvent({
  corner,
  event,
  space,
  host,
  going,
  member,
  pending,
  busy,
  onGoing,
  buttonClass,
}: {
  corner: CuratedCorner;
  event: LiveEvent;
  space?: LiveSpace;
  host?: Person;
  going: boolean;
  member: boolean;
  pending: boolean;
  busy: boolean;
  onGoing: () => void;
  buttonClass: string;
}) {
  const closedToYou = space?.access === "closed" && !member;
  return (
    <div className="mt-6">
      <p className="text-small font-semibold">{corner.name}</p>
      <h1 className="mt-2 line-clamp-3 break-words text-display">{event.title}</h1>
      {space && (
        <p className="mt-2 text-body">
          <Link to={`/space/${space.slug}`} className="hover:underline">{space.name}</Link>
        </p>
      )}
      {host && (
        <p className="mt-3 flex items-center gap-2 text-small">
          <Avatar className="size-7">
            {host.avatarUrl && <AvatarImage src={host.avatarUrl} alt="" />}
            <AvatarFallback className="text-caption">{initials(host.name)}</AvatarFallback>
          </Avatar>
          <span>{host.name}</span>
        </p>
      )}
      <p className="mt-3 text-body tabular-nums">
        <time dateTime={event.startsAt}>{formatStarts(event.startsAt, { timeZone: event.timezone })}</time>
      </p>
      <div className="mt-5">
        {closedToYou && space ? (
          <PressLink
            to={`/space/${space.slug}`}
            className={buttonClass}
          >
            {pending ? "Requested" : "Request to join"}
          </PressLink>
        ) : (
          <button type="button" className={buttonClass} disabled={busy} aria-pressed={going} onClick={onGoing}>
            {going && <Check className="mr-2 size-4" aria-hidden="true" />}
            I’m going
          </button>
        )}
      </div>
    </div>
  );
}

function SpaceCard({
  space,
  host,
  moments,
  member,
  pending,
  beenToOne,
  busy,
  onJoin,
  onRequest,
}: {
  space: LiveSpace;
  host?: Person;
  moments?: number;
  member: boolean;
  pending: boolean;
  beenToOne: boolean;
  busy: boolean;
  onJoin: () => void;
  onRequest: () => void;
}) {
  const closed = space.access === "closed";
  // A Closed Space's cover stays blurred until you are in.
  const blurred = closed && !member;
  return (
    <li className="w-[260px] shrink-0 snap-start sm:w-[300px]">
      <div className="flex h-full flex-col overflow-hidden rounded-card border border-border bg-card">
        <Link to={`/space/${space.slug}`} className="relative block aspect-[16/10] overflow-hidden bg-surface-muted">
          <ImageWithFallback
            src={space.cover_image}
            alt=""
            className="size-full"
            imgClassName={blurred ? "scale-110 blur-xl" : ""}
          />
          {blurred && (
            <span className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-scrim-solid/60 text-on-media">
              <Lock className="size-4" aria-label="Closed" />
            </span>
          )}
        </Link>
        <div className="flex flex-1 flex-col gap-1 p-3.5">
          <Link to={`/space/${space.slug}`} className="truncate text-small font-semibold hover:underline" title={space.name}>
            {space.name}
          </Link>
          {host && (
            <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
              <Avatar className="size-5">
                {host.avatarUrl && <AvatarImage src={host.avatarUrl} alt="" />}
                <AvatarFallback className="text-caption">{initials(host.name)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{host.name}</span>
            </span>
          )}
          {!closed && typeof moments === "number" && (
            <span className="text-caption text-muted-foreground">{`${plural(moments, "Moment")} this month`}</span>
          )}
          {closed && beenToOne && (
            <span className="text-caption text-muted-foreground">You’ve been to one of their events.</span>
          )}
          <div className="mt-auto pt-2">
            {member ? null : closed ? (
              <Button variant="outline" size="sm" disabled={pending} onClick={onRequest}>
                {pending ? "Requested" : "Request to join"}
              </Button>
            ) : (
              <Button variant="coral" size="sm" disabled={busy} onClick={onJoin}>
                Join Space
              </Button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
