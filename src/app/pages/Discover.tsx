import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router";
import {
  Compass,
  LayoutGrid,
  PenLine,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import { marketplaceEnabled, APP_NAME } from "../config";
import { hobbies, subHobbyLabel } from "../data/hobbies";
import { Post, postCorner } from "../data/posts";
import { Product } from "../data/products";
import { useContent } from "../context/ContentContext";
import { useAuth } from "../context/AuthContext";
import { useSocial } from "../context/SocialContext";
import { useCorners, isBrowsableOnDiscover, cornerFollowKey } from "../context/CornersContext";
import { useCategories } from "../context/CategoriesContext";
import { deriveProjects } from "../lib/journal";
import { fetchFollowingIds } from "../lib/profileFollows";
import { cornerColorFor } from "../lib/cornerColor";
import { supabase } from "../../lib/supabase";
import { track } from "../lib/analytics";
import { MomentCard, MOMENT_GRID } from "../components/MomentCard";
import { MomentDetail } from "../components/MomentDetail";
import { ProductCard } from "../components/ProductCard";
import { SpacesBrowser } from "../components/SpacesBrowser";
import { Loadable, useDelayedFlag } from "../components/ui/skeleton";
import { MomentCardSkeleton, MomentGridSkeleton } from "../components/Skeletons";
import { EmptyState, ErrorNotice } from "../components/StateViews";
import { Button } from "../components/ui/button";
import { PeopleBrowser } from "./People";
import { MediaFilter, matchesMediaFilter } from "../components/discover/discoverMedia";
import { plural } from "../lib/plural";
import { scrollBehavior } from "../lib/scrollToElement";

/**
 * Discover has an end. That is the whole design: a bounded gallery of work,
 * then a deliberate choice about what to do next — explore a space, create
 * something of your own — rather than another page of work loading itself
 * under your thumb.
 *
 * PAGE_SIZE is the size of one "look". "Show more" is a button someone
 * presses on purpose; nothing here loads on scroll.
 */
const PAGE_SIZE = 24;

const DAY = 86_400_000;
const HOUR = 3_600_000;

type Chip = { id: string; label: string };

const BASE_CHIPS: Chip[] = [
  { id: "all", label: "All" },
  { id: "new", label: "New today" },
  { id: "near", label: "Near me" },
  { id: "progress", label: "Pursuits in progress" },
];

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
  { id: "corners", label: "Corners", icon: Compass, hidden: false },
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
  { id: "forYou", label: "For You" },
  { id: "following", label: "Following" },
  { id: "recent", label: "Recent" },
] as const;
type FeedTab = (typeof FEED_TABS)[number]["id"];

const MEDIA_FILTERS: { id: MediaFilter; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "photo", label: "Photos" },
  { id: "video", label: "Video" },
  { id: "written", label: "Written" },
];

/**
 * Shared look for every navigational tab/filter on this page: plain
 * small-caps text, letter-spaced, no pill background — active means a thin
 * underline plus darker text, not a fill. Deliberately not used for
 * "Log a Moment" or any other primary action button,
 * which stay solid — this is for choosing what you're looking at, not
 * doing something.
 */
