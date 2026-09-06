import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  Bookmark,
  LayoutGrid,
  PenLine,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { hobbies, subHobbyLabel } from "../data/hobbies";
import { spacePhoto } from "../data/hobbyPhotos";
import { categoryIcon } from "../data/categoryIcons";
import { circles } from "../data/circles";
import { Post } from "../data/posts";
import { useContent } from "../context/ContentContext";
import { useSocial } from "../context/SocialContext";
import { deriveProjects, toggleSaved, useJournalSlice } from "../lib/journal";
import { ContentCard } from "../components/ContentCard";
import { SuggestCategory } from "../components/SuggestCategory";
import { GeneratedArt } from "../components/GeneratedArt";
import { DiscoverHeroArt } from "../components/DiscoverHeroArt";
import { PostMedia } from "../components/PostMedia";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { CirclesBrowser } from "./Circles";
import { PeopleBrowser } from "./People";

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
  { id: "progress", label: "Projects in progress" },
];

/** Spaces / Circles / People — Discover's own front door, kept in ?tab= so
 * it's shareable and survives a back button, same as any other page state. */
const DISCOVER_TABS = [
  { id: "spaces", label: "Spaces", icon: LayoutGrid },
  { id: "circles", label: "Circles", icon: Users },
  { id: "people", label: "People", icon: UserRound },
] as const;
type DiscoverTab = (typeof DISCOVER_TABS)[number]["id"];

const FEED_TABS = [
  { id: "forYou", label: "For You" },
  { id: "following", label: "Following" },
  { id: "recent", label: "Recent" },
] as const;
type FeedTab = (typeof FEED_TABS)[number]["id"];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
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
 * Featured Creations selection.
 *
 * NoSpace doesn't keep aggregate reaction, comment, or save counts today —
 * only a single legacy `likes` number per post (the same one ContentContext's
 * scorePost already leans on, capped and kept a minor factor). So this ranks
 * on what's honestly available — recency first, a small boost for hobbies
 * you're actually in, `likes` last and capped — and then spreads the result
 * across creators and Spaces so one popular thread or one Space can't fill
 * the whole row. No score is ever shown; it only decides the order.
 *
 * TODO: once posts carry real aggregate reaction/comment/save counts, weight
 * those ahead of `likes` here.
 */
