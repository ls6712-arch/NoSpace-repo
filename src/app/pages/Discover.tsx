import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Bookmark, PenLine, Search, UserRound, Users, X } from "lucide-react";
import { hobbies, subHobbyLabel } from "../data/hobbies";
import { spacePhoto } from "../data/hobbyPhotos";
import { circles } from "../data/circles";
import { usePeopleSearch } from "../lib/people";
import { PeopleRow } from "../components/PersonCard";
import { SuggestCategory } from "../components/SuggestCategory";
import { useCategories } from "../context/CategoriesContext";
import { useContent } from "../context/ContentContext";
import { deriveProjects, useJournal } from "../lib/journal";
import { ContentCard } from "../components/ContentCard";
import { HobbyTile } from "../components/HobbyTile";
import { GeneratedArt } from "../components/GeneratedArt";
import { Button } from "../components/ui/button";

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

type Chip = { id: string; label: string };

const BASE_CHIPS: Chip[] = [
  { id: "all", label: "All" },
  { id: "new", label: "New today" },
  { id: "near", label: "Near me" },
  { id: "progress", label: "Projects in progress" },
];

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

export function Discover() {
  const { publicFeed, posts } = useContent();
  const { categories } = useCategories();
  const journal = useJournal();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("about") ?? "");

  // Tapping what a post is about lands here with that subject already searched.
  useEffect(() => {
    const about = searchParams.get("about");
    if (about) setQuery(about);
  }, [searchParams]);
  const [chip, setChip] = useState("all");
  const [shown, setShown] = useState(PAGE_SIZE);

  const q = query.trim().toLowerCase();
  const { people, loading: peopleLoading } = usePeopleSearch(query);

  // Just the cross-cutting filters. The Spaces have their own cards above,
  // so repeating all fifteen as chips said the same thing twice.
  const chips: Chip[] = useMemo(() => BASE_CHIPS, []);

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

  const filtered = useMemo(() => {
    let list = publicFeed;
    if (chip === "new") list = list.filter((p) => Date.now() - p.createdAt < DAY);
    else if (chip === "progress") list = list.filter((p) => inProgressIds.has(p.id));
    else if (chip !== "all" && chip !== "near") list = list.filter((p) => p.hobbySlug === chip);

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
  }, [publicFeed, chip, q, inProgressIds]);

  const visible = filtered.slice(0, shown);
  const remaining = filtered.length - visible.length;

  const newMakers = useMemo(() => {
    const seen = new Map<string, number>();
    for (const p of publicFeed) {
      if (!seen.has(p.creator)) seen.set(p.creator, p.createdAt);
    }
    return [...seen.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);
  }, [publicFeed]);

  const savedWork = journal.saved
    .map((id) => posts.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .slice(0, 4);

  // "Near you" only appears if there is actually somewhere near you. Circles
  // with a city attached are the only geography this app honestly has, and it
  // says so rather than inventing a location.
  const localCircles = useMemo(() => circles.filter((c) => c.location), []);

  return (
    <div className="min-h-screen">
      <section className="ns-discover-hero relative overflow-hidden">
        <div className="ns-discover-hero-art" aria-hidden="true">
          <div className="ns-discover-hero-ring" />
          <DiscoverSpaceArt hobbySlug="art-creative" seed="discover-hero" className="h-full w-full" />
        </div>
        <div className="container relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 sm:py-20 lg:grid-cols-[1fr_0.8fr] lg:gap-14 lg:py-24">
          <div className="relative z-10 max-w-2xl">
            <div className="ns-section-kicker mb-5 text-[var(--forest-ink)]">THE FRONT DOOR</div>
            <h1 className="mb-5 text-[clamp(3rem,7vw,5.5rem)] leading-[.92] tracking-[-.04em] text-[var(--forest)]" style={{ fontFamily: "var(--font-serif)" }}>
              Find the thing<br /><em className="text-[var(--coral-deep)]">that keeps calling.</em>
            </h1>
            <p className="mb-8 max-w-lg text-lg leading-relaxed text-[var(--forest-ink)]">
              Hobbies, people, Circles, and works-in-progress — arranged like a good afternoon, not an endless feed.
            </p>
            <div className="ns-discover-search relative max-w-xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--forest-ink)]" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShown(PAGE_SIZE);
                  if (searchParams.get("about")) setSearchParams({}, { replace: true });
                }}
                placeholder="Search people, projects, hobbies..."
                className="w-full border-0 bg-transparent py-4 pl-11 pr-11 text-sm text-[var(--forest-ink)] outline-none placeholder:text-[var(--forest-ink)]/65 focus:ring-0"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--forest-ink)] hover:text-[var(--coral-deep)]" aria-label="Clear search">
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>
          <div className="hidden lg:block" />
        </div>
      </section>

      <div className="bg-surface pb-24 pt-8">
        <div className="container mx-auto max-w-6xl px-4">
          <section className="ns-discover-spaces mb-16">
            <div className="mb-8 flex items-end justify-between gap-5">
              <div className="max-w-xl">
                <div className="ns-section-kicker mb-4">CHOOSE YOUR NEXT THREAD</div>
                <h2 className="mb-3 text-3xl md:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>Open a space. Stay awhile.</h2>
                <p className="text-[1.05rem] leading-relaxed text-muted-foreground">Fifteen ways in, named so you can tell what lives there. Nothing to perform for — just a place to begin.</p>
              </div>
              <span className="hidden font-hud text-[10px] tracking-[.14em] text-[var(--coral-text)] sm:block">{categories.length} SPACES</span>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((c, index) => (
                <li key={c.slug}>
                  <Link to={`/space/${c.slug}`} className="ns-discover-space-card group block">
                    <div className="ns-discover-space-art">
                      <DiscoverSpaceArt hobbySlug={c.slug} seed={`discover-${c.slug}`} className="transition-transform duration-500 group-hover:scale-[1.06]" />
                      <span className="ns-discover-space-number">{String(index + 1).padStart(2, "0")}</span>
                    </div>
                    <div className="ns-discover-space-copy">
                      <div>
                        <h3 className="mb-1 text-xl" style={{ fontFamily: "var(--font-serif)" }}>{c.name}</h3>
                        <p className="text-xs leading-relaxed text-muted-foreground">{c.description}</p>
                      </div>
                      <span className="ns-discover-open">Open space <span aria-hidden="true">↗</span></span>
                    </div>
                  </Link>
                </li>
              ))}
              <li><SuggestCategory /></li>
            </ul>
          </section>

          {/* The other two things Discover is for. On a phone these are the
              only route to them, since the tab bar carries five destinations
              and Discover is defined as the place they live. */}
          <div className="ns-discover-wayfinders mb-10 grid gap-3 sm:grid-cols-2">
            <Link
              to="/people"
              className="ns-discover-wayfinder flex items-center gap-3.5 border border-border bg-card px-4 py-3.5 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--coral-deep)]"
            >
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "color-mix(in srgb, var(--pastel-sky) 42%, var(--cream))" }}
              >
                <UserRound className="size-5 text-[var(--forest-ink)]" strokeWidth={1.7} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm" style={{ fontFamily: "var(--font-serif)" }}>
                  People
                </span>
                <span className="block text-xs text-muted-foreground">
                  Find people by what they make
                </span>
              </span>
            </Link>
            <Link
              to="/circles"
              className="ns-discover-wayfinder flex items-center gap-3.5 border border-border bg-card px-4 py-3.5 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--coral-deep)]"
            >
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "color-mix(in srgb, var(--pastel-sage) 42%, var(--cream))" }}
              >
                <Users className="size-5 text-[var(--forest-ink)]" strokeWidth={1.7} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm" style={{ fontFamily: "var(--font-serif)" }}>
                  Circles
                </span>
                <span className="block text-xs text-muted-foreground">
                  Communities you can join
                </span>
              </span>
            </Link>
          </div>

          {/* Filters */}
          <ul className="ns-discover-filters mb-9 flex flex-wrap gap-2">
            {chips.map((c) => {
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

          {/* People first when you're clearly looking for a person. Searching
              posts alone meant anyone who hadn't posted yet was unfindable. */}
          {q.length >= 2 && (
            <section className="mb-10">
              <h2 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
                People
              </h2>
              <p className="mb-4 mt-1 text-sm text-muted-foreground">
                {peopleLoading
                  ? "Looking…"
                  : people.length === 0
                    ? `Nobody on NoSpace matches "${query}" yet.`
                    : `${people.length} ${people.length === 1 ? "person" : "people"} matching "${query}".`}
              </p>
              {people.length > 0 && <PeopleRow people={people} />}
            </section>
          )}

          {/* Across NoSpace — the gallery */}
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
                {chip === "near" ? "Near you" : "Across NoSpace"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {chip === "near"
                  ? "Location isn't switched on yet — Circles with a city are the closest thing for now."
                  : `${filtered.length} ${filtered.length === 1 ? "piece" : "pieces"} of work${q ? ` matching "${query}"` : ""}.`}
              </p>
            </div>
          </div>

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
                      to="/circles"
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
              Nothing matches that yet — try a broader word or a different filter.
            </div>
          ) : (
            <div className="columns-1 gap-4 sm:columns-2 md:columns-3 xl:columns-4">
              {visible.map((post) => (
                <ContentCard key={post.id} post={post} />
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
                    <Link to="/circles">
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

          {/* New makers */}
          <section className="mt-14">
            <h2 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
              New makers
            </h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              People who've shared work most recently.
            </p>
            <ul className="flex flex-wrap gap-2">
              {newMakers.map((name) => (
                <li
                  key={name}
                  className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {name}
                </li>
              ))}
            </ul>
          </section>

          {/* Every hobby, as pictures — the bookshelf view */}
          <section className="mt-14">
            <h2 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
              Hobby Hub
            </h2>
            <p className="mb-5 mt-1 text-sm text-muted-foreground">
              Find a thread to follow, then open a space and stay awhile.
            </p>
            <div className="space-y-9">
              {hobbies.map((hobby) => (
                <div key={hobby.slug}>
                  <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <Link to={`/space/${hobby.slug}`} className="group">
                        <h3 className="text-lg transition-colors group-hover:text-[var(--coral-text)]">
                          {hobby.name}
                        </h3>
                      </Link>
                      <p className="text-xs text-muted-foreground">{hobby.plainLabel}</p>
                    </div>
                    <Link
                      to={`/space/${hobby.slug}`}
                      className="text-xs text-[var(--coral-text)] hover:underline"
                    >
                      Open space →
                    </Link>
                  </div>
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                    {hobby.subItems.map((s) => (
                      <HobbyTile
                        key={s.slug}
                        hobbySlug={hobby.slug}
                        subSlug={s.slug}
                        label={s.label}
                        to={`/space/${hobby.slug}?hobby=${s.slug}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Saved for later */}
          <section className="mt-14">
            <h2 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
              Saved for later
            </h2>
            <p className="mb-5 mt-1 text-sm text-muted-foreground">
              Work you kept. Only you can see this.
            </p>
            {savedWork.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-5 py-9 text-center text-sm text-muted-foreground">
                <Bookmark className="mx-auto mb-3 size-5" />
                Nothing saved yet — the Save button on any piece of work keeps it
                here.
              </div>
            ) : (
              <div className="columns-1 gap-4 sm:columns-2 md:columns-4">
                {savedWork.map((post) => (
                  <ContentCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
