import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  ChevronLeft,
  ChevronRight,
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
import { categoryIcon } from "../data/categoryIcons";
import { circles } from "../data/circles";
import { Post, postCorner } from "../data/posts";
import { Product } from "../data/products";
import { useContent } from "../context/ContentContext";
import { useAuth } from "../context/AuthContext";
import { useSocial } from "../context/SocialContext";
import { useCorners, isDiscoverable } from "../context/CornersContext";
import { useCategories } from "../context/CategoriesContext";
import { deriveProjects } from "../lib/journal";
import { hobbyMatchesQuery } from "../lib/search";
import { MomentCard } from "../components/MomentCard";
import { MomentDetail } from "../components/MomentDetail";
import { ProductCard } from "../components/ProductCard";
import { ComingSoonBanner } from "../components/ComingSoonBanner";
import { GeneratedArt } from "../components/GeneratedArt";
import { Button } from "../components/ui/button";
import { CirclesBrowser } from "./Circles";
import { PeopleBrowser } from "./People";
import { MasonryCard } from "../components/discover/MasonryCard";
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

/** Spaces / Circles / People — Discover's own front door, kept in ?tab= so
 * it's shareable and survives a back button, same as any other page state. */
const DISCOVER_TABS = [
  { id: "spaces", label: "Spaces", icon: LayoutGrid },
  { id: "people", label: "People", icon: UserRound },
  { id: "corners", label: "Corner", icon: Compass },
  { id: "circles", label: "Circle", icon: Users },
  { id: "marketplace", label: "Marketplace", icon: ShoppingBag },
] as const;
type DiscoverTab = (typeof DISCOVER_TABS)[number]["id"];

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

/** One tile in the Explore Spaces row — image-forward, same shape as a
 * ContentCard Moments tile: a full-width photo on top (the same
 * photo-or-GeneratedArt source every other Space card uses, via
 * DiscoverSpaceArt — the same images the landing page's HobbyCategoryCard
 * shows for this Space) with its category glyph as a badge over the photo's
 * corner, and the label in a padded strip below. */
function SpaceTile({
  to,
  label,
  icon: Icon,
  hobbySlug,
}: {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  hobbySlug?: string;
}) {
  return (
    <Link
      to={to}
      className="group flex w-40 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-border bg-card transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-[var(--coral-deep)] hover:shadow-md"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface-muted">
        {hobbySlug ? (
          <DiscoverSpaceArt
            hobbySlug={hobbySlug}
            seed={hobbySlug}
            className="transition-transform duration-500 ease-out group-hover:scale-110"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ backgroundColor: "color-mix(in srgb, var(--pastel-sky) 42%, var(--surface-elevated))" }}
          >
            <Icon className="size-8 text-foreground" strokeWidth={1.7} />
          </div>
        )}
        {hobbySlug && (
          <span
            className="absolute bottom-2 right-2 flex size-7 items-center justify-center rounded-full border-2 border-card transition-transform duration-300 ease-out group-hover:scale-110"
            style={{ backgroundColor: "var(--coral-deep)" }}
          >
            <Icon className="size-4 text-white" strokeWidth={2} />
          </span>
        )}
      </div>
      <div className="px-3 py-2.5">
        <span className="block text-sm leading-tight text-foreground">{label}</span>
      </div>
    </Link>
  );
}

/** Wraps the Explore Spaces tiles in a snap-scrolling track with a hidden
 * scrollbar (same technique PostMediaCarousel.tsx uses for post photos) and
 * two round paging buttons — desktop/mouse only, since touch already scrolls
 * fine by drag. */
