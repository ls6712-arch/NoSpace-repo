import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { Check, Lock, Sparkle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { PaperStamp, tilt } from "../components/corners/MomentStamp";
import { formatDate } from "../lib/dates";
import { momentAlt } from "../lib/momentCaption";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { ImageWithFallback } from "../components/ImageWithFallback";
import { HorizontalRow } from "../components/HorizontalRow";
import { CornerCard } from "../components/corners/CornerCard";
import { PressLink } from "../components/afterhours/PressLink";
import { Reveal } from "../components/afterhours/Reveal";
import { MomentTile } from "../components/afterhours/MomentTile";
import { MomentDetail } from "../components/MomentDetail";
import { type Post } from "../data/posts";
import { isInCorner } from "../lib/cornerAlias";
import { curatedBySlug } from "../data/curatedCorners";
import { CORNER_CATEGORIES } from "../data/cornerCategories";
import { hasHobbyPhoto } from "../data/hobbyPhotos";
import { cornerKey, homeCornersIn } from "../data/homeCorners";
import { cornerGuide } from "../data/cornerGuides";
import { cornerStyle } from "../lib/categoryStyle";
import { cornerPhotoTransitionName } from "../components/discover/HeroCard";
import { SnapCarousel } from "../components/ui/SnapCarousel";
import { AvatarStack } from "../components/ui/AvatarStack";
import { PillButton } from "../components/ui/PillButton";
import { MakeItAPursuitSheet } from "../components/pursuit/MakeItAPursuitSheet";
import { builtInCornerModel, curatedModel, plainModel, type CornerModel } from "../lib/cornerModel";
import { useCorners } from "../context/CornersContext";
import { hobbies } from "../data/hobbies";
import { WeekEventCard } from "../components/corners/WeekEventCard";
import { cornerPhoto, cornerPhotoAlt, cornerPhotoCredit } from "../lib/cornerPhoto";
import { cornerSubline } from "../lib/cornerSubline";
import { fetchCornersLive, thisWeek, type CornerLive, type LiveEvent, type LiveSpace } from "../lib/cornersLive";
import { formatStarts } from "../lib/dates";
import { displayStyle } from "../lib/doorList";
import { PAGE_X, SECTION_GAP } from "../lib/pageGrid";
import { plural } from "../lib/plural";
import { cancelRsvp, requestOrJoinSpace, rsvpToEvent } from "../lib/spaces";
import { tieNumbers } from "../lib/typography";

/**
 * A single Corner (/corners/:slug), open to signed-out and not-yet-approved
 * visitors, who see Corners, guides, Open Spaces and event titles and times
 * only (no people, Moments, hosts or Closed Spaces) and one line saying
 * members see who's going.
 * Top to bottom: the hero (the Corner's photo, its name, and a line with its category as a
 * link, its length and place, and one button: I'm going to the next event, else See
 * Spaces, else Create a Space), How to start beside Why it's worth it,
 * What you'll need, then the live rows (this week's events, Spaces, people,
 * your Moments, recent Moments), more Corners like it, and Create a Space.
 * A section with nothing in it is not shown. Nothing from a Closed Space
 * reaches a non-member beyond an event's title and time. There is no
 * logging or Pursuit button here: the page is for finding out and joining in.
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
  const { cornersFor } = useCorners();
  // The curated Corner, else the first Space's Corner with this slug (built-in or database-only,
  // as the old page resolved it), else a built-in Corner of a Space that is not listed.
  const corner = useMemo<CornerModel | undefined>(() => {
    const curated = curatedBySlug(slug);
    if (curated) return curatedModel(curated);
    for (const h of hobbies) {
      const found = cornersFor(h.slug).find((c) => c.slug === slug);
      if (found) return plainModel(found.spaceSlug, found.slug, found.name, found.description);
    }
    return builtInCornerModel(slug);
  }, [slug, cornersFor]);
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

function CornerBody({ corner }: { corner: CornerModel }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { publicFeed, myPosts } = useContent();
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
  // Signed out or not approved yet: sign in first, then land where the button was going.
  const cornerParams = `hobby=${encodeURIComponent(corner.spaceSlug)}&sub=${encodeURIComponent(corner.slug)}`;
  // "Do this with people" opens the Make it a Pursuit sheet; ?host=1 (from a finished Pursuit) opens it on starting an open group.
  const [searchParams] = useSearchParams();
  const hostFlow = searchParams.get("host") === "1" && !restricted;
  const [sheetOpen, setSheetOpen] = useState(hostFlow);
  // Discover's Corner cards open this page on a section: ?section=home, people or place.
  const section = searchParams.get("section");
  useEffect(() => {
    const targets: Record<string, string[]> = { home: ["section-home"], people: ["section-people", "section-people-into"], place: ["spaces-section"] };
    const ids = section ? (targets[section] ?? []) : [];
    if (ids.length === 0) return;
    // Some sections arrive after the Corner's live data loads, so look again a couple of times.
    let found = false;
    const look = () => {
      if (found) return;
      const el = ids.map((id) => document.getElementById(id)).find(Boolean);
      if (el) {
        found = true;
        el.scrollIntoView({ block: "start" });
      }
    };
    const timers = [0, 300, 900].map((ms) => window.setTimeout(look, ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // Runs when the section asked for changes; later renders must not pull the page back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);
  const doWithPeople = () => (restricted ? navigate(`/login?redirect=${here}`) : setSheetOpen(true));
  const goTo = (path: string) => (restricted ? navigate(`/login?redirect=${encodeURIComponent(path)}`) : navigate(path));

  const posts = useMemo(
    () => publicFeed.filter((p) => isInCorner(p, corner.spaceSlug, corner.slug)),
    [publicFeed, corner],
  );

  // Everything live about this Corner.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = (await fetchCornersLive({ targets: [corner], full: !restricted, openOnly: restricted })).get(cornerKey(corner));
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
  const photo = cornerPhotoCredit(corner.slug);
  const category = CORNER_CATEGORIES.find((c) => c.slug === corner.categorySlug);
  // "90 min · At home · Good with a friend": the length and place, and a note when it suits company.
  const together = cornerGuide(corner.spaceSlug, corner.slug)?.together;
  const metaLine = [corner.meta, together && together !== "solo" ? "Good with a friend" : ""].filter(Boolean).join(" · ");
  // Other Corners in the same group: curated first, then A to Z. Each has a photo of its own, and no two
  // cards share an image, so a row never shows the same picture twice.
  const more = (() => {
    const seen = new Set<string>();
    return (category ? homeCornersIn(category.slug) : [])
      .filter((x) => x.slug !== corner.slug && hasHobbyPhoto(x.slug))
      .sort((a, b) => Number(!!b.curated) - Number(!!a.curated) || a.name.localeCompare(b.name))
      .filter((x) => {
        const img = cornerPhoto(x.spaceSlug, x.slug) ?? "";
        if (seen.has(img)) return false;
        seen.add(img);
        return true;
      })
      .slice(0, 12);
  })();

  // Your own Moments in this Corner (private ones too), newest first.
  const mine = useMemo(
    () =>
      user && !restricted
        ? myPosts.filter((p) => isInCorner(p, corner.spaceSlug, corner.slug)).sort((a, b) => b.createdAt - a.createdAt)
        : [],
    [myPosts, corner, user, restricted],
  );
  // Who is into this Corner, from the people who shared a Moment here: a few faces and their names, never a count.
  const proof = ranked.flatMap((r) => (people.get(r.id) ? [people.get(r.id)!] : [])).slice(0, 3);
  const proofLine =
    proof.length === 0
      ? ""
      : proof.length === 1
        ? `${proof[0].name.slice(0, 60)} is into this`
        : proof.length === 2 && ranked.length === 2
          ? `${proof[0].name.slice(0, 60)} and ${proof[1].name.slice(0, 60)} are into this`
          : `${proof[0].name.slice(0, 60)}, ${proof[1].name.slice(0, 60)} and others are into this`;
  const showMoments = !restricted && posts.length > 0;
  // Moments strip: square thumbnails of the Corner's public photo Moments. Hidden under 5 Moments.
  const stripPosts = posts.filter((p) => p.type === "photo" && !!p.media).slice(0, 12);
  const showStrip = !restricted && posts.length >= 5 && stripPosts.length >= 5;
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
    "inline-flex min-h-12 items-center justify-center rounded-control bg-[var(--accent)] px-6 text-body font-semibold text-[var(--accent-foreground)] disabled:opacity-60";
  const createHref = user ? "/create-space" : `/login?redirect=${encodeURIComponent("/create-space")}`;

  return (
    <div className="ns-afterhours min-h-viewport">
      {/* Hero: 280px of the Corner's photo, the way back to its group, the name and one meta line. The photo grows in from Discover's hero card. */}
      <header className="relative flex h-[280px] flex-col overflow-hidden bg-[var(--cat)] text-on-media" style={cornerStyle(corner.spaceSlug, corner.slug)}>
        <div className="absolute inset-0" style={{ viewTransitionName: cornerPhotoTransitionName(corner.slug) }}>
          <ImageWithFallback
            src={cornerPhoto(corner.spaceSlug, corner.slug, 1600)}
            alt={cornerPhotoAlt(corner.slug)}
            priority
            width={1200}
            className="absolute inset-0 size-full"
          />
          <div className="pointer-events-none absolute inset-0 bg-scrim-solid/25" aria-hidden="true" />
          <div className="bg-scrim pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="bg-hero-fade pointer-events-none absolute inset-0" aria-hidden="true" />
        </div>
        <div className={`${PAGE_X} relative flex flex-1 flex-col pb-5 pt-3`}>
          <Link to={category ? `/browse/${category.slug}` : "/corners"} className="inline-flex min-h-11 items-center self-start text-small hover:underline">
            {category ? `← ${category.name}` : "← Corners"}
          </Link>
          <div className="mt-auto flex flex-col items-start gap-1">
            <h1 className="max-w-2xl text-display font-extrabold" style={displayStyle(48, { lineHeight: 1 })}>
              {corner.name}
            </h1>
            {metaLine && <p className="text-body text-on-media/90">{metaLine}</p>}
          </div>
        </div>
      </header>

      <div className={`${PAGE_X} pb-56 pt-8 desk:pb-40`}>
        {/* The photo credit sits on the page, under the hero: on a bright photo it would not be readable over it. */}
        {photo && (
          <div className="-mt-6 mb-4 flex justify-end">
            <a
              href={photo.source}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-caption text-muted-foreground hover:underline"
            >
              {`Photo: ${photo.credit} on Unsplash`}
            </a>
          </div>
        )}

        {error && <p role="alert" className="mb-6 text-small text-destructive">{error}</p>}

        {(proof.length > 0 || heroEvent) && (
          <section aria-label="Who is into this" className="mb-10 flex flex-col gap-4 rounded-card bg-card p-4">
            {proof.length > 0 && (
              <div className="flex items-center gap-4">
                <AvatarStack people={proof} size="size-10" />
                <p className="text-body font-semibold">{proofLine}</p>
              </div>
            )}
            {heroEvent && (
              <HeroEvent
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
            )}
          </section>
        )}

        {(corner.steps.length > 0 || corner.about || corner.worth.length > 0) && (
          <div className={`${SECTION_GAP} grid gap-10 tab:gap-8 ${corner.worth.length > 0 ? "tab:grid-cols-2" : ""}`}>
            {(corner.steps.length > 0 || corner.about) && (
              <section id="section-home" className="scroll-mt-24" aria-labelledby="start-title">
                <SectionTitle id="start-title">Your first time</SectionTitle>
                {corner.about && <p className="mb-4 text-body text-muted-foreground">{corner.about}</p>}
                {corner.steps.length > 0 && (
                  <ol className="space-y-3">
                    {corner.steps.map((step, i) => (
                      <li key={step} className="flex items-center gap-4 rounded-card bg-card p-4">
                        <span className="text-title font-semibold text-[var(--accent-text)]" aria-hidden="true">{i + 1}</span>
                        <span className="text-body">{tieNumbers(step)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )}
            {corner.worth.length > 0 && (
              <section aria-labelledby="worth-title">
                <SectionTitle id="worth-title">Why it’s worth it</SectionTitle>
                <ul className="grid gap-3 tab:grid-cols-2">
                  {corner.worth.map((w) => (
                    <li key={w} className="flex gap-2 rounded-card border border-border p-4 text-body">
                      <Sparkle className="mt-1 size-4 shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
                      {w}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {showStrip && (
          <section className={SECTION_GAP} aria-labelledby="strip-title">
            <h2 id="strip-title" className="sr-only">
              Moments
            </h2>
            <SnapCarousel
              name={`corner.${corner.slug}.moments`}
              label={`Moments in ${corner.name}`}
              items={stripPosts}
              getKey={(post) => String(post.id)}
              itemClassName="w-36 tab:w-44"
              renderItem={(post) => (
                <button type="button" onClick={() => setOpenPost(post)} className="block aspect-square w-full overflow-hidden rounded-card bg-card">
                  <ImageWithFallback src={post.mediaUrls?.[0] ?? post.media} alt={momentAlt(post, corner.name)} width={360} className="size-full" />
                </button>
              )}
            />
            <p className="mt-3 text-small text-muted-foreground">{`${plural(posts.length, "Moment")} in ${corner.name}`}</p>
          </section>
        )}

        {corner.needs.length > 0 && (
          <section className={SECTION_GAP} aria-labelledby="need-title">
            <SectionTitle id="need-title">What you’ll need</SectionTitle>
            <ul className="grid gap-3 tab:grid-cols-2 desk:grid-cols-4">
              {corner.needs.map((need) => (
                <li key={need} className="flex gap-2 rounded-card border border-border p-4 text-body">
                  <Sparkle className="mt-1 size-4 shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
                  {need}
                </li>
              ))}
            </ul>
          </section>
        )}

        {week.length > 0 && (
          <section id="section-people" className={`${SECTION_GAP} scroll-mt-24`} aria-labelledby="week-title">
            <SectionTitle id="week-title">Happening this week</SectionTitle>
            <HorizontalRow name={`corner.${corner.slug}.week`} label="Happening this week">
              {week.map((e) => (
                <WeekEventCard key={`${e.spaceId}-${e.id}`} event={e} space={spaceById.get(e.spaceId)} />
              ))}
            </HorizontalRow>
          </section>
        )}

        {live && live.spaces.length > 0 && (
          <section id="spaces-section" className={`${SECTION_GAP} scroll-mt-24`} aria-labelledby="spaces-title">
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
          <section id="section-people-into" className={`${SECTION_GAP} scroll-mt-24`} aria-labelledby="people-title">
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

        {mine.length > 0 && (
          <section className={SECTION_GAP} aria-labelledby="mine-title">
            <SectionTitle id="mine-title">Your Moments</SectionTitle>
            <HorizontalRow name={`corner.${corner.slug}.mine`} label="Your Moments">
              {mine.map((p) => (
                <li key={p.id} className="w-44 shrink-0 snap-start py-2">
                  <button type="button" onClick={() => setOpenPost(p)} className="block w-full text-left">
                    <PaperStamp title={corner.name} date={formatDate(p.createdAt)} rotate={tilt(p.id)}>
                      <ImageWithFallback
                        src={p.type === "photo" && p.media ? (p.mediaUrls?.[0] ?? p.media) : cornerPhoto(corner.spaceSlug, corner.slug, 400)}
                        alt={momentAlt(p, corner.name)}
                        width={176}
                        className="aspect-square w-full overflow-hidden"
                      />
                    </PaperStamp>
                  </button>
                </li>
              ))}
            </HorizontalRow>
          </section>
        )}

        {showMoments && !showStrip && (
          <section className={SECTION_GAP} aria-labelledby="moments-title">
            <SectionTitle id="moments-title">Recent Moments</SectionTitle>
            <div className="grid grid-cols-2 gap-3 tab:grid-cols-4 tab:gap-4">
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

        {more.length > 0 && (
          <section className={SECTION_GAP} aria-labelledby="more-title">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 id="more-title" style={displayStyle(26, { lineHeight: 1.1 })}>
                More Corners like this
              </h2>
              {category && (
                <Link to={`/browse/${category.slug}`} className="inline-flex min-h-11 shrink-0 items-center text-small font-semibold text-[var(--accent-text)] hover:underline">
                  See all
                </Link>
              )}
            </div>
            <HorizontalRow name={`corner.${corner.slug}.more`} label="More Corners like this">
              {more.map((x) => (
                <CornerCard key={x.slug} corner={x} subline={cornerSubline(x, undefined)} />
              ))}
            </HorizontalRow>
          </section>
        )}

        <section className={SECTION_GAP}>
          <PressLink to={createHref} className={buttonClass}>
            Create a Space
          </PressLink>
        </section>
      </div>

      {/* The one primary action; the other two are small links under it. Sits above the tab bar on a phone. */}
      <div className="fixed inset-x-0 bottom-[calc(72px+var(--safe-bottom))] z-30 border-t border-border bg-background desk:bottom-0">
        <div className="mx-auto flex max-w-md flex-col items-center gap-1 px-4 pt-3 pb-2">
          <PillButton className="w-full" onClick={doWithPeople}>
            Do this with people
          </PillButton>
          <div className="flex items-center gap-6">
            <button type="button" onClick={() => goTo(`/pursuits/new?${cornerParams}`)} className="min-h-11 text-small font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Set a solo goal
            </button>
            <button type="button" onClick={() => goTo(`/create?${cornerParams}`)} className="min-h-11 text-small font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              I did this
            </button>
          </div>
        </div>
      </div>

      <MakeItAPursuitSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        corner={{ spaceSlug: corner.spaceSlug, slug: corner.slug, name: corner.name }}
        startOpenGroup={hostFlow}
      />

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
    <div className="mt-3 flex flex-col items-start gap-1">
      <p className="line-clamp-2 break-words text-lead font-semibold">{event.title}</p>
      <p className="text-body tabular-nums">
        <time dateTime={event.startsAt}>{formatStarts(event.startsAt, { timeZone: event.timezone })}</time>
        {space && (
          <>
            {" · "}
            <Link to={`/space/${space.slug}`} className="hover:underline">{space.name}</Link>
          </>
        )}
      </p>
      {host && (
        <p className="flex items-center gap-2 text-small">
          <Avatar className="size-7">
            {host.avatarUrl && <AvatarImage src={host.avatarUrl} alt="" />}
            <AvatarFallback className="text-caption">{initials(host.name)}</AvatarFallback>
          </Avatar>
          <span>{host.name}</span>
        </p>
      )}
      <div className="mt-3">
        {closedToYou && space ? (
          <PressLink to={`/space/${space.slug}`} className={buttonClass}>
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
    <li className="w-[260px] shrink-0 snap-start tab:w-[300px]">
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
          <Link to={`/space/${space.slug}`} className="flex min-h-11 items-center text-small font-semibold hover:underline" title={space.name}>
            <span className="truncate">{space.name}</span>
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
