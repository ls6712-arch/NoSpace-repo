import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  Compass,
  LayoutGrid,
  PenLine,
  Search,
  ShoppingBag,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { hobbies, subHobbyLabel } from "../data/hobbies";
import { spacePhoto } from "../data/hobbyPhotos";
import { circles } from "../data/circles";
import { Post, postCorner } from "../data/posts";
import { Product } from "../data/products";
import { useContent } from "../context/ContentContext";
import { useAuth } from "../context/AuthContext";
import { useSocial } from "../context/SocialContext";
import { useCorners, isBrowsableOnDiscover, cornerFollowKey } from "../context/CornersContext";
import { useCategories } from "../context/CategoriesContext";
import { deriveProjects } from "../lib/journal";
import { MomentCard, MOMENT_GRID } from "../components/MomentCard";
import { MomentDetail } from "../components/MomentDetail";
import { ProductCard } from "../components/ProductCard";
import { ComingSoonBanner } from "../components/ComingSoonBanner";
import { GeneratedArt } from "../components/GeneratedArt";
import { SpacesBrowser } from "../components/SpacesBrowser";
import { Button } from "../components/ui/button";
import { PeopleBrowser } from "./People";
import { MediaFilter, matchesMediaFilter } from "../components/discover/discoverMedia";

/**
 * Discover has an end. That is the whole design: a bounded gallery of work,
 * then a deliberate choice about what to do next — explore a space, find a
 * Circle, create something of your own — rather than another page of work loading
 * itself under your thumb.
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
 * internal-only, nobody picks one directly. Circle browsing is dropped
 * from Discover's front door entirely: the one real Circle this rework
 * found was deleted along with the rest of Circles' data (see
 * 20260924095000_spaces_rework_cleanup.sql), so there's nothing left to
 * browse here — the demo/seed Circle list is empty too (circles.ts). The
 * `/circles` page itself and CircleBoard aren't touched; this only drops
 * Discover's own tab into them, ahead of their full removal in Phase 6.
 * `spaces` is real now (Phase 5: Create Space, the Space page,
 * SpacesBrowser) — host-created communities, unrelated to the old
 * Category-browsing "Spaces" this same tab id used to mean. */
const DISCOVER_TABS = [
  { id: "corners", label: "Corners", icon: Compass, hidden: false },
  { id: "spaces", label: "Spaces", icon: LayoutGrid, hidden: false },
  { id: "people", label: "People", icon: UserRound, hidden: false },
  { id: "marketplace", label: "Marketplace", icon: ShoppingBag, hidden: false },
] as const;
type DiscoverTab = (typeof DISCOVER_TABS)[number]["id"];
const VISIBLE_DISCOVER_TABS = DISCOVER_TABS.filter((t) => !t.hidden);

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
 * "Add a Moment"/"Start your log" or any other primary action button,
 * which stay solid — this is for choosing what you're looking at, not
 * doing something.
 */
function tabLabelClass(active: boolean, size: "sm" | "xs" = "sm") {
  return `border-b-2 font-medium uppercase tracking-wider transition-colors ${
    size === "sm" ? "pb-2 text-xs" : "pb-1 text-[11px]"
  } ${
    active
      ? "border-[var(--coral-deep)] text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground"
  }`;
}

