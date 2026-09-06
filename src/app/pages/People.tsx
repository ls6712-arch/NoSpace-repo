import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Search, Users, X } from "lucide-react";
import { hobbies, subHobbyLabel } from "../data/hobbies";
import { useContent } from "../context/ContentContext";
import { usePeopleSearch, peopleInHobby, type Person } from "../lib/people";
import { PeopleRow } from "../components/PersonCard";
import { Button } from "../components/ui/button";

/**
 * People, found through what they make.
 *
 * There is no "suggested for you", no ranking by popularity, and no counts of
 * any kind. You arrive at a person through a hobby or a search for their
 * name — never through a leaderboard, because the moment a list is ordered by
 * audience size it starts teaching people to chase one.
 *
 * No page chrome of its own, so /people and Discover's People tab share
 * exactly this logic rather than each reimplementing it.
 */
export function PeopleBrowser() {
  const { publicFeed } = useContent();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [hobby, setHobby] = useState(searchParams.get("hobby") ?? "");
  const [inHobby, setInHobby] = useState<Person[]>([]);
  const [loadingHobby, setLoadingHobby] = useState(false);

  const { people: found, loading: searching } = usePeopleSearch(query);

  // The hobbies people are actually working in, so the filters lead somewhere
  // populated rather than listing every Space whether or not anyone's there.
  const activeHobbies = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of publicFeed) {
      counts.set(post.hobbySlug, (counts.get(post.hobbySlug) ?? 0) + 1);
    }
    return hobbies
      .filter((h) => counts.has(h.slug))
      .sort((a, b) => (counts.get(b.slug) ?? 0) - (counts.get(a.slug) ?? 0));
  }, [publicFeed]);

  useEffect(() => {
    if (!hobby) {
      setInHobby([]);
      return;
    }
    let cancelled = false;
    setLoadingHobby(true);
    peopleInHobby(hobby, 24)
      .catch(() => [] as Person[])
      .then((rows) => {
        if (cancelled) return;
        setInHobby(rows);
        setLoadingHobby(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hobby]);

  const setHobbyParam = (slug: string) => {
    setHobby(slug);
    const next = new URLSearchParams(searchParams);
    if (slug) next.set("hobby", slug);
    else next.delete("hobby");
    setSearchParams(next, { replace: true });
  };

  const searching2 = query.trim().length >= 2;
  const hobbyLabel = hobbies.find((h) => h.slug === hobby)?.shortName;

  return (
    <div>
      <div className="relative mb-8 max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people by name…"
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

      {searching2 ? (
        <section className="mb-10">
          <h2 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
            Matching "{query}"
          </h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            {searching
              ? "Looking…"
              : found.length === 0
                ? "Nobody by that name yet."
                : `${found.length} ${found.length === 1 ? "person" : "people"}.`}
          </p>
          {found.length > 0 && <PeopleRow people={found} />}
        </section>
      ) : null}

      <section>
        <h2 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
          By what they make
        </h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          Pick a hobby to see who works in it. This is the intended route:
          you meet someone through the craft, not a ranked list.
        </p>

        <ul className="mb-7 flex flex-wrap gap-2">
          {activeHobbies.map((h) => {
            const on = hobby === h.slug;
            return (
              <li key={h.slug}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setHobbyParam(on ? "" : h.slug)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    on
                      ? "border-transparent text-white [background-color:var(--coral-deep)]"
                      : "border-border bg-card text-foreground hover:border-[var(--foreground)]/35"
                  }`}
                >
                  {h.shortName}
                </button>
              </li>
            );
          })}
        </ul>

        {!hobby ? (
          <div className="rounded-2xl border border-dashed border-border px-5 py-12 text-center">
            <Users className="mx-auto mb-3 size-5 text-muted-foreground" />
            <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
              Choose a hobby above, or search for someone by name.
            </p>
          </div>
        ) : loadingHobby ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Looking…</p>
        ) : inHobby.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-5 py-12 text-center">
            <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
              Nobody's turned up in {hobbyLabel?.toLowerCase()} yet. Share
              something there and you'll be the first.
            </p>
            <Link to={`/create?hobby=${hobby}`} className="mt-4 inline-block">
              <Button variant="outline" size="sm">
                Create something
              </Button>
            </Link>
          </div>
        ) : (
          <PeopleRow people={inHobby} />
        )}
      </section>

      <div className="mt-12 rounded-3xl border border-border bg-card px-6 py-9 text-center">
        <p className="mx-auto mb-4 max-w-md text-sm leading-relaxed text-muted-foreground">
          No follower counts anywhere on NoSpace, not here, not on a
          profile. People are described by what they work on.
        </p>
        <Link to="/discover">
          <Button variant="outline">Explore hobbies instead</Button>
        </Link>
      </div>
    </div>
  );
}

export function People() {
  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden py-12 sm:py-14">
        <div className="absolute inset-0 [background-image:var(--gradient-brand-soft)]" />
        <div className="container mx-auto max-w-5xl px-4 relative">
          <h1 className="text-4xl md:text-5xl" style={{ fontFamily: "var(--font-serif)" }}>
            People
          </h1>
          <p className="mb-6 mt-2 max-w-2xl text-lg text-foreground">
            Find people by what they make, or by name.
          </p>
        </div>
      </section>

      <div className="bg-surface pb-24 pt-8">
        <div className="container mx-auto max-w-5xl px-4">
          <PeopleBrowser />
        </div>
      </div>
    </div>
  );
}