function SpacesRow({ children }: { children: React.ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);

  const page = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <button
        type="button"
        aria-label="Scroll spaces left"
        onClick={() => page(-1)}
        className="absolute left-0 top-[calc(50%-1rem)] hidden size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-md hover:border-[var(--coral-deep)] md:flex"
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Scroll spaces right"
        onClick={() => page(1)}
        className="absolute right-0 top-[calc(50%-1rem)] hidden size-9 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-border bg-card shadow-md hover:border-[var(--coral-deep)] md:flex"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
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
 * Corners tab — every Corner across every Space, flat (not grouped by
 * Space), photo + name per tile, same discoverability rule Space pages
 * already use (isDiscoverable: curated corners always show; tagged-into-
 * existence corners need at least one public Moment).
 */
function AllCornersBrowser({ query }: { query: string }) {
  const { cornersFor } = useCorners();
  useCategories();
  const q = query.trim().toLowerCase();

  const allCorners = hobbies.filter((h) => !h.hidden).flatMap((hobby) =>
    cornersFor(hobby.slug)
      .filter(isDiscoverable)
      .map((c) => ({ ...c, spaceSlug: hobby.slug, spaceName: hobby.shortName })),
  );

  const matching = q
    ? allCorners.filter((c) => c.name.toLowerCase().includes(q))
    : allCorners;

  if (matching.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-5 py-6 text-center text-sm text-muted-foreground">
        No corners match that yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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
            <span className="block text-xs text-muted-foreground">{c.spaceName}</span>
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
  const { cornersFor } = useCorners();
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
    DISCOVER_TABS.some((t) => t.id === searchParams.get("tab"))
      ? (searchParams.get("tab") as DiscoverTab)
      : "spaces";

  function setTab(next: DiscoverTab) {
    const params = new URLSearchParams(searchParams);
    if (next === "spaces") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  }

  const [feedTab, setFeedTab] = useState<FeedTab>("forYou");
  const [chip, setChip] = useState("all");
  const [shown, setShown] = useState(PAGE_SIZE);
  // Corners are scoped to one Space (context.CornersContext's cornersFor
  // takes a single spaceSlug), so a Corner filter only means something once
  // a Space is chosen — hence the two live together, and picking a new
  // Space (or clearing it) always clears whatever Corner was chosen inside
  // the last one.
  const [spaceFilter, setSpaceFilter] = useState("");
  const [cornerFilter, setCornerFilter] = useState("");
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

  const hobbyBySlug = useMemo(() => new Map(hobbies.map((h) => [h.slug, h])), [spaceRows]);

  // The search box promises hobbies and spaces, not just post captions, so a
  // Space's own name and tagline count as a match too — and so does any of
  // its Corners (curated or tagged-into-existence): "pottery" is a Corner
  // inside Crafts & Making, not a Space name on its own, and searching it
  // used to turn up nothing here at all.
  const filteredHobbies = useMemo(() => {
    const visible = hobbies.filter((h) => !h.hidden);
    if (!q) return visible;
    return visible.filter((h) => {
      const cornerNames = cornersFor(h.slug)
        .filter(isDiscoverable)
        .map((c) => c.name);
      return hobbyMatchesQuery(h, cornerNames, q);
    });
  }, [q, cornersFor, spaceRows]);

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
  const spaceScoped = useMemo(() => {
    let list = feedBase;
    if (chip === "new") list = list.filter((p) => Date.now() - p.createdAt < DAY);
    else if (chip === "progress") list = list.filter((p) => inProgressIds.has(p.id));
    if (spaceFilter) list = list.filter((p) => p.hobbySlug === spaceFilter);

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
  }, [feedBase, chip, spaceFilter, q, inProgressIds, hobbyBySlug]);

  const cornerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of spaceScoped) {
      const slug = postCorner(p);
      if (!slug) continue;
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
    return counts;
  }, [spaceScoped]);

  const scoped = useMemo(
    () => (cornerFilter ? spaceScoped.filter((p) => postCorner(p) === cornerFilter) : spaceScoped),
    [spaceScoped, cornerFilter],
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

  // A Space's Corners (context.CornersContext), for the filter row below —
  // the exact same source /space/:slug's own "Follow a Corner" grid reads
  // (see CategoryFeed.tsx), not a second copy of Corner data.
  const spaceCorners = useMemo(
    () => (spaceFilter ? cornersFor(spaceFilter).filter(isDiscoverable) : []),
    [spaceFilter, cornersFor],
  );

  function selectSpace(slug: string) {
    setSpaceFilter((prev) => (prev === slug ? "" : slug));
    setCornerFilter("");
    setShown(PAGE_SIZE);
  }

  function selectCorner(slug: string) {
    setCornerFilter((prev) => (prev === slug ? "" : slug));
    setShown(PAGE_SIZE);
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
              {DISCOVER_TABS.map(({ id, label, icon: Icon }) => {
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

          {tab === "circles" && <CirclesBrowser query={query} />}
          {tab === "people" && <PeopleBrowser query={query} />}
          {tab === "corners" && <AllCornersBrowser query={query} />}
          {tab === "marketplace" && <MarketplaceTab query={query} />}

          {tab === "spaces" && (
            <>
              {/* Explore Spaces — the real, built-out Spaces (data/hobbies.ts,
                  the same list /space/:slug resolves against), not the wider
                  category taxonomy. CategoriesContext's `categories` can grow
                  with admin-approved suggestions that don't have a Space built
                  for them yet; showing those here as clickable Spaces would be
                  promising a place that isn't actually there. Suggesting a new
                  one is still offered, honestly, as a suggestion. */}
              <section className="mb-14">
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <div className="ns-section-kicker mb-2">CHOOSE YOUR NEXT CORNER</div>
                    <h2 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>Explore Spaces</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {q ? `Spaces matching "${query}".` : "Browse all hobby spaces."}
                    </p>
                  </div>
                </div>
                {q && filteredHobbies.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border px-5 py-6 text-center text-sm text-muted-foreground">
                    No spaces match that yet.
                  </div>
                ) : (
                  <SpacesRow>
                    {!q && <SpaceTile to="/discover" label="All Spaces" icon={LayoutGrid} />}
                    {filteredHobbies.map((hobby) => (
                      <SpaceTile
                        key={hobby.slug}
                        to={`/space/${hobby.slug}`}
                        label={hobby.shortName}
                        icon={categoryIcon(hobby.slug)}
                        hobbySlug={hobby.slug}
                      />
                    ))}
                  </SpacesRow>
                )}
              </section>

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
                  <div className="ns-section-kicker mb-2">A FEED OF MOMENTS FROM ALL SPACES, CIRCLES AND PEOPLE</div>
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

              {/* Space filter — same coral-deep pill language as the chips
                  above, scoped to Explore Spaces' own Space list. Picking one
                  narrows the feed to that Space and, below, opens its own
                  Corner row — the same "Follow a Corner" data /space/:slug
                  shows, filtered to this one Space, since a Corner never
                  means anything across more than one Space at once. */}
              <ul className="mb-3 flex flex-wrap gap-2">
                {filteredHobbies.map((hobby) => {
                  const active = spaceFilter === hobby.slug;
                  return (
                    <li key={hobby.slug}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => selectSpace(hobby.slug)}
                        className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? "border-transparent text-white [background-color:var(--coral-deep)]"
                            : "border-border bg-card text-foreground hover:border-[var(--foreground)]/35"
                        }`}
                      >
                        {hobby.shortName}
                      </button>
                    </li>
                  );
                })}
              </ul>

              {spaceFilter && spaceCorners.length > 0 && (
                <ul className="mb-4 flex flex-wrap items-center gap-5 pl-4">
                  {spaceCorners.map((c) => {
                    const active = cornerFilter === c.slug;
                    const count = cornerCounts.get(c.slug) ?? 0;
                    return (
                      <li key={c.slug}>
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
                  : `${filtered.length} ${filtered.length === 1 ? "piece" : "pieces"} of work${q ? ` matching "${query}"` : ""}.`}
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
                    ? "Nothing from hobbies you follow yet. Follow a Space from Explore Spaces above to fill this in."
                    : "Nothing matches that yet. Try a broader word or a different filter."}
                </div>
              ) : (
                // Pinterest-style masonry: CSS multi-column, not a grid — a
                // real grid forces every row to match its tallest cell,
                // which is exactly the uniform look this layout is meant to
                // avoid. break-inside-avoid keeps a single card from ever
                // splitting across two columns.
                <div className="columns-1 gap-6 sm:columns-2 lg:columns-3">
                  {visible.map((post) => (
                    <div key={post.id} className="mb-6 break-inside-avoid">
                      <MasonryCard post={post} />
                    </div>
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
