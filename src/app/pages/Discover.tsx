import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Search } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { useSocial } from "../context/SocialContext";
import { cornerFollowKey } from "../context/CornersContext";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { MomentDetail } from "../components/MomentDetail";
import { SignUpPrompt } from "../components/SignUpPrompt";
import { Skeleton } from "../components/ui/skeleton";
import { notifyError } from "../components/ui/toaster";
import { DiscoverHeader } from "../components/discover/DiscoverHeader";
import { JumpChips } from "../components/discover/JumpChips";
import { IdeaPills } from "../components/discover/IdeaPills";
import { IdeasRow } from "../components/discover/IdeasRow";
import { CornerTearCard } from "../components/discover/CornerTearCard";
import { SpacesRow } from "../components/discover/SpacesRow";
import { CityFeed } from "../components/discover/CityFeed";
import { SectionBoundary } from "../components/discover/SectionBoundary";
import { InterestsSheet } from "../components/discover/InterestsSheet";
import { useInterests } from "../lib/interests";
import { useUnifiedSearch, type SearchGroup, type SearchHit } from "../lib/search";
import { fetchPasses, fetchTaste, type Taste } from "../lib/tasteRemote";
import type { Pass } from "../lib/tasteModel";
import { fetchHomeSuggestions } from "../lib/homeSuggestions";
import { follow } from "../lib/profileFollows";
import { requestOrJoinSpace } from "../lib/spaces";
import { ideasFor, type IdeaPills as Pills } from "../lib/ideaMatch";
import { defaultPills, loosenSpend, passTagFor, type PassCorners } from "../lib/discoverIdeas";
import { cornerCandidates, cornerCardModel, visitorCorners, type CornerCardModel } from "../lib/discoverCorners";
import { discoverFeed, feedCornerChips, postCornerKey } from "../lib/discoverFeed";
import {
  fetchCornerAffinity,
  fetchDiscoverCorners,
  fetchDiscoverMoments,
  fetchDiscoverSpaces,
  fetchPassCornerMap,
  fetchPublicSpaces,
  logDiscoverEvent,
  orEmpty,
  type DiscoverCorner,
  type DiscoverKind,
  type DiscoverMoment,
  type DiscoverSpace,
} from "../lib/discover";
import { useFeedInputs } from "../lib/useFeedInputs";
import { PAGE_X } from "../lib/pageGrid";
import type { Post } from "../data/posts";

const SEARCH_GROUPS: SearchGroup[] = ["corner", "space", "person"];
const SEARCH_TITLES: Record<string, string> = { corner: "Corners", space: "Spaces", person: "People" };
const FEED_PAGE = 20;
const CORNER_SHOWN = 3;
const CORNER_FETCHED = 6;

function SectionHeading({ id, title, sub, action }: { id: string; title: string; sub?: string; action?: { label: string; to: string } }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 id={id} className="font-[family-name:var(--font-display)] text-title font-bold">
          {title}
        </h2>
        {sub && <p className="text-small text-muted-foreground">{sub}</p>}
      </div>
      {action && (
        <Link to={action.to} className="inline-flex min-h-11 shrink-0 items-center text-small font-semibold text-accent-text">
          {action.label}
        </Link>
      )}
    </div>
  );
}

function SectionSkeleton({ cards }: { cards: number }) {
  return (
    <div className="flex gap-3 overflow-hidden" aria-hidden="true">
      {Array.from({ length: cards }, (_, i) => (
        <Skeleton key={i} className="h-60 w-[260px] shrink-0 rounded-card" />
      ))}
    </div>
  );
}

const initials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

function SearchRow({ hit }: { hit: SearchHit }) {
  return (
    <li>
      <Link to={hit.to} className="flex min-h-14 items-center gap-3 rounded-card bg-card p-3">
        <Avatar className="size-10 shrink-0">
          {hit.avatarUrl && <AvatarImage src={hit.avatarUrl} alt="" />}
          <AvatarFallback className="text-small">{initials(hit.label)}</AvatarFallback>
        </Avatar>
        <span className="min-w-0">
          <span className="block truncate text-body font-semibold">{hit.label}</span>
          {hit.sub && <span className="block truncate text-small text-muted-foreground">{hit.sub}</span>}
        </span>
      </Link>
    </li>
  );
}