function DiscoverSpaceArt({
  hobbySlug,
  seed,
  className,
}: {
  hobbySlug: string;
  seed: string;
  className?: string;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = photoFailed ? undefined : spacePhoto(hobbySlug, 1200);

  if (!photo) {
    return <GeneratedArt hobbySlug={hobbySlug} seed={seed} className={className} />;
  }

  return (
    <img
      src={photo}
      alt=""
      loading="lazy"
      onError={() => setPhotoFailed(true)}
      className={`h-full w-full object-cover ${className ?? ""}`}
    />
  );
}

/**
 * Featured Moments selection: recency first, a small boost for hobbies
 * you're actually in — no engagement/like term. Counts (reaction or legacy
 * `likes`) never sort, rank, filter or promote anything here, per
 * docs/moment-card-and-reactions-spec.md §4.6; "Featured Moments stays
 * curated," not a popularity ranking. Then the result is spread across
 * creators and Spaces so one thread or one Space can't fill the whole row.
 * No score is ever shown; it only decides the order.
 */
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
 * than reachable only by an accidental search hit. Grouped by Space, same
 * shape as CirclesBrowser above, with each group linking on to that
 * Space's full listing set on /shop rather than duplicating pagination here.
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
      <>
        <ComingSoonBanner />
        <p className="rounded-2xl border border-dashed border-border px-5 py-6 text-center text-sm text-muted-foreground">
          {q ? `No listings match "${query}" yet.` : "Nothing for sale yet."}
        </p>
      </>
    );
  }

  return (
    <>
      <ComingSoonBanner />
      {[...bySpace.entries()].map(([hobbySlug, list]) => {
        const hobby = hobbies.find((h) => h.slug === hobbySlug);
        return (
          <section key={hobbySlug} className="mb-11">
            <div className="mb-3 flex items-end justify-between gap-4">
              <h2 className="text-xl" style={{ fontFamily: "var(--font-serif)" }}>
                {hobby?.name ?? hobbySlug}
              </h2>
              <Link
                to={`/shop?hobby=${hobbySlug}`}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
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
 * Corners tab — every Corner across every (internal) Category, flat, photo +
 * name per tile. Discover's own rule: no empty Corner is ever shown, curated
 * or not (isBrowsableOnDiscover) — a threshold of recent Moments or an
 * active Space, never a bypass for editorial signage. Ordered by 30-day
 * activity, never by follower/member counts. Category is internal-only now,
 * so nothing here names one — just the Corner.
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
      <div className="rounded-2xl border border-dashed border-border px-5 py-6 text-center text-sm text-muted-foreground">
        No Corners match that. Try a broader word.
      </div>
    );
  }

  return (
    <div className="mb-14 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {matching.map((c) => (
        <Link
          key={`${c.spaceSlug}-${c.slug}`}
          to={`/corner/${c.slug}`}
          className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-[var(--coral-deep)] hover:shadow-md"
        >
          <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface-muted">
            <DiscoverSpaceArt
              hobbySlug={c.spaceSlug}
              seed={`${c.spaceSlug}-${c.slug}`}
              className="transition-transform duration-500 ease-out group-hover:scale-110"
            />
          </div>
          <div className="px-3 py-2.5">
            <span className="block text-sm leading-tight text-foreground">{c.name}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function Discover() {
  const { publicFeed } = useContent();
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
    return publicFeed;
  }, [publicFeed, feedTab, social.followedHobbies]);

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

  // "Near you" only appears if there is actually somewhere near you. Circles
  // with a city attached are the only geography this app honestly has, and it
  // says so rather than inventing a location.
  const localCircles = useMemo(() => circles.filter((c) => c.location), []);

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden py-10 sm:py-12">
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
              placeholder="Search people, projects, hobbies..."
              className="w-full border-0 bg-transparent py-4 pl-11 pr-11 text-sm text-foreground outline-none placeholder:text-foreground/65 focus:ring-0"
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
          {/* Spaces / Circles / People — Discover's own front door. Five
              tabs never fit a phone-width pill at once, so this scrolls
              horizontally (edge-to-edge, bleeding past the container's own
              padding) instead of overflowing the screen or wrapping into a
              second, layout-shifting row. */}
          <div className="-mx-4 mb-6 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:overflow-visible sm:px-0">
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

              {/* Featured Moments */}
              {featured.length > 0 && (
                <section className="mb-14">
                  <div className="mb-5 flex items-end justify-between gap-4">
                    <div>
                      <div className="ns-section-kicker mb-2">POPULAR MOMENTS FROM ACROSS SUSHII</div>
                      <h2 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>Featured Moments</h2>
                    </div>
                    <a
                      href="#all-moments"
                      className="shrink-0 text-xs text-[var(--coral-text)] hover:underline"
                      onClick={(e) => {
                        // A plain href would set location.hash, which the
                        // HashRouter reads as a navigation to path
                        // "/all-moments" — a route that doesn't exist, so it
                        // lands on the 404 page instead of scrolling.
                        e.preventDefault();
                        document.getElementById("all-moments")?.scrollIntoView({ behavior: "smooth" });
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
                  <div className="ns-section-kicker mb-2">MOMENTS FROM ACROSS SUSHII</div>
                  <h2 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>All Moments</h2>
                </div>
                <ul role="tablist" aria-label="Feed" className="flex gap-1 rounded-full border border-border bg-card p-1">
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
                          className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                            active
                              ? "text-white [background-image:var(--gradient-brand)]"
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
                        className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? "border-transparent text-white [background-color:var(--coral-deep)]"
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
                  filled pills. "Add a Moment"/"Start your log" is the one
                  thing on this page that stays a solid button. */}
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

              <p className="mb-6 text-sm text-muted-foreground">
                {chip === "near"
                  ? "Location isn't switched on yet. Circles with a city are the closest thing for now."
                  : `${filtered.length} ${filtered.length === 1 ? "Moment" : "Moments"}${q ? ` matching "${query}"` : ""}.`}
              </p>

              {chip === "near" ? (
                <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center">
                  <p className="mx-auto mb-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    Sushii doesn't know where you are, and won't until you tell it.
                    These Circles have a city attached, the closest thing to near you.
                  </p>
                  <ul className="mx-auto grid max-w-2xl gap-2 text-left sm:grid-cols-2">
                    {localCircles.map((c) => (
                      <li key={c.id}>
                        <Link
                          to="/discover?tab=circles"
                          className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm" style={{ fontFamily: "var(--font-serif)" }}>
                              {c.name}
                            </span>
                            <span className="block text-[11px] text-muted-foreground">{c.location}</span>
                          </span>
                          <Users className="size-4 shrink-0 text-muted-foreground" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : visible.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
                  {feedTab === "following"
                    ? "Nothing from your Interests yet. Tag a Moment with a Corner to start building your list."
                    : "Nothing matches that yet. Try a broader word or a different filter."}
                </div>
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

              {/* The end of the gallery — an intentional choice, not more scroll */}
              {visible.length > 0 && (
                <div className="mt-10 rounded-3xl border border-border bg-card px-6 py-9 text-center">
                  {remaining > 0 ? (
                    <>
                      <p className="mb-4 text-sm text-muted-foreground">
                        That's {visible.length} of {filtered.length}. Nothing loads on
                        its own. Keep going only if you want to.
                      </p>
                      <Button variant="outline" onClick={() => setShown((n) => n + PAGE_SIZE)}>
                        Show more
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="mb-1 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
                        That's everything here.
                      </p>
                      <p className="mb-5 text-sm text-muted-foreground">
                        A good place to stop scrolling and go make something.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-3">
                        <Link to="/create">
                          <Button variant="coral">
                            <PenLine className="size-4" />
                            Create something
                          </Button>
                        </Link>
                        <Link to="/discover?tab=circles">
                          <Button variant="outline">
                            <Users className="size-4" />
                            Find a Circle
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
