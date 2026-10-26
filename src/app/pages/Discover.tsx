import { cornerPath } from "../lib/cornerPath";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useHistoryState, useRowScrollMemory } from "../lib/useHistoryState";
import { cornerStyle } from "../lib/categoryStyle";
import { PAGE_X, TITLE_GAP } from "../lib/pageGrid";
import { PressLink } from "../components/afterhours/PressLink";
import { Reveal } from "../components/afterhours/Reveal";
import { MomentTile } from "../components/afterhours/MomentTile";
import {
  Compass,
  LayoutGrid,
  PenLine,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import { marketplaceEnabled } from "../config";
import { hobbies, subHobbyLabel } from "../data/hobbies";
import { Post } from "../data/posts";
import { Product } from "../data/products";
import { useContent } from "../context/ContentContext";
import { useAuth } from "../context/AuthContext";
import { useSocial } from "../context/SocialContext";
import { useCorners, isBrowsableOnDiscover } from "../context/CornersContext";
import { useCategories } from "../context/CategoriesContext";
import { fetchFollowingIds } from "../lib/profileFollows";
import { supabase } from "../../lib/supabase";
import { track } from "../lib/analytics";
import { MomentDetail } from "../components/MomentDetail";
import { ProductCard } from "../components/ProductCard";
import { SpacesBrowser } from "../components/SpacesBrowser";
import { Loadable } from "../components/ui/skeleton";
import { MomentGridSkeleton } from "../components/Skeletons";
import { EmptyState, ErrorNotice } from "../components/StateViews";
import { Button } from "../components/ui/button";
import { PeopleBrowser } from "./People";
import { Masthead } from "../components/door/Masthead";
import { CoverStory } from "../components/door/CoverStory";
import { pickCover } from "../components/door/pickCover";
import { MoodGrid } from "../components/door/MoodGrid";
import { StartHere } from "../components/door/StartHere";
import { SeenTonight } from "../components/door/SeenTonight";
import { Rooms } from "../components/door/Rooms";
import { moodCards, type MoodChipId } from "../data/moodCards";
import { doorFor, readLastMood, writeLastMood } from "../lib/doorList";
import { plural } from "../lib/plural";

/**
 * Discover has an end. That is the whole design: a bounded gallery of work,
 * then a deliberate choice about what to do next — explore a space, create
 * something of your own — rather than another page of work loading itself
 * under your thumb.
 *
 * PAGE_SIZE is the whole of All Moments: 30, then "You're caught up". Nothing
 * here loads on scroll.
 */
const PAGE_SIZE = 30;

const HOUR = 3_600_000;

/** Corners / Spaces / People / Marketplace — Discover's own front door, kept
 * in ?tab= so it's shareable and survives a back button, same as any other
 * page state.
 *
 * Spec change ("Corners carry discovery"): Corners is default now, not
 * Spaces — Categories (what the old "Spaces" tab actually browsed) are
 * internal-only, nobody picks one directly.
 * `spaces` is real now (Phase 5: Create Space, the Space page,
 * SpacesBrowser) — host-created communities, unrelated to the old
 * Category-browsing "Spaces" this same tab id used to mean. */
const DISCOVER_TABS = [
  // "Corners" is not a tab here: it is a link to the Corners page (/corners). This id is only the
  // default view, the door list, shown when no other tab is open.
  { id: "corners", label: "Corners", icon: Compass, hidden: true },
  { id: "spaces", label: "Spaces", icon: LayoutGrid, hidden: false },
  { id: "people", label: "People", icon: UserRound, hidden: false },
  { id: "marketplace", label: "Marketplace", icon: ShoppingBag, hidden: !marketplaceEnabled },
] as const;
type DiscoverTab = (typeof DISCOVER_TABS)[number]["id"];
const VISIBLE_DISCOVER_TABS = DISCOVER_TABS.filter((t) => !t.hidden);

/** The box searches what the open tab lists, so the placeholder says that. The
 * Corners tab also filters the Moments list below it. */
const SEARCH_PLACEHOLDER: Record<DiscoverTab, string> = {
  corners: "Search Corners and Moments",
  spaces: "Search Spaces",
  people: "Search people",
  marketplace: "Search the marketplace",
};

const FEED_TABS = [
  { id: "forYou", label: "For you" },
  { id: "following", label: "Following" },
  { id: "recent", label: "Recent" },
] as const;
type FeedTab = (typeof FEED_TABS)[number]["id"];

/**
 * Shared look for every navigational tab/filter on this page: plain
 * small-caps text, letter-spaced, no pill background — active means a thin
 * underline plus darker text, not a fill. Deliberately not used for
 * "Log a Moment" or any other primary action button,
 * which stay solid — this is for choosing what you're looking at, not
 * doing something.
 */
function tabLabelClass(active: boolean, size: "sm" | "xs" = "sm") {
  return `min-h-11 border-b-2 font-semibold [font-family:var(--font-body)] transition-colors ${
    size === "sm" ? "text-body" : "text-small"
  } ${
    active
      ? "border-[var(--accent)] text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground"
  }`;
}

/**
 * Featured Moments selection: recency first, a small boost for hobbies
 * you're actually in — no engagement/like term. Counts (reaction or legacy
 * `likes`) never sort, rank, filter or promote anything here, per
 * docs/moment-card-and-reactions-spec.md §4.6; "Featured Moments stays
 * curated," not a popularity ranking. Then the result is spread across
 * creators and Spaces so one Moment or one Space can't fill the whole row.
 * No score is ever shown; it only decides the order.
 */
/**
 * "For You"'s own ranking — real signals (who you actually follow, your
 * Interest Corners, Spaces you're an active member of), not an ML model:
 * there's no training pipeline or event log behind this app to build one
 * on, and the honest version of "personalized" here is a short, named list
 * of real connections, same spirit as scorePost's own hobby/tag bonus in
 * ContentContext.tsx. Deliberately NOT engagement-weighted — no love/in/
 * thought count anywhere in this score — per the same guardrail scorePost
 * already follows (docs/moment-card-and-reactions-spec.md §4.6). Kept
 * local to this tab rather than folded into scorePost/publicFeed, which
 * every other surface (My Space, Space pages, "Recent"/"Following") reads
 * too — this only ever changes what "For You" itself shows.
 */
function scoreForYou(
  post: Post,
  followingIds: Set<string>,
  followedHobbySlugs: Set<string>,
  memberSpacePostIds: Set<number>,
): number {
  const ageHours = (Date.now() - post.createdAt) / HOUR;
  const recencyScore = Math.max(0, 240 - ageHours); // same ~10-day decay as scorePost
  const fromSomeoneYouFollow = !!post.userId && followingIds.has(post.userId);
  // Same hobby-follow set + the same "match post.hobbySlug directly" rule
  // the "Following" tab already uses just below (social.followedHobbies
  // mixes space/hobby/Corner-level keys; a plain hobby slug is the only
  // shape that lines up with post.hobbySlug).
  const inYourInterests = followedHobbySlugs.has(post.hobbySlug);
  const fromYourSpace = memberSpacePostIds.has(post.id);
  // Three independent, additive bonuses rather than one flag — a Moment
  // that's both from someone you follow AND in a Space you're part of is
  // more relevant than either alone, not capped at the same bump.
  const bonus = (fromSomeoneYouFollow ? 90 : 0) + (inYourInterests ? 50 : 0) + (fromYourSpace ? 40 : 0);
  return recencyScore + bonus;
}

/**
 * Discover's own Marketplace tab — the one place, alongside a Space's own
 * Marketplace tab, where product listings are actually browsable rather
 * than reachable only by an accidental search hit. Grouped by Space, with
 * each group linking on to that Space's full listing set on /shop rather
 * than duplicating pagination here.
 */
function MarketplaceTab({ query }: { query: string }) {
  const { listings } = useContent();
  const q = query.trim().toLowerCase();
  const matching = q
    ? listings.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.creator.toLowerCase().includes(q),
      )
    : listings;

  const bySpace = new Map<string, Product[]>();
  for (const product of matching) {
    bySpace.set(product.hobbySlug, [...(bySpace.get(product.hobbySlug) ?? []), product]);
  }

  if (matching.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-border px-5 py-6 text-center text-small text-muted-foreground">
        {q ? `No listings match “${query}” yet.` : "Nothing for sale yet"}
      </p>
    );
  }

  return (
    <>
      {[...bySpace.entries()].map(([hobbySlug, list]) => {
        const hobby = hobbies.find((h) => h.slug === hobbySlug);
        return (
          <section key={hobbySlug} className="mb-12">
            <div className="mb-3 flex items-end justify-between gap-4">
              <h2 className="text-title" style={{ fontFamily: "var(--font-serif)" }}>
                {hobby?.name ?? hobbySlug}
              </h2>
              <Link
                to={`/shop?hobby=${hobbySlug}`}
                className="text-caption text-muted-foreground transition-colors hover:text-foreground"
              >
                See all in {hobby?.shortName ?? hobbySlug} →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {list.slice(0, 4).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

/**
 * Corners tab — every Corner across every (internal) Category, flat,
 * name-only tiles (no thumbnail — the name itself, large and in its own
 * color, is the whole tile). Discover's own rule: no empty Corner is ever
 * shown, curated or not (isBrowsableOnDiscover) — a threshold of recent
 * Moments or an active Space, never a bypass for editorial signage. Ordered
 * by 30-day activity, never by follower/member counts. Category is
 * internal-only now, so nothing here names one — just the Corner.
 */
function AllCornersBrowser({ query }: { query: string }) {
  const { cornersFor, cornerThreshold } = useCorners();
  useCategories();
  const q = query.trim().toLowerCase();

  const allCorners = hobbies
    .filter((h) => !h.hidden)
    .flatMap((hobby) => cornersFor(hobby.slug).map((c) => ({ ...c, spaceSlug: hobby.slug })));

  const matching = (q ? allCorners.filter((c) => c.name.toLowerCase().includes(q)) : allCorners)
    .filter((c) => isBrowsableOnDiscover(c, cornerThreshold))
    .sort((a, b) => b.momentCount30d - a.momentCount30d);

  if (matching.length === 0) {
    // No active filter (nothing searched) — there's nothing to say "no
    // matches" about, so hide the row entirely rather than show an empty
    // box with a message that presupposes a search happened. The message
    // below is only ever seen when a search genuinely comes up empty.
    if (!q) return null;
    return (
      <EmptyState line="No Corners match that." hint="Try a broader word." />
    );
  }

  return (
    // Search results: names set large, hairlines between, a dot in the
    // category's colour. (Browsing is the category grid.)
    <ul className="mb-10 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3 md:mb-12">
      {matching.map((c, i) => (
        <li key={`${c.spaceSlug}-${c.slug}`} style={cornerStyle(c.spaceSlug, c.slug)}>
          <Reveal index={Math.min(i, 11)}>
            <PressLink
              to={cornerPath(c.spaceSlug, c.slug)}
              aria-label={`Browse the ${c.name} Corner`}
              className="group flex min-h-14 items-center justify-between gap-4 border-t border-border py-3"
            >
              <span className="text-title text-foreground transition-colors duration-fast group-hover:text-[var(--accent-text)]">
                {c.name}
              </span>
              <span className="size-2 shrink-0 rounded-full bg-[var(--cat)]" aria-hidden="true" />
            </PressLink>
          </Reveal>
        </li>
      ))}
    </ul>
  );
}

export function Discover() {
  const { publicFeed, postsStatus, reloadPosts, myPosts } = useContent();
  const { user } = useAuth();
  // Subscribing re-renders this page when admin Space changes load.
  const { spaceRows } = useCategories();
  const social = useSocial();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("about") ?? "");
  // Opening a Featured Moment is how you react to it or leave a thought —
  // same "media opens MomentDetail" contract MomentCard gives every other
  // surface (docs/moment-card-and-reactions-spec.md §2.3).
  const [openPost, setOpenPost] = useState<Post | null>(null);

  // Tapping what a post is about lands here with that subject already searched.
  useEffect(() => {
    const about = searchParams.get("about");
    if (about) setQuery(about);
  }, [searchParams]);

  const tab: DiscoverTab =
    (searchParams.get("tab") as DiscoverTab | null) &&
    VISIBLE_DISCOVER_TABS.some((t) => t.id === searchParams.get("tab"))
      ? (searchParams.get("tab") as DiscoverTab)
      : "corners";

  function setTab(next: DiscoverTab) {
    const params = new URLSearchParams(searchParams);
    if (next === "corners") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  }

  // Kept across Back so returning from a Moment or Corner finds the list as
  // long as you left it (see useHistoryState).
  const [feedTab, setFeedTab] = useHistoryState<FeedTab>("discover.feedTab", "forYou");
  const tabsRow = useRowScrollMemory("discover.tabs");

  // "For You" personalization signals — real ones, not an ML model: who you
  // actually follow (accepted profile_follows) and which Spaces you're an
  // active member of. Fetched once per account, same guard pattern
  // MySpaceGrid.tsx already uses for both of these exact queries.
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [memberSpacePostIds, setMemberSpacePostIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!user) return;
    fetchFollowingIds(user.id).then(setFollowingIds);
  }, [user?.id]);

  useEffect(() => {
    const client = supabase;
    if (!user || !client) return;
    let cancelled = false;
    (async () => {
      const { data: memberships } = await client
        .from("space_members")
        .select("space_id")
        .eq("user_id", user.id)
        .eq("status", "active");
      const spaceIds = (memberships ?? []).map((m) => m.space_id as string);
      if (spaceIds.length === 0) {
        if (!cancelled) setMemberSpacePostIds(new Set());
        return;
      }
      const { data: moments } = await client
        .from("space_moments")
        .select("post_id")
        .in("space_id", spaceIds)
        .eq("status", "approved")
        .eq("removed_by_host", false);
      if (!cancelled) setMemberSpacePostIds(new Set((moments ?? []).map((m) => m.post_id as number)));
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const q = query.trim().toLowerCase();

  // The Door list: the greeting and default door by local time (a viewer with
  // no Moments is welcomed in), then the chosen door's tickets. The cover is the
  // top ticket; "Start here" is the rest. The tickets and the cover fade out and
  // back in over 150ms when the door changes.
  const door = useMemo(
    () => doorFor(new Date(), user && postsStatus !== "loading" ? myPosts.length : null),
    [user, postsStatus, myPosts.length],
  );
  const [mood, setMood] = useHistoryState<MoodChipId>("discover.mood", readLastMood() ?? door.mood);
  const [shownMood, setShownMood] = useState(mood);
  const startRef = useRef<HTMLUListElement | null>(null);
  useEffect(() => {
    if (shownMood === mood) return;
    const t = window.setTimeout(() => {
      setShownMood(mood);
      startRef.current?.scrollTo({ left: 0 });
    }, 150);
    return () => window.clearTimeout(t);
  }, [mood, shownMood]);
  const tickets = useMemo(() => moodCards(shownMood), [shownMood]);
  // The cover is the highest-ranked ticket whose Corner has a public photo; "Start here" holds the rest.
  const cover = useMemo(() => pickCover(tickets, publicFeed, new Set(followingIds)), [tickets, publicFeed, followingIds]);
  const startCards = useMemo(
    () => tickets.map((card, i) => ({ card, serial: i + 1 })).filter((t) => t.card !== cover?.card),
    [tickets, cover],
  );

  // Category is internal-only now (never shown), but its name/keywords
  // still feed search matching — see spaceScoped's own text match below.
  const hobbyBySlug = useMemo(() => new Map(hobbies.map((h) => [h.slug, h])), [spaceRows]);

  const feedBase = useMemo(() => {
    if (feedTab === "recent") return [...publicFeed].sort((a, b) => b.createdAt - a.createdAt);
    // "Following" reuses hobby-follows honestly — see the TODO on
    // SocialContext's followedHobbies until people can follow people.
    if (feedTab === "following") {
      const followed = new Set(social.followedHobbies);
      return publicFeed.filter((p) => followed.has(p.hobbySlug));
    }
    // "For You" — real personalization: people you follow, hobbies you
    // follow, Spaces you're a member of (see scoreForYou above). Every post
    // still shows (never narrowed like "Following" is), just reordered —
    // this is a re-sort, not a filter, so it degrades to plain recency for
    // a signed-out visitor or anyone with no connections yet, rather than
    // ever showing an empty "For You" tab.
    if (feedTab === "forYou") {
      const followingSet = new Set(followingIds);
      const followedHobbySet = new Set(social.followedHobbies);
      return [...publicFeed].sort(
        (a, b) =>
          scoreForYou(b, followingSet, followedHobbySet, memberSpacePostIds) -
          scoreForYou(a, followingSet, followedHobbySet, memberSpacePostIds),
      );
    }
    return publicFeed;
  }, [publicFeed, feedTab, social.followedHobbies, followingIds, memberSpacePostIds]);

  // Once per meaningful signal change, not per render/keystroke — how many
  // real personalization signals this account actually has right now.
  useEffect(() => {
    if (feedTab !== "forYou") return;
    const signalCount = (followingIds.length > 0 ? 1 : 0) + (memberSpacePostIds.size > 0 ? 1 : 0);
    track({ name: "discover_for_you_personalized", signalCount });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedTab, followingIds.length, memberSpacePostIds.size]);

  // The feed, narrowed only by the search (the All Moments row is For you,
  // Following or Recent; there are no other filters).
  const filtered = useMemo(() => {
    if (!q) return feedBase;
    return feedBase.filter((p) => {
      const hobby = hobbyBySlug.get(p.hobbySlug);
      return (
        p.caption.toLowerCase().includes(q) ||
        p.creator.toLowerCase().includes(q) ||
        (p.interest ?? "").toLowerCase().includes(q) ||
        (p.subHobby ? (subHobbyLabel(p.subHobby) ?? "").toLowerCase().includes(q) : false) ||
        (hobby ? hobby.shortName.toLowerCase().includes(q) || hobby.name.toLowerCase().includes(q) : false)
      );
    });
  }, [feedBase, q, hobbyBySlug]);

  // 30 and no more: the end of the page is a stop, not another load.
  const visible = filtered.slice(0, PAGE_SIZE);

  return (
    <div className="ns-afterhours min-h-viewport">
      {/* One search only: the top bar's, on a wide screen. Where there is no
          top-bar search (a phone), this one field stands in for it. */}
      <div className={`${PAGE_X} pt-4 lg:hidden`}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (searchParams.get("about")) setSearchParams({}, { replace: true });
            }}
            placeholder={SEARCH_PLACEHOLDER[tab]}
            aria-label={SEARCH_PLACEHOLDER[tab]}
            className="h-11 w-full rounded-control border-0 bg-surface pl-10 pr-11 text-body text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-0 top-0 flex size-11 items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="pb-24 pt-2 lg:pt-8">
        <div className={PAGE_X}>
          {/* Corners / Spaces / People / Marketplace — Discover's own front
              door. These tabs never fit a phone-width pill at once, so this scrolls
              horizontally (edge-to-edge, bleeding past the container's own
              padding) instead of overflowing the screen or wrapping into a
              second, layout-shifting row. */}
          <div {...tabsRow} className="-mx-4 mb-6 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:overflow-visible md:px-0">
            <div className="inline-flex w-max items-center gap-6">
              <PressLink to="/corners" className={`flex shrink-0 items-center gap-1.5 ${tabLabelClass(false)}`}>
                <Compass className="size-3.5" strokeWidth={1.8} />
                Corners
              </PressLink>
              <div role="tablist" aria-label="Discover" className="inline-flex w-max items-center gap-6">
              {VISIBLE_DISCOVER_TABS.map(({ id, label, icon: Icon }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(id)}
                    className={`flex shrink-0 items-center gap-1.5 ${tabLabelClass(active)}`}
                  >
                    <Icon className="size-3.5" strokeWidth={1.8} />
                    {label}
                  </button>
                );
              })}
              </div>
            </div>
          </div>

          {tab === "people" && <PeopleBrowser query={query} />}
          {tab === "marketplace" && <MarketplaceTab query={query} />}
          {tab === "spaces" && <SpacesBrowser query={query} />}

          {tab === "corners" && (
            <>
              {/* Ideas, not search results: hidden while a search is open. */}
              {!query.trim() && (
                <>
                  <Masthead />
                  {/* From 1024px the top is a spread: the cover on 7 of 12 columns, the doors on 5. */}
                  <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-10">
                  {cover && <CoverStory card={cover.card} photo={cover.photo} fading={shownMood !== mood} />}
                  <MoodGrid
                    value={mood}
                    greeting={door.greeting}
                    onPick={(id) => {
                      setMood(id);
                      writeLastMood(id);
                    }}
                  />
                  </div>
                  <StartHere ref={startRef} cards={startCards} fading={shownMood !== mood} />
                  <SeenTonight posts={publicFeed} onOpen={setOpenPost} />
                  <Rooms />
                </>
              )}
              {/* While searching, the matching Corners come first. */}
              {query.trim() && <AllCornersBrowser query={query} />}

              {/* All Moments */}
              <div id="all-moments" className={`${TITLE_GAP} flex flex-wrap items-center justify-between gap-4`}>
                <h2 className="text-title">All Moments</h2>
                <ul role="tablist" aria-label="All Moments" className="flex gap-1 rounded-control border border-border bg-card p-1">
                  {FEED_TABS.map(({ id, label }) => {
                    const active = feedTab === id;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => {
                            setFeedTab(id);
                          }}
                          className={`min-h-9 rounded-control px-3.5 text-small font-semibold transition-colors ${
                            active
                              ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {q && filtered.length > 0 && (
                <p className="mb-6 text-small text-muted-foreground">{`${plural(filtered.length, "Moment")} matching “${query}”`}</p>
              )}

              <Loadable loading={postsStatus === "loading"} skeleton={<MomentGridSkeleton count={6} />}>
              {postsStatus === "error" && publicFeed.length === 0 ? (
                <ErrorNotice onRetry={reloadPosts} />
              ) : visible.length === 0 ? (
                feedTab === "following" ? (
                  <EmptyState
                    line="Nothing from your Interests yet."
                    hint="Tag a Moment with a Corner to start building your list."
                    action={{ label: "Log a Moment", to: "/create" }}
                  />
                ) : (
                  <EmptyState line="Nothing matches that yet." hint="Try a broader word or a different filter." />
                )
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                  {visible.map((post, i) => (
                    <Reveal key={post.id} index={i % 8}>
                      <MomentTile post={post} onOpen={() => setOpenPost(post)} />
                    </Reveal>
                  ))}
                </div>
              )}
              </Loadable>

              {/* The end of the gallery: a stop, not more scroll */}
              {visible.length > 0 && (
                <div className="mt-10 rounded-card border border-border bg-card px-6 py-9 text-center">
                  <p className="mb-1 text-lead">You’re caught up</p>
                  <p className="mb-5 text-small text-muted-foreground">Log a Moment of your own.</p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Link to="/create">
                      <Button variant="coral">
                        <PenLine className="size-4" />
                        Log a Moment
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <MomentDetail
        post={openPost}
        owned={!!user && openPost?.userId === user.id}
        onOpenChange={(o) => !o && setOpenPost(null)}
      />
    </div>
  );
}