function tabLabelClass(active: boolean, size: "sm" | "xs" = "sm") {
  return `border-b-2 font-medium uppercase tracking-wider transition-colors ${
    size === "sm" ? "pb-2 text-caption" : "pb-1 text-caption"
  } ${
    active
      ? "border-[var(--coral-deep)] text-foreground"
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

function rankFeatured(posts: Post[], followedHobbies: string[], take: number): Post[] {
  const followed = new Set(followedHobbies);
  const scored = posts.map((post) => {
    const ageHours = (Date.now() - post.createdAt) / HOUR;
    const recency = Math.max(0, 200 - ageHours);
    const relevance = followed.has(post.hobbySlug) ? 40 : 0;
    return { post, score: recency + relevance };
  });
  scored.sort((a, b) => b.score - a.score);

  const perCreator = new Map<string, number>();
  const perSpace = new Map<string, number>();
  const picked: Post[] = [];
  for (const { post } of scored) {
    const c = perCreator.get(post.creator) ?? 0;
    const s = perSpace.get(post.hobbySlug) ?? 0;
    if (c >= 2 || s >= 2) continue;
    picked.push(post);
    perCreator.set(post.creator, c + 1);
    perSpace.set(post.hobbySlug, s + 1);
    if (picked.length >= take) break;
  }
  return picked;
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
    <div className="mb-14 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {matching.map((c, i) => (
        <Link
          key={`${c.spaceSlug}-${c.slug}`}
          to={`/corner/${c.slug}`}
          aria-label={`Browse the ${c.name} corner`}
          // Reveal-on-load: .ns-enter is the same rise-and-fade every other
          // entrance in this app uses (theme.css), already switched off
          // wholesale under prefers-reduced-motion. The per-item delay is
          // necessarily dynamic (an unbounded grid, not theme.css's fixed
          // ns-enter-1..4 steps) and capped so a long list still reads as
          // one wave, not a slow trickle. design-token-ignore: stagger delay
          //
          // Background is the card's own color-mix'd 14% toward the
          // Corner's own text color (computed below into --corner-color),
          // deepening to 22% on hover — a colored whisper at rest, a little
          // more playful on interaction. Every one of the 8 hues was
          // contrast-checked at both strengths against light and dark
          // --card, not just the flat --card this used before.
          className="ns-enter group flex min-h-[9rem] flex-col items-center justify-center rounded-card border border-border bg-[color-mix(in_srgb,var(--card)_86%,var(--corner-color)_14%)] px-4 py-6 text-center transition-[transform,border-color,box-shadow,background-color] duration-base ease-standard hover:-translate-y-1 hover:border-[var(--coral-deep)] hover:bg-[color-mix(in_srgb,var(--card)_78%,var(--corner-color)_22%)] hover:shadow-card active:scale-[0.98] sm:min-h-[11rem] sm:px-5"
          style={{ "--corner-color": cornerColorFor(`${c.spaceSlug}-${c.slug}`), animationDelay: `${Math.min(i, 11) * 0.03}s` } as CSSProperties}
        >
          <span
            className="text-[24px] font-semibold leading-tight text-[var(--corner-color)] transition-transform duration-base ease-standard group-hover:scale-105 sm:text-[32px]"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {c.name}
          </span>
        </Link>
      ))}
    </div>
  );
}

/** Holds Spotlight's place while Moments load: same heading, a row of cards. */
function SpotlightSkeleton() {
  const show = useDelayedFlag(true);
  return (
    <section className={`mb-12 ${show ? "" : "invisible"}`} aria-busy="true">
      <div className="mb-5">
        <div className="ns-section-kicker mb-2">Popular Moments from across {APP_NAME}</div>
        <h2 className="text-title" style={{ fontFamily: "var(--font-serif)" }}>Spotlight</h2>
      </div>
      <div className="flex gap-4 overflow-hidden pb-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="w-64 shrink-0">
            <MomentCardSkeleton />
          </div>
        ))}
      </div>
    </section>
  );
}

export function Discover() {
  const { publicFeed, postsStatus, reloadPosts } = useContent();
  const { user } = useAuth();
  // Subscribing re-renders this page when admin Space changes load.
  const { spaceRows } = useCategories();
  const social = useSocial();
  const { cornersFor, cornerThreshold } = useCorners();
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

  const [feedTab, setFeedTab] = useState<FeedTab>("forYou");
  const [chip, setChip] = useState("all");
  const [shown, setShown] = useState(PAGE_SIZE);
  // Flat now, not nested under a Space filter — Corners are the top-level
  // browse/filter unit (spec change: "Corners carry discovery"). Synced to
  // ?corner= so a filtered view is shareable, same as ?tab=.
  const [cornerFilter, setCornerFilter] = useState(searchParams.get("corner") ?? "");
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");

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

  // Ongoing work, so "Projects in progress" means something specific rather
  // than being a mood.
  const projects = useMemo(
    () => deriveProjects(publicFeed, subHobbyLabel),
    [publicFeed],
  );
  const inProgressIds = useMemo(
    () => new Set(projects.flatMap((p) => p.updates.map((u) => u.id))),
    [projects],
  );

  const featured = useMemo(
    () => rankFeatured(publicFeed, social.followedHobbies, 10),
    [publicFeed, social.followedHobbies],
  );

  // Category is internal-only now (never shown), but its name/keywords
  // still feed search matching — see spaceScoped's own text match below.
  const hobbyBySlug = useMemo(() => new Map(hobbies.map((h) => [h.slug, h])), [spaceRows]);

  // Every Corner across every (internal) Category, flat — Corners are the
  // one browse/filter unit Discover shows now. Query-matched by name, same
  // promise the search box always made ("pottery" should find Pottery).
  const allCorners = useMemo(
    () => hobbies.filter((h) => !h.hidden).flatMap((h) => cornersFor(h.slug)),
    [cornersFor, spaceRows],
  );
  const matchingCorners = useMemo(() => {
    if (!q) return allCorners;
    return allCorners.filter((c) => c.name.toLowerCase().includes(q));
  }, [allCorners, q]);
  // Private Interests (hobby_follows, Corner-level — see CornersContext's
  // cornerFollowKey) get first billing here, the one place this rework
  // wires them into anything: your own Interest Corners that clear the
  // same Discover threshold as everyone else (no exemption — an Interest
  // nobody's posted in lately still doesn't show), then everything else.
  // No other ranking changes; this is deliberately the only place Interests
  // touch Discover right now.
  const myInterestCorners = useMemo(
    () => new Set(social.followedHobbies.filter((k) => k.includes(":") && !k.startsWith("space:"))),
    [social.followedHobbies],
  );

  // What Discover actually shows: no empty Corner, curated or not — at
  // least `cornerThreshold` Moments in the last 30 days, or an active
  // Space. Ordered by that same 30-day activity within each group, never
  // by follower/member counts (per this rework's own instruction).
  const browsableCorners = useMemo(
    () =>
      matchingCorners
        .filter((c) => isBrowsableOnDiscover(c, cornerThreshold))
        .sort((a, b) => {
          const aMine = myInterestCorners.has(cornerFollowKey(a.spaceSlug, a.slug));
          const bMine = myInterestCorners.has(cornerFollowKey(b.spaceSlug, b.slug));
          if (aMine !== bMine) return aMine ? -1 : 1;
          return b.momentCount30d - a.momentCount30d;
        }),
    [matchingCorners, cornerThreshold, myInterestCorners],
  );

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

  // Space-scoped, but not yet narrowed by Corner or media type — this is
  // what the Corner filter row's own live counts are measured against, so
  // picking a Corner doesn't make every other Corner's count collapse to 0.
  const chipScoped = useMemo(() => {
    let list = feedBase;
    if (chip === "new") list = list.filter((p) => Date.now() - p.createdAt < DAY);
    else if (chip === "progress") list = list.filter((p) => inProgressIds.has(p.id));

    if (q) {
      list = list.filter((p) => {
        const hobby = hobbyBySlug.get(p.hobbySlug);
        return (
          p.caption.toLowerCase().includes(q) ||
          p.creator.toLowerCase().includes(q) ||
          (p.interest ?? "").toLowerCase().includes(q) ||
          (p.subHobby ? (subHobbyLabel(p.subHobby) ?? "").toLowerCase().includes(q) : false) ||
          (hobby ? hobby.shortName.toLowerCase().includes(q) || hobby.name.toLowerCase().includes(q) : false)
        );
      });
    }
    return list;
  }, [feedBase, chip, q, inProgressIds, hobbyBySlug]);

  // Live counts for the flat Corner-filter row below, measured against the
  // chip/query-scoped feed so picking a Corner doesn't collapse every
  // other Corner's count to 0.
  const cornerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of chipScoped) {
      const slug = postCorner(p);
      if (!slug) continue;
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
    return counts;
  }, [chipScoped]);

  const scoped = useMemo(
    () => (cornerFilter ? chipScoped.filter((p) => postCorner(p) === cornerFilter) : chipScoped),
    [chipScoped, cornerFilter],
  );

  const mediaCounts = useMemo(
    () => ({
      all: scoped.length,
      photo: scoped.filter((p) => matchesMediaFilter(p, "photo")).length,
      video: scoped.filter((p) => matchesMediaFilter(p, "video")).length,
      written: scoped.filter((p) => matchesMediaFilter(p, "written")).length,
    }),
    [scoped],
  );

  const filtered = useMemo(
    () => (mediaFilter === "all" ? scoped : scoped.filter((p) => matchesMediaFilter(p, mediaFilter))),
    [scoped, mediaFilter],
  );

  function selectCorner(slug: string) {
    const next = cornerFilter === slug ? "" : slug;
    setCornerFilter(next);
    setShown(PAGE_SIZE);
    const params = new URLSearchParams(searchParams);
    if (next) params.set("corner", next);
    else params.delete("corner");
    setSearchParams(params, { replace: true });
  }

  const visible = filtered.slice(0, shown);
  const remaining = filtered.length - visible.length;

  return (
    <div className="min-h-viewport">
      <section className="relative overflow-hidden py-12 sm:py-12">
        <div className="container relative mx-auto max-w-3xl px-4">
          <div className="ns-discover-search relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShown(PAGE_SIZE);
                if (searchParams.get("about")) setSearchParams({}, { replace: true });
              }}
              placeholder={SEARCH_PLACEHOLDER[tab]}
              className="w-full border-0 bg-transparent py-4 pl-11 pr-11 text-body text-foreground outline-none placeholder:text-foreground/65 focus:ring-0"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground hover:text-[var(--coral-deep)]" aria-label="Clear search">
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="bg-surface pb-24 pt-5">
        <div className="container mx-auto max-w-6xl px-4">
          {/* Corners / Spaces / People / Marketplace — Discover's own front
              door. These tabs never fit a phone-width pill at once, so this scrolls
              horizontally (edge-to-edge, bleeding past the container's own
              padding) instead of overflowing the screen or wrapping into a
              second, layout-shifting row. */}
          <div className="-mx-4 -mt-2.5 mb-3.5 overflow-x-auto px-4 py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:overflow-visible sm:px-0">
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

          {tab === "people" && <PeopleBrowser query={query} />}
          {tab === "marketplace" && <MarketplaceTab query={query} />}
          {tab === "spaces" && <SpacesBrowser query={query} />}

          {tab === "corners" && (
            <>
              <AllCornersBrowser query={query} />

              {/* Spotlight */}
              {postsStatus === "loading" && <SpotlightSkeleton />}
              {featured.length > 0 && (
                <section className="mb-12">
                  <div className="mb-5 flex items-end justify-between gap-4">
                    <div>
                      <div className="ns-section-kicker mb-2">Popular Moments from across {APP_NAME}</div>
                      <h2 className="text-title" style={{ fontFamily: "var(--font-serif)" }}>Spotlight</h2>
                    </div>
                    <a
                      href="#all-moments"
                      className="shrink-0 text-caption text-[var(--coral-text)] hover:underline"
                      onClick={(e) => {
                        // A plain href would set location.hash, which the
                        // HashRouter reads as a navigation to path
                        // "/all-moments" — a route that doesn't exist, so it
                        // lands on the 404 page instead of scrolling.
                        e.preventDefault();
                        document.getElementById("all-moments")?.scrollIntoView({ behavior: scrollBehavior() });
                      }}
                    >
                      See all →
                    </a>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {featured.map((post) => (
                      <div key={post.id} className="w-64 shrink-0">
                        <MomentCard
                          post={post}
                          surface="discover"
                          size="compact"
                          onOpen={() => setOpenPost(post)}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* All Moments */}
              <div id="all-moments" className="mb-4 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="ns-section-kicker mb-2">Moments from across {APP_NAME}</div>
                  <h2 className="text-title" style={{ fontFamily: "var(--font-serif)" }}>All Moments</h2>
                </div>
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
                            setShown(PAGE_SIZE);
                          }}
                          className={`rounded-control px-3.5 py-1.5 text-caption font-medium transition-colors ${
                            active
                              ? "text-on-brand [background-image:var(--gradient-brand)]"
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

              {/* De-emphasized filters — real, but secondary to the tabs above */}
              <ul className="ns-discover-filters mb-6 flex flex-wrap gap-2">
                {BASE_CHIPS.map((c) => {
                  const active = chip === c.id;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setChip(c.id);
                          setShown(PAGE_SIZE);
                        }}
                        className={`rounded-control border px-3.5 py-1.5 text-caption font-medium transition-colors ${
                          active
                            ? "border-transparent text-on-brand [background-color:var(--coral-deep)]"
                            : "border-border bg-card text-foreground hover:border-[var(--foreground)]/35"
                        }`}
                      >
                        {c.label}
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* Corner filter — flat now, not a Space-then-Corner drill-down:
                  Corners are Discover's one browse/filter unit (spec change,
                  "Corners carry discovery"). Same no-empty-Corner set
                  browsableCorners already filters for the grid above,
                  ordered by 30-day activity — never by follower/member
                  counts. */}
              {browsableCorners.length > 0 && (
                <ul className="mb-4 flex flex-wrap items-center gap-5">
                  {browsableCorners.map((c) => {
                    const active = cornerFilter === c.slug;
                    const count = cornerCounts.get(c.slug) ?? 0;
                    return (
                      <li key={`${c.spaceSlug}-${c.slug}`}>
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => selectCorner(c.slug)}
                          className={tabLabelClass(active, "xs")}
                        >
                          {c.name} · {count}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Media type — same plain-text, underline-on-active look as
                  the top-level Discover tabs and the Corner row above, per
                  the brief: navigational filters read as text choices, not
                  filled pills. "Log a Moment" is the one thing on this page
                  that stays a solid button. */}
              <ul className="mb-6 flex items-center gap-6" role="tablist" aria-label="Media type">
                {MEDIA_FILTERS.map(({ id, label }) => {
                  const active = mediaFilter === id;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => {
                          setMediaFilter(id);
                          setShown(PAGE_SIZE);
                        }}
                        className={tabLabelClass(active)}
                      >
                        {label} · {mediaCounts[id]}
                      </button>
                    </li>
                  );
                })}
              </ul>

              <p className="mb-6 text-small text-muted-foreground">
                {chip === "near"
                  ? "Location isn’t switched on yet."
                  : `${plural(filtered.length, "Moment")}${q ? ` matching “${query}”` : ""}`}
              </p>

              <Loadable loading={postsStatus === "loading"} skeleton={<MomentGridSkeleton count={6} />}>
              {postsStatus === "error" && publicFeed.length === 0 ? (
                <ErrorNotice onRetry={reloadPosts} />
              ) : chip === "near" ? (
                <EmptyState
                  line={`${APP_NAME} doesn’t know where you are, and won’t until you tell it.`}
                  action={{ label: "Browse Moments", onClick: () => setChip("all") }}
                />
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
                <div className={MOMENT_GRID}>
                  {visible.map((post) => (
                    <MomentCard
                      key={post.id}
                      post={post}
                      surface="discover"
                      size="standard"
                      onOpen={() => setOpenPost(post)}
                    />
                  ))}
                </div>
              )}
              </Loadable>

              {/* The end of the gallery — an intentional choice, not more scroll */}
              {visible.length > 0 && (
                <div className="mt-10 rounded-card border border-border bg-card px-6 py-9 text-center">
                  {remaining > 0 ? (
                    <>
                      <p className="mb-4 text-small text-muted-foreground">
                        That’s {visible.length} of {filtered.length}. Nothing loads on
                        its own. Keep going only if you want to.
                      </p>
                      <Button variant="outline" onClick={() => setShown((n) => n + PAGE_SIZE)}>
                        Show more
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="mb-1 text-lead" style={{ fontFamily: "var(--font-serif)" }}>
                        That’s everything here.
                      </p>
                      <p className="mb-5 text-small text-muted-foreground">
                        A good place to stop scrolling and go make something.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-3">
                        <Link to="/create">
                          <Button variant="coral">
                            <PenLine className="size-4" />
                            Create something
                          </Button>
                        </Link>
                      </div>
                    </>
                  )}
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
