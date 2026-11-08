import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { Check, Lock, Sparkle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { ErrorNotice } from "../components/StateViews";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { ImageWithFallback } from "../components/ImageWithFallback";
import { HorizontalRow } from "../components/HorizontalRow";
import { CornerCard } from "../components/corners/CornerCard";
import { PressLink } from "../components/common/PressLink";
import { MomentDetail } from "../components/MomentDetail";
import { PursuitDialog } from "../components/PursuitDialog";
import { CornerWalls } from "../components/corners/CornerWalls";
import { WALL_COPY } from "../components/corners/WallCard";
import { seedFromCard, type Chain, type WallCard } from "../lib/cornerWalls";
import { POST_COLUMNS, rowToPost } from "../context/ContentContext";
import { resolvePostMedia, signMomentPaths } from "../lib/momentMedia";
import { useSocial } from "../context/SocialContext";
import { useHistoryState } from "../lib/useHistoryState";
import { type Post } from "../data/posts";
import { isInCorner } from "../lib/cornerAlias";
import { curatedBySlug } from "../data/curatedCorners";
import { CORNER_CATEGORIES } from "../data/cornerCategories";
import { hasHobbyPhoto } from "../data/hobbyPhotos";
import { cornerKey, homeCornersIn } from "../data/homeCorners";
import { cornerGuide } from "../data/cornerGuides";
import { cornerStyle } from "../lib/categoryStyle";
import { cornerPhotoTransitionName } from "../components/discover/HeroCard";
import { AvatarStack } from "../components/ui/AvatarStack";
import { PillButton } from "../components/ui/PillButton";
import { MakeItAPursuitSheet } from "../components/pursuit/MakeItAPursuitSheet";
import { builtInCornerModel, curatedModel, plainModel, type CornerModel } from "../lib/cornerModel";
import { cornerFollowKey, useCorners } from "../context/CornersContext";
import { hobbies } from "../data/hobbies";
import { WeekEventCard } from "../components/corners/WeekEventCard";
import { cornerPhoto, cornerPhotoAlt, cornerPhotoCredit } from "../lib/cornerPhoto";
import { cornerSubline } from "../lib/cornerSubline";
import { fetchCornersLive, thisWeek, type CornerLive, type LiveEvent, type LiveSpace } from "../lib/cornersLive";
import { formatStarts } from "../lib/dates";
import { PAGE_X, SECTION_GAP } from "../lib/pageGrid";
import { plural } from "../lib/plural";
import { cancelRsvp, requestOrJoinSpace, rsvpToEvent } from "../lib/spaces";
import { tieNumbers } from "../lib/typography";
import { CornerStarterContent } from "../components/corners/CornerStarterContent";
import { CornerActivities } from "../components/corners/CornerActivities";

/**
 * A single Corner (/corners/:slug), open to signed-out and not-yet-approved
 * visitors, who see Corners, guides, Open Spaces and event titles and times
 * only (no people, Moments, hosts or Closed Spaces) and one line saying
 * members see who's going.
 * Top to bottom: the hero (the Corner's photo, its name, a line with its category as a link, its length
 * and place, and Follow), who is into it, then two tabs. Walls (members' default): Still making and
 * Made it, each card with a Make your version tear-off, then Passed along. Your first time (the default
 * for visitors): How to start beside Why it's worth it, What you'll need, starter activities, Spaces in
 * the Corner and more Corners like it, then Create a Space.
 * Events are not shown on this page (founder, Nov 7, 2026); their code is untouched.
 * A section with nothing in it is not shown. Nothing from a Closed Space
 * reaches a non-member beyond an event's title and time. Starter ideas never
 * create a person's Pursuit until they review and submit the existing form.
 */

/** Founder, Nov 7, 2026: events are not part of Soosh. Hidden here only; nothing behind them is removed. */
const SHOW_EVENTS = false;

type Tab = "walls" | "first";
const initials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

type Person = { id: string; name: string; avatarUrl?: string; username?: string };
type Membership = { role: string; status: string };

function SectionTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="mb-4 text-title">
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
  const [liveFailed, setLiveFailed] = useState(false);
  const [liveAttempt, setLiveAttempt] = useState(0);
  const [hosts, setHosts] = useState<Map<string, Person>>(new Map());
  const [memberships, setMemberships] = useState<Map<string, Membership>>(new Map());
  const [going, setGoing] = useState<Set<number>>(new Set());
  const [momentCounts, setMomentCounts] = useState<Map<string, number>>(new Map());
  const [stubSpaces, setStubSpaces] = useState<Set<string>>(new Set());
  const [people, setPeople] = useState<Map<string, Person>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openPost, setOpenPost] = useState<Post | null>(null);
  // Remembered through Back. "auto" until chosen: Walls for members, Your first time for visitors.
  const [chosenTab, setTab] = useHistoryState<Tab | "auto">("corner.tab", "auto");
  const [seed, setSeed] = useState<Post | null>(null);
  const [makeOpen, setMakeOpen] = useState(false);
  const social = useSocial();

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
  const tab: Tab = chosenTab === "auto" ? (restricted ? "first" : "walls") : chosenTab;
  const followKey = cornerFollowKey(corner.spaceSlug, corner.slug);
  const following = social.followedHobbies.includes(followKey);
  const toggleFollow = () => (user ? void social.toggleHobbyFollow(followKey, corner.name) : signIn());

  // A wall card opens the Moment itself: the one already loaded, else the full row (its photos signed for this viewer).
  async function openCard(card: WallCard) {
    const known = [...publicFeed, ...myPosts].find((p) => p.id === card.postId);
    if (known) return setOpenPost(known);
    if (!supabase) return;
    const { data } = await supabase.from("posts").select(POST_COLUMNS).eq("id", card.postId).maybeSingle();
    if (!data) return;
    const post = rowToPost(data, card.authorName);
    setOpenPost(resolvePostMedia(post, await signMomentPaths(post.mediaPaths ?? [])));
  }
  // Make your version: your own Pursuit, started because of this Moment.
  function makeFromCard(card: WallCard) {
    setSeed(seedFromCard(card, corner));
    setMakeOpen(true);
  }
  // The dashed You? on a chain starts from the chain's newest Moment.
  async function makeFromChain(chain: Chain) {
    const link = chain.links[chain.links.length - 1];
    let caption = "";
    if (supabase) {
      const { data } = await supabase.from("posts").select("caption").eq("id", chain.lastPostId).maybeSingle();
      caption = (data?.caption as string | null) ?? "";
    }
    setSeed({ ...seedFromCard({ postId: chain.lastPostId, authorId: link.authorId, authorName: link.name, caption, postedAt: Date.now(), mine: false, mediaType: "written", finisherStub: false, startedBecause: [] }, corner) });
    setMakeOpen(true);
  }

  const posts = useMemo(
    () => publicFeed.filter((p) => isInCorner(p, corner.spaceSlug, corner.slug)),
    [publicFeed, corner],
  );

  // Everything live about this Corner.
  useEffect(() => {
    let cancelled = false;
    setLiveFailed(false);
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
    })().catch(() => {
      // The rest of the page is built in and still shows; only the live rows are missing.
      if (!cancelled) setLiveFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [corner, user?.id, restricted, liveAttempt]);

  // The proof line under the hero: the three people who shared a public Moment here most recently. No counts.
  const ranked = useMemo(() => {
    const seen = new Set<string>();
    for (const p of [...posts].sort((a, b) => b.createdAt - a.createdAt)) {
      if (!p.userId || seen.has(p.userId)) continue;
      seen.add(p.userId);
      if (seen.size === 3) break;
    }
    return [...seen];
  }, [posts]);

  useEffect(() => {
    if (!supabase || restricted || ranked.length === 0) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("id, display_name, avatar_url, username")
      .in("id", ranked)
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

  // Who is into this Corner, from the people who shared a Moment here: a few faces and their names, never a count.
  const proof = ranked.flatMap((id) => (people.get(id) ? [people.get(id)!] : []));
  const proofLine =
    proof.length === 0
      ? ""
      : proof.length === 1
        ? `${proof[0].name.slice(0, 60)} is into this`
        : proof.length === 2 && ranked.length === 2
          ? `${proof[0].name.slice(0, 60)} and ${proof[1].name.slice(0, 60)} are into this`
          : `${proof[0].name.slice(0, 60)}, ${proof[1].name.slice(0, 60)} and others are into this`;
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
    <div className="min-h-viewport">
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
            <h1 className="max-w-2xl text-display">
              {corner.name}
            </h1>
            {metaLine && <p className="text-body text-on-media/90">{metaLine}</p>}
            <button
              type="button"
              onClick={toggleFollow}
              aria-pressed={following}
              className="mt-2 inline-flex min-h-11 items-center rounded-full border border-current px-5 text-small font-semibold"
            >
              {following ? "Following" : "Follow"}
            </button>
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

        {(proof.length > 0 || (SHOW_EVENTS && heroEvent)) && (
          <section aria-label="Who is into this" className="mb-6 flex flex-col gap-4 rounded-card bg-card p-4">
            {proof.length > 0 && (
              <div className="flex items-center gap-4">
                <AvatarStack people={proof} size="size-10" />
                <p className="text-body font-semibold">{proofLine}</p>
              </div>
            )}
            {SHOW_EVENTS && heroEvent && (
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

        {/* Walls · Your first time. Remembered through Back. */}
        <div role="tablist" aria-label="Corner" className="mb-6 flex gap-6 border-b border-border">
          {([["walls", WALL_COPY.walls], ["first", "Your first time"]] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`corner-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`corner-panel-${id}`}
              onClick={() => setTab(id)}
              className={`-mb-px flex min-h-11 items-center border-b-2 text-body font-semibold ${tab === id ? "border-[var(--accent)] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "walls" && (
          <div role="tabpanel" id="corner-panel-walls" aria-labelledby="corner-tab-walls">
            <CornerWalls
              corner={corner}
              restricted={restricted}
              onOpenMoment={(c) => void openCard(c)}
              onMake={makeFromCard}
              onMakeFromChain={(c) => void makeFromChain(c)}
              onLogMoment={() => goTo(`/create?${cornerParams}`)}
              onDoWithPeople={doWithPeople}
            />
          </div>
        )}

        {tab === "first" && (
        <div role="tabpanel" id="corner-panel-first" aria-labelledby="corner-tab-first">
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

        <CornerActivities cornerSlug={corner.slug} />

        <CornerStarterContent spaceSlug={corner.spaceSlug} slug={corner.slug} restricted={restricted}/>

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

        {SHOW_EVENTS && week.length > 0 && (
          <section id="section-people" className={`${SECTION_GAP} scroll-mt-24`} aria-labelledby="week-title">
            <SectionTitle id="week-title">Happening this week</SectionTitle>
            <HorizontalRow name={`corner.${corner.slug}.week`} label="Happening this week">
              {week.map((e) => (
                <WeekEventCard key={`${e.spaceId}-${e.id}`} event={e} space={spaceById.get(e.spaceId)} />
              ))}
            </HorizontalRow>
          </section>
        )}

        {!live && !liveFailed && (
          <div className={SECTION_GAP} aria-busy="true" aria-hidden="true">
            <Skeleton className="h-40 w-full rounded-card" />
          </div>
        )}
        {liveFailed && <ErrorNotice className={SECTION_GAP} onRetry={() => setLiveAttempt((n) => n + 1)} />}

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

        {more.length > 0 && (
          <section className={SECTION_GAP} aria-labelledby="more-title">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 id="more-title" className="text-title">
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
        )}
      </div>

      {/* The one primary action; the other two are small links under it. Sits above the tab bar on a phone. */}
      <div className="fixed inset-x-0 bottom-[calc(72px+var(--safe-bottom))] z-30 border-t border-border bg-background desk:bottom-0">
        <div className="mx-auto w-full max-w-[calc(1040px+2rem)] tab:max-w-[calc(1040px+3rem)] desk:max-w-[calc(1040px+4rem)] px-4 tab:px-6 desk:px-8 flex flex-col items-center gap-1 pt-3 pb-2">
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

      <PursuitDialog open={makeOpen} onOpenChange={setMakeOpen} seedPost={seed} />

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
