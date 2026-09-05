import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Bookmark, PenLine, Search, UserRound, Users, X } from "lucide-react";
import { hobbies, subHobbyLabel } from "../data/hobbies";
import { circles } from "../data/circles";
import { usePeopleSearch } from "../lib/people";
import { PeopleRow } from "../components/PersonCard";
import { SuggestCategory } from "../components/SuggestCategory";
import { useCategories } from "../context/CategoriesContext";
import { useContent } from "../context/ContentContext";
import { deriveProjects, useJournal } from "../lib/journal";
import { ContentCard } from "../components/ContentCard";
import { HobbyTile } from "../components/HobbyTile";
import { HobbyCategoryCard } from "../components/HobbyCategoryCard";
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

  const chips: Chip[] = useMemo(
    () => [...BASE_CHIPS, ...hobbies.map((h) => ({ id: h.slug, label: h.shortName }))],
    [],
  );

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
      <section className="relative overflow-hidden py-12 sm:py-14">
        <div className="absolute inset-0 [background-image:var(--gradient-brand-soft)]" />
        <div className="container mx-auto max-w-6xl px-4 relative">
          <h1 className="text-4xl md:text-5xl" style={{ fontFamily: "var(--font-serif)" }}>
            Discover
          </h1>
          <p className="mb-6 mt-2 max-w-2xl text-lg text-foreground">
            Hobbies, interests, people, Circles and projects.
          </p>

          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShown(PAGE_SIZE);
                if (searchParams.get("about")) setSearchParams({}, { replace: true });
              }}
              placeholder="Search people, projects, hobbies..."
              className="w-full rounded-full border border-border bg-surface py-2.5 pl-10 pr-10 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="bg-surface pb-24 pt-8">
        <div className="container mx-auto max-w-6xl px-4">
          {/* Fifteen plain-named ways in, plus the sixteenth that admits the
              list is incomplete. These are signage over content that already
              exists — nothing is stored on a post, so the list can change
              without touching anybody's work. */}
          <section className="mb-10">
            <h2 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
              Browse by category
            </h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              A way in, not a list you have to pick from — you can post about
              anything you like.
            </p>
            <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    to={`/category/${c.slug}`}
                    className="flex h-full min-h-[104px] flex-col justify-center gap-1 rounded-2xl border border-border bg-card px-4 py-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--coral-deep)]"
                  >
                    <span
                      className="size-9 rounded-full"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${c.tint} 52%, var(--cream))`,
                      }}
                      aria-hidden="true"
                    />
                    <span className="mt-1 text-sm" style={{ fontFamily: "var(--font-serif)" }}>
                      {c.name}
                    </span>
                    <span className="text-xs leading-relaxed text-muted-foreground">
                      {c.description}
                    </span>
                  </Link>
                </li>
              ))}
              <li>
                <SuggestCategory />
              </li>
            </ul>
          </section>

          {/* The other two things Discover is for. On a phone these are the
              only route to them, since the tab bar carries five destinations
              and Discover is defined as the place they live. */}
          <div className="mb-8 grid gap-2.5 sm:grid-cols-2">
            <Link
              to="/people"
              className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-3.5 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--coral-deep)]"
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
              className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-3.5 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--coral-deep)]"
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
          <ul className="mb-9 flex flex-wrap gap-2">
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

          {/* Explore spaces */}
          <section className="mt-14">
            <h2 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
              Explore spaces
            </h2>
            <p className="mb-5 mt-1 text-sm text-muted-foreground">
              Eight shelves. Open one to see the hobbies on it.
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {hobbies.map((hobby) => (
                <HobbyCategoryCard key={hobby.slug} hobby={hobby} />
              ))}
            </div>
          </section>

          {/* Every hobby, as pictures — the bookshelf view */}
          <section className="mt-14">
            <h2 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
              Every hobby on NoSpace
            </h2>
            <p className="mb-5 mt-1 text-sm text-muted-foreground">
              {hobbies.reduce((n, h) => n + h.subItems.length, 0)} of them. Pick
              the one you've been meaning to start.
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