/**
 * Discover v2: the world, not your world. Home is what is yours (dated plans,
 * people you follow, Spaces you joined); this is what is not yet: undated ideas,
 * Corners new to you, Spaces near you, and Moments from people you do not follow.
 * One scrolling page: a header with the city, search over Corners, Spaces and
 * people, jump chips, then the four sections. Every section loads and fails on
 * its own, and a Moment, Corner or Space is never on both Home and Discover.
 * Signed out, everything is read only and any action opens the sign up prompt.
 */
export function Discover() {
  const { user } = useAuth();
  const { publicFeed } = useContent();
  const social = useSocial();
  const interests = useInterests();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cityOpen, setCityOpen] = useState(false);
  const [prompt, setPrompt] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim();
  const { groups, loading: searching } = useUnifiedSearch(q);
  const { inputs: feedInputs, loaded: feedInputsLoaded } = useFeedInputs();

  /** Runs `act` for a signed-in person, and opens the sign up prompt for a visitor. */
  const needAccount = useCallback(
    (act: () => void) => {
      if (!user) setPrompt(true);
      else act();
    },
    [user],
  );

  const log = useCallback(
    (kind: DiscoverKind, refId: string, position: number, action: Parameters<typeof logDiscoverEvent>[0]["action"], cornerKey?: string | null) => {
      if (user) void logDiscoverEvent({ kind, refId, cornerKey, position, action });
    },
    [user],
  );

  // ---------- Ideas: local, instant ----------
  const [taste, setTaste] = useState<Taste | null>(null);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [passCorners, setPassCorners] = useState<PassCorners>({});
  const [affinity, setAffinity] = useState<Map<string, number>>(new Map());
  const windowParam = searchParams.get("window") ?? "";
  const [pills, setPills] = useState<Pills>(() => {
    const base = defaultPills(null, Date.now());
    // "Find something" on the Week view opens Discover for one free window.
    return windowParam ? { ...base, time: /^(sat|sun)-/.test(windowParam) ? "weekend" : "tonight" } : base;
  });
  const touched = useRef(Boolean(windowParam));

  useEffect(() => {
    if (!user) return;
    let live = true;
    void fetchTaste(user.id).then((t) => {
      if (!live) return;
      setTaste(t);
      if (!touched.current) setPills(defaultPills(t, Date.now()));
    });
    void fetchPasses(user.id).then((p) => live && setPasses(p));
    void fetchPassCornerMap().then((m) => live && setPassCorners(m));
    void fetchCornerAffinity().then((a) => live && setAffinity(a));
    return () => {
      live = false;
    };
  }, [user?.id]);

  const ideas = useMemo(() => ideasFor(pills, { picks: taste?.picks, affinity }), [pills, taste?.picks, affinity]);
  const changePills = (next: Pills) => {
    touched.current = true;
    setPills(next);
  };

  // ---------- Corners new to you ----------
  const [corners, setCorners] = useState<DiscoverCorner[] | null>(null);
  const [hiddenCorners, setHiddenCorners] = useState<Set<string>>(new Set());
  useEffect(() => {
    let live = true;
    if (user) {
      void orEmpty(fetchDiscoverCorners(CORNER_FETCHED, cornerCandidates())).then((list) => live && setCorners(list));
    } else {
      // A visitor has no taste to rank by, so Corners from different categories, each tab opening the Corner page.
      setCorners(visitorCorners(CORNER_FETCHED).map((cornerKey) => ({ cornerKey, hasHome: true, hasGroup: true, hasPlace: true })));
    }
    return () => {
      live = false;
    };
  }, [user?.id]);
  const cornerCards = useMemo(
    () =>
      (corners ?? [])
        .filter((c) => !hiddenCorners.has(c.cornerKey))
        .flatMap((c) => {
          try {
            return [cornerCardModel(c)];
          } catch {
            return []; // a Corner the app cannot describe is left out, not the section
          }
        })
        .slice(0, CORNER_SHOWN),
    [corners, hiddenCorners],
  );

  const followCorner = (m: CornerCardModel, position: number) =>
    needAccount(() => {
      setHiddenCorners((prev) => new Set(prev).add(m.key));
      log("corner", m.key, position, "followed", m.key);
      void social.toggleHobbyFollow(cornerFollowKey(m.spaceSlug, m.slug), m.name);
    });

  // ---------- Spaces near you ----------
  const [spaces, setSpaces] = useState<DiscoverSpace[] | null>(null);
  const [hiddenSpaces, setHiddenSpaces] = useState<Set<string>>(new Set());
  const [homeEventKeys, setHomeEventKeys] = useState<Set<string>>(new Set());
  useEffect(() => {
    let live = true;
    void orEmpty(user ? fetchDiscoverSpaces(10) : fetchPublicSpaces(10)).then((list) => live && setSpaces(list));
    if (user) {
      // A dated event Home ranks in its top four is never shown on Discover.
      void fetchHomeSuggestions(8).then((list) => {
        if (live) setHomeEventKeys(new Set(list.slice(0, 4).filter((s) => s.kind === "event").map((s) => `${s.spaceSlug}|${s.title}|${s.startsAt}`)));
      });
    }
    return () => {
      live = false;
    };
  }, [user?.id]);
  const visibleSpaces = useMemo(() => (spaces ?? []).filter((s) => !hiddenSpaces.has(s.id)), [spaces, hiddenSpaces]);

  const joinSpace = (space: DiscoverSpace, position: number) =>
    needAccount(() => {
      setHiddenSpaces((prev) => new Set(prev).add(space.id));
      log("space", space.id, position, "joined", space.cornerKey);
      void requestOrJoinSpace(space.id).then(({ error }) => {
        if (error) {
          setHiddenSpaces((prev) => {
            const next = new Set(prev);
            next.delete(space.id);
            return next;
          });
          notifyError(error);
        }
      });
    });

  // ---------- What {city} is making ----------
  const [corner, setCorner] = useState<string | null>(null);
  const [moments, setMoments] = useState<DiscoverMoment[]>([]);
  const [momentsLoading, setMomentsLoading] = useState(true);
  const [momentsDone, setMomentsDone] = useState(false);
  const [chips, setChips] = useState<string[]>([]);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const requestId = useRef(0);
  const cursor = useRef<string | null>(null);

  const loadMoments = useCallback(
    async (reset: boolean) => {
      if (!user) {
        setMomentsLoading(false);
        setMomentsDone(true);
        return;
      }
      const id = reset ? ++requestId.current : requestId.current;
      if (reset) {
        cursor.current = null;
        setMoments([]);
        setMomentsDone(false);
      }
      setMomentsLoading(true);
      const page = await fetchDiscoverMoments({ corner, cursor: cursor.current, limit: FEED_PAGE });
      if (id !== requestId.current) return;
      if (page.length > 0) cursor.current = page[page.length - 1].createdAt;
      setMoments((prev) => (reset ? page : [...prev, ...page]));
      setMomentsDone(page.length < FEED_PAGE);
      setMomentsLoading(false);
    },
    [user, corner],
  );
  useEffect(() => {
    void loadMoments(true);
  }, [loadMoments]);

  const posts = useMemo(() => discoverFeed(moments, publicFeed, feedInputs, followed), [moments, publicFeed, feedInputs, followed]);
  // The chips come from the whole feed, so filtering to one Corner does not collapse them.
  useEffect(() => {
    if (corner === null && posts.length > 0) setChips(feedCornerChips(posts, Date.now()));
  }, [posts, corner]);

  const followAuthor = (post: Post) =>
    needAccount(() => {
      if (!user || !post.userId) return;
      const authorId = post.userId;
      void follow(user.id, authorId).then((ok) => {
        if (!ok) return notifyError("Something went wrong. Try again.");
        // Their Moments leave this page at once; Home shows them once the follow is accepted.
        setFollowed((prev) => new Set(prev).add(authorId));
        log("moment", String(post.id), 0, "followed", postCornerKey(post));
      });
    });

  const openId = searchParams.get("m") ? Number(searchParams.get("m")) : null;
  const openPost = openId != null ? (publicFeed.find((p) => p.id === openId) ?? null) : null;
  const setOpen = (id: number | null) => {
    const next = new URLSearchParams(searchParams);
    if (id == null) next.delete("m");
    else next.set("m", String(id));
    setSearchParams(next, { replace: true });
  };

  const city = interests.city.trim();
  const cornersLoading = corners === null;
  const spacesLoading = spaces === null;

  return (
    <div className="ns-afterhours min-h-viewport">
      <div className={`${PAGE_X} flex flex-col gap-8 pb-16 pt-6`}>
        <DiscoverHeader city={city} onEdit={() => needAccount(() => setCityOpen(true))} />

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search Corners, Spaces, people"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Corners, Spaces, people"
            className="min-h-12 w-full rounded-full border border-border bg-card py-3 pl-11 pr-4 text-body text-foreground outline-none focus-visible:border-accent"
          />
        </div>

        {q ? (
          <div className="flex flex-col gap-6" aria-busy={searching}>
            {SEARCH_GROUPS.map((group) =>
              groups[group].length > 0 ? (
                <section key={group} aria-labelledby={`search-${group}`}>
                  <h2 id={`search-${group}`} className="mb-2 text-small font-semibold text-muted-foreground">
                    {SEARCH_TITLES[group]}
                  </h2>
                  <ul className="flex flex-col gap-2">
                    {groups[group].slice(0, 8).map((hit) => (
                      <SearchRow key={hit.key} hit={hit} />
                    ))}
                  </ul>
                </section>
              ) : null,
            )}
          </div>
        ) : (
          <>
            <JumpChips withMoments={!!user} />

            <SectionBoundary>
              <section id="discover-ideas" aria-labelledby="ideas-title" className="scroll-mt-24">
                <SectionHeading id="ideas-title" title="What could you do?" sub="Ideas for what you’ve got. Tap a pill to change it." />
                <div className="mb-4">
                  <IdeaPills pills={pills} onChange={changePills} />
                </div>
                <IdeasRow
                  ideas={ideas}
                  passTagFor={(key) => passTagFor(key, passes, passCorners)}
                  onShown={(key, i) => log("idea", key, i, "shown", key)}
                  onOpen={(key, i) => log("idea", key, i, "opened", key)}
                  onLoosen={() => changePills(loosenSpend(pills))}
                />
              </section>
            </SectionBoundary>

            <SectionBoundary>
              {cornersLoading ? (
                <section id="discover-corners" className="scroll-mt-24" aria-hidden="true">
                  <Skeleton className="h-64 w-full rounded-card" />
                </section>
              ) : cornerCards.length > 0 ? (
                <section id="discover-corners" aria-labelledby="corners-title" className="scroll-mt-24">
                  <SectionHeading id="corners-title" title="Corners new to you" sub="Three ways into each one" action={{ label: "See all", to: "/corners" }} />
                  <ul className="flex flex-col gap-3">
                    {cornerCards.map((m, i) => (
                      <CornerTearCard
                        key={m.key}
                        model={m}
                        position={i}
                        onFollow={followCorner}
                        onShown={(c, pos) => log("corner", c.key, pos, "shown", c.key)}
                        onOpen={(c, pos) => log("corner", c.key, pos, "opened", c.key)}
                      />
                    ))}
                  </ul>
                </section>
              ) : null}
            </SectionBoundary>

            <SectionBoundary>
              {spacesLoading ? (
                <section id="discover-spaces" className="scroll-mt-24" aria-hidden="true">
                  <SectionSkeleton cards={2} />
                </section>
              ) : visibleSpaces.length > 0 ? (
                <section id="discover-spaces" aria-labelledby="spaces-title" className="scroll-mt-24">
                  <SectionHeading id="spaces-title" title="Spaces near you" sub="Studios, cafés and groups that host things" />
                  <SpacesRow
                    spaces={visibleSpaces}
                    homeEventKeys={homeEventKeys}
                    onJoin={joinSpace}
                    onShown={(s, i) => log("space", s.id, i, "shown", s.cornerKey)}
                    onOpen={(s, i) => log("space", s.id, i, "opened", s.cornerKey)}
                  />
                </section>
              ) : null}
            </SectionBoundary>

            {user && (
              <SectionBoundary>
                <section id="discover-moments" aria-labelledby="moments-title" className="scroll-mt-24">
                  <SectionHeading id="moments-title" title={city ? `What ${city} is making` : "What your city is making"} sub="From people you don’t follow yet" />
                  <CityFeed
                    posts={posts}
                    chips={chips}
                    corner={corner}
                    onCorner={setCorner}
                    loading={momentsLoading || !feedInputsLoaded}
                    hasMore={!momentsDone}
                    onMore={() => void loadMoments(false)}
                    followed={followed}
                    onFollow={followAuthor}
                    onOpen={(post) => setOpen(post.id)}
                    onTry={(post, i) => log("moment", String(post.id), i, "tried", postCornerKey(post))}
                    onShown={(post, i) => log("moment", String(post.id), i, "shown", postCornerKey(post))}
                  />
                </section>
              </SectionBoundary>
            )}
          </>
        )}
      </div>

      <InterestsSheet open={cityOpen} onOpenChange={setCityOpen} />
      <MomentDetail post={openPost} owned={false} onOpenChange={(o) => !o && setOpen(null)} />

      {prompt && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
          <SignUpPrompt
            title="Make an account to do that"
            body="Browsing stays open. An account is for following, joining and keeping what you make."
            onKeepLooking={() => setPrompt(false)}
          />
        </div>
      )}
    </div>
  );
}