function rankFeatured(posts: Post[], followedHobbies: string[], take: number): Post[] {
  const followed = new Set(followedHobbies);
  const scored = posts.map((post) => {
    const ageHours = (Date.now() - post.createdAt) / HOUR;
    const recency = Math.max(0, 200 - ageHours);
    const relevance = followed.has(post.hobbySlug) ? 40 : 0;
    const engagement = Math.min(post.likes, 100) * 0.2;
    return { post, score: recency + relevance + engagement };
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

/** A light tile for the Featured Creations row — image, caption, creator,
 * and Save. Deliberately not a full ContentCard: no reaction grid, no
 * counts, nothing that reads as a leaderboard entry. */
function FeaturedCreationTile({ post }: { post: Post }) {
  const saved = useJournalSlice((s) => s.saved.includes(post.id));

  return (
    <div className="w-64 shrink-0 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative">
        <PostMedia
          media={post.media}
          type={post.type}
          hobbySlug={post.hobbySlug}
          seed={post.id}
          preview
          className="aspect-[4/5] w-full"
        />
        <button
          type="button"
          aria-pressed={saved}
          title={saved ? "Saved" : "Save"}
          onClick={() => toggleSaved(post.id)}
          className="absolute right-2.5 top-2.5 flex size-8 items-center justify-center rounded-full bg-[var(--forest-ink)]/55 backdrop-blur-md transition-colors hover:bg-[var(--forest-ink)]/75"
        >
          <Bookmark
            className="size-4"
            strokeWidth={1.9}
            style={{ color: "white", fill: saved ? "white" : "none" }}
          />
        </button>
      </div>
      <div className="p-3">
        <p className="mb-2 line-clamp-2 text-sm text-foreground/90">{post.caption}</p>
        {post.userId ? (
          <Link
            to={`/u/${encodeURIComponent(post.userId)}`}
            className="flex min-w-0 items-center gap-2 transition-colors hover:text-[var(--coral-text)]"
          >
            <Avatar className="size-6 shrink-0">
              <AvatarFallback className="text-[9px]">{initials(post.creator)}</AvatarFallback>
            </Avatar>
            <span className="truncate text-xs text-muted-foreground">{post.creator}</span>
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <Avatar className="size-6 shrink-0">
              <AvatarFallback className="text-[9px]">{initials(post.creator)}</AvatarFallback>
            </Avatar>
            <span className="truncate text-xs text-muted-foreground">{post.creator}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** One icon tile in the Explore Spaces row. */
function SpaceTile({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
}) {
  return (
    <Link
      to={to}
      className="flex w-28 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card px-3 py-4 text-center transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--coral-deep)]"
    >
      <span
        className="flex size-11 items-center justify-center rounded-full"
        style={{ backgroundColor: "color-mix(in srgb, var(--pastel-sky) 42%, var(--cream))" }}
      >
        <Icon className="size-5 text-[var(--forest-ink)]" strokeWidth={1.7} />
      </span>
      <span className="text-xs leading-tight text-foreground">{label}</span>
    </Link>
  );
}

export function Discover() {
  const { publicFeed } = useContent();
  const social = useSocial();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("about") ?? "");

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

  const filtered = useMemo(() => {
    let list = feedBase;
    if (chip === "new") list = list.filter((p) => Date.now() - p.createdAt < DAY);
    else if (chip === "progress") list = list.filter((p) => inProgressIds.has(p.id));

    if (q) {
      list = list.filter(
        (p) =>
          p.caption.toLowerCase().includes(q) ||
          p.creator.toLowerCase().includes(q) ||
          (p.interest ?? "").toLowerCase().includes(q) ||
          (p.subHobby ? (subHobbyLabel(p.subHobby) ?? "").toLowerCase().includes(q) : false),
      );
    }
    return list;
  }, [feedBase, chip, q, inProgressIds]);

  const visible = filtered.slice(0, shown);
  const remaining = filtered.length - visible.length;

  // "Near you" only appears if there is actually somewhere near you. Circles
  // with a city attached are the only geography this app honestly has, and it
  // says so rather than inventing a location.
  const localCircles = useMemo(() => circles.filter((c) => c.location), []);

  return (
    <div className="min-h-screen">
      <section className="ns-discover-hero relative overflow-hidden">
        <div className="ns-discover-hero-art" aria-hidden="true">
          <div className="ns-discover-hero-ring" />
          <DiscoverHeroArt className="h-full w-full" />
        </div>
        <div className="container relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-8 sm:py-10 lg:grid-cols-[1fr_0.8fr] lg:gap-14 lg:py-12">
          <div className="relative z-10 max-w-2xl">
            <div className="ns-section-kicker mb-3 text-[var(--forest-ink)]">THE FRONT DOOR</div>
            <h1 className="mb-4 text-[clamp(3rem,7vw,5.5rem)] leading-[.92] tracking-[-.04em] text-[var(--forest)]" style={{ fontFamily: "var(--font-serif)" }}>
              Find spaces, circles<br /><em className="text-[var(--coral-deep)]">and people who make things.</em>
            </h1>
            <p className="mb-5 max-w-lg text-lg leading-relaxed text-[var(--forest-ink)]">
              Browse Spaces, join Circles, and find people making things — all in one place.
            </p>
            {tab === "spaces" && (
              <div className="ns-discover-search relative max-w-xl">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--forest-ink)]" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShown(PAGE_SIZE);
                    if (searchParams.get("about")) {
                      const params = new URLSearchParams(searchParams);
                      params.delete("about");
                      setSearchParams(params, { replace: true });
                    }
                  }}
                  placeholder="Search hobbies, people, or spaces..."
                  className="w-full border-0 bg-transparent py-3 pl-11 pr-11 text-sm text-[var(--forest-ink)] outline-none placeholder:text-[var(--forest-ink)]/65 focus:ring-0"
                />
                {query && (
                  <button type="button" onClick={() => setQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--forest-ink)] hover:text-[var(--coral-deep)]" aria-label="Clear search">
                    <X className="size-4" />
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="hidden lg:block" />
        </div>
      </section>

      <div className="bg-surface pb-24 pt-5">
        <div className="container mx-auto max-w-6xl px-4">
          {/* Spaces / Circles / People — Discover's own front door */}
          <div role="tablist" aria-label="Discover" className="mb-6 inline-flex rounded-full border border-border bg-card p-1">
            {DISCOVER_TABS.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "text-white [background-color:var(--coral-deep)]"
                      : "text-foreground hover:text-[var(--coral-text)]"
                  }`}
                >
                  <Icon className="size-4" strokeWidth={1.8} />
                  {label}
                </button>
              );
            })}
          </div>

          {tab === "circles" && <CirclesBrowser />}
          {tab === "people" && <PeopleBrowser />}

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
                    <div className="ns-section-kicker mb-2">CHOOSE YOUR NEXT THREAD</div>
                    <h2 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>Explore Spaces</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Browse all hobby spaces.</p>
                  </div>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  <SpaceTile to="/discover" label="All Spaces" icon={LayoutGrid} />
                  {hobbies.map((hobby) => (
                    <SpaceTile key={hobby.slug} to={`/space/${hobby.slug}`} label={hobby.shortName} icon={categoryIcon(hobby.slug)} />
                  ))}
                  <div className="w-28 shrink-0">
                    <SuggestCategory className="h-full" />
                  </div>
                </div>
              </section>

              {/* Featured Creations */}
              {featured.length > 0 && (
                <section className="mb-14">
                  <div className="mb-5 flex items-end justify-between gap-4">
                    <div>
                      <div className="ns-section-kicker mb-2">POPULAR CREATIONS FROM ACROSS NOSPACE</div>
                      <h2 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>Featured Creations</h2>
                    </div>
                    <a href="#all-creations" className="shrink-0 text-xs text-[var(--coral-text)] hover:underline">
                      See all →
                    </a>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {featured.map((post) => (
                      <FeaturedCreationTile key={post.id} post={post} />
                    ))}
                  </div>
                </section>
              )}

              {/* All Creations */}
              <div id="all-creations" className="mb-4 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="ns-section-kicker mb-2">A FEED OF CREATIONS FROM ALL SPACES, CIRCLES AND PEOPLE</div>
                  <h2 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>All Creations</h2>
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
                              ? "text-white [background-color:var(--forest)]"
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

              <p className="mb-6 text-sm text-muted-foreground">
                {chip === "near"
                  ? "Location isn't switched on yet — Circles with a city are the closest thing for now."
                  : `${filtered.length} ${filtered.length === 1 ? "piece" : "pieces"} of work${q ? ` matching "${query}"` : ""}.`}
              </p>

              {chip === "near" ? (
                <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center">
                  <p className="mx-auto mb-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    NoSpace doesn't know where you are, and won't until you tell it.
                    These Circles have a city attached — the closest thing to near you.
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
                    ? "Nothing from hobbies you follow yet — follow a Space from Explore Spaces above to fill this in."
                    : "Nothing matches that yet — try a broader word or a different filter."}
                </div>
              ) : (
                <div className="columns-1 gap-4 sm:columns-2 md:columns-3 xl:columns-4">
                  {visible.map((post) => (
                    <ContentCard key={post.id} post={post} compact />
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
                        its own — keep going only if you want to.
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
    </div>
  );
}
