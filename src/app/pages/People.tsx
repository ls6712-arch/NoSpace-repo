import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Search, Users, X } from "lucide-react";
import { hobbies, subHobbyLabel } from "../data/hobbies";
import { useContent } from "../context/ContentContext";
import { usePeopleSearch, peopleInHobby, browsePeople, type Person } from "../lib/people";
import { PeopleRow } from "../components/PersonCard";
import { Button } from "../components/ui/button";
import { plural } from "../lib/plural";
import { Loadable } from "../components/ui/skeleton";
import { PersonListSkeleton } from "../components/Skeletons";
import { EmptyState } from "../components/StateViews";

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
 *
 * `query`, when passed, puts this in controlled mode: Discover's own search
 * box drives it instead of the internal one below (which would otherwise
 * duplicate it), and switching to this tab mid-search re-filters against
 * whatever was already typed rather than silently dropping it. Standalone
 * /people keeps its own box and ?q= sync exactly as before.
 */
export function PeopleBrowser({ query: externalQuery }: { query?: string } = {}) {
  const { publicFeed } = useContent();
  const [searchParams, setSearchParams] = useSearchParams();
  const controlled = externalQuery !== undefined;
  const [internalQuery, setInternalQuery] = useState(searchParams.get("q") ?? "");
  const query = controlled ? externalQuery : internalQuery;
  const setQuery = setInternalQuery;
  const [hobby, setHobby] = useState(searchParams.get("hobby") ?? "");
  const [inHobby, setInHobby] = useState<Person[]>([]);
  const [loadingHobby, setLoadingHobby] = useState(false);
  const [browsed, setBrowsed] = useState<Person[]>([]);
  const [loadingBrowse, setLoadingBrowse] = useState(false);

  const { people: found, loading: searching } = usePeopleSearch(query);

  useEffect(() => {
    if (query.trim() || hobby) return;
    let cancelled = false;
    setLoadingBrowse(true);
    browsePeople(24)
      .catch(() => [] as Person[])
      .then((rows) => {
        if (cancelled) return;
        setBrowsed(rows);
        setLoadingBrowse(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      {!controlled && (
        <div className="relative mb-8 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people by name"
            className="w-full rounded-control border border-border bg-surface py-2.5 pl-10 pr-10 text-body outline-none placeholder:text-muted-foreground focus:border-ring"
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
      )}

      {searching2 ? (
        <section className="mb-12">
          <h2 className="text-title" style={{ fontFamily: "var(--font-serif)" }}>
            Matching “{query}”
          </h2>
          <p className="mb-4 mt-1 text-small text-muted-foreground">
            {searching
              ? "Looking…"
              : found.length === 0
                ? "Nobody by that name yet."
                : plural(found.length, "person", "people")}
          </p>
          {searching ? (
            <Loadable loading skeleton={<PersonListSkeleton count={3} variant="card" />}>{null}</Loadable>
          ) : (
            found.length > 0 && <PeopleRow people={found} />
          )}
        </section>
      ) : null}

      <section>
        <h2 className="text-title" style={{ fontFamily: "var(--font-serif)" }}>
          By what they make
        </h2>
        <p className="mb-4 mt-1 text-small text-muted-foreground">
          Browse everyone, or narrow it down by hobby.
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
                  className={`rounded-control border px-3.5 py-1.5 text-caption font-medium transition-colors ${
                    on
                      ? "border-transparent text-on-brand [background-color:var(--coral-deep)]"
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
          loadingBrowse ? (
            <Loadable loading skeleton={<PersonListSkeleton count={6} variant="card" />}>{null}</Loadable>
          ) : browsed.length === 0 ? (
            <EmptyState
              line="Nobody’s joined yet."
              hint="Pick a hobby above once people are in it."
              action={{ label: "Log a Moment", to: "/create" }}
            />
          ) : (
            <PeopleRow people={browsed} />
          )
        ) : loadingHobby ? (
          <Loadable loading skeleton={<PersonListSkeleton count={6} variant="card" />}>{null}</Loadable>
        ) : inHobby.length === 0 ? (
          <EmptyState
            line={`Nobody’s turned up in ${hobbyLabel?.toLowerCase() ?? "this"} yet.`}
            hint="Share something there and you’ll be the first."
            action={{ label: "Log a Moment", to: `/create?hobby=${hobby}` }}
          />
        ) : (
          <PeopleRow people={inHobby} />
        )}
      </section>

      <div className="mt-12 rounded-card border border-border bg-card px-6 py-9 text-center">
        <Link to="/discover">
          <Button variant="outline">Browse Discover</Button>
        </Link>
      </div>
    </div>
  );
}

export function People() {
  return (
    <div className="min-h-viewport">
      <section className="relative overflow-hidden py-12 sm:py-12">
        <div className="absolute inset-0 [background-image:var(--gradient-brand-soft)]" />
        <div className="container mx-auto max-w-5xl px-4 relative">
          <h1 className="text-display" style={{ fontFamily: "var(--font-serif)" }}>
            People
          </h1>
          <p className="mb-6 mt-2 max-w-2xl text-lead text-foreground">
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
