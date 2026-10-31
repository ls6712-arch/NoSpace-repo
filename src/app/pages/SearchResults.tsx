import { PageShell } from "../components/layout/PageShell";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowRight, Search } from "lucide-react";
import { useUnifiedSearch, type SearchHit } from "../lib/search";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Chip } from "../components/ui/Chip";
import { EmptyState } from "../components/StateViews";
import { Loadable } from "../components/ui/skeleton";
import { PersonListSkeleton } from "../components/Skeletons";
import { askSooshEnabled } from "../config";
import { askPlans, looksLikeAsk, understoodChips } from "../lib/askSoosh";
import { cornerGuide } from "../data/cornerGuides";
import { curatedFor, cornerMeta } from "../data/curatedCorners";
import { categoryOfCorner } from "../data/cornerCategories";
import { cornerColor } from "../lib/categoryStyle";
import { fetchOpenPursuits, type OpenPursuit } from "../lib/openPursuits";
import { formatDateTime } from "../lib/dates";
import { plural } from "../lib/plural";

const WEEK = 7 * 86400000;
type FilterId = "week" | "short" | "people";
const FILTERS: { id: FilterId; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "short", label: "Up to 2 hr" },
  { id: "people", label: "With people" },
];

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mb-6">
      <h2 id={id} className="mb-2 text-small font-semibold text-muted-foreground">
        {title}
      </h2>
      <ul className="grid gap-2 desk:grid-cols-2 desk:gap-3">{children}</ul>
    </section>
  );
}

const ROW = "flex min-h-14 items-center gap-3 rounded-card bg-card p-3";

/**
 * Search (screen 10): the field with Cancel, three filter chips, then Activity
 * (Corners, with how long and where, never a people count), Open Pursuits near
 * you, Spaces and People. A query that reads like a sentence gets an Ask Soosh
 * card on top when `askSooshEnabled` is on (off by default).
 */
export function SearchResults() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [filters, setFilters] = useState<Set<FilterId>>(new Set());
  const { groups, loading } = useUnifiedSearch(query);
  const [open, setOpen] = useState<OpenPursuit[]>([]);

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
    // Only the URL changing, never every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("q")]);

  const toggle = (id: FilterId) =>
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Activity: Corners that match, narrowed by the chips.
  const activity = useMemo(() => {
    return groups.corner
      .map((hit) => {
        const curated = hit.spaceSlug && hit.cornerSlug ? curatedFor(hit.spaceSlug, hit.cornerSlug) : undefined;
        const guide = hit.spaceSlug && hit.cornerSlug ? cornerGuide(hit.spaceSlug, hit.cornerSlug) : undefined;
        const group = hit.spaceSlug && hit.cornerSlug ? categoryOfCorner(hit.spaceSlug, hit.cornerSlug)?.name : undefined;
        return { hit, curated, guide, group };
      })
      .filter(({ curated, guide }) => {
        if (filters.has("short") && !(curated && curated.durationMinutes <= 120)) return false;
        if (filters.has("people") && !(guide && guide.together !== "solo")) return false;
        return true;
      })
      .slice(0, 6);
  }, [groups.corner, filters]);

  // Open Pursuits for the first two matching Corners.
  const topKey = groups.corner
    .slice(0, 2)
    .map((h) => `${h.spaceSlug}/${h.cornerSlug}`)
    .join("|");
  useEffect(() => {
    setOpen([]);
    const targets = groups.corner.slice(0, 2).filter((h) => h.spaceSlug && h.cornerSlug);
    if (targets.length === 0) return;
    let live = true;
    void Promise.all(targets.map((h) => fetchOpenPursuits(h.spaceSlug!, h.cornerSlug!, 4))).then((lists) => {
      if (live) setOpen(lists.flat());
    });
    return () => {
      live = false;
    };
    // groups.corner is derived from the query; topKey is its stable summary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topKey]);

  const shownOpen = open.filter((p) => !filters.has("week") || (p.session && p.session.startsAt - Date.now() < WEEK && p.session.startsAt > Date.now()));
  const q = query.trim();
  const ask = askSooshEnabled && looksLikeAsk(q);
  const nothing = activity.length === 0 && shownOpen.length === 0 && groups.space.length === 0 && groups.person.length === 0;

  const spaceRow = (hit: SearchHit) => (
    <li key={hit.key}>
      <Link to={hit.to} className={ROW}>
        <Avatar className="size-10 shrink-0">
          <AvatarFallback className="text-small">{initials(hit.label)}</AvatarFallback>
        </Avatar>
        <span className="min-w-0">
          <span className="block truncate text-body font-semibold">{hit.label}</span>
          {hit.sub && <span className="block truncate text-small text-muted-foreground">{hit.sub}</span>}
        </span>
      </Link>
    </li>
  );

  return (
    <PageShell title="Search">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const params = new URLSearchParams(searchParams);
          if (q) params.set("q", q);
          else params.delete("q");
          setSearchParams(params, { replace: true });
        }}
        className="mb-4 flex items-center gap-3"
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            autoFocus
            aria-label="Search Moments, people, Spaces"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Moments, people, Spaces"
            className="min-h-12 w-full rounded-full border border-border bg-card py-3 pl-11 pr-4 text-body text-foreground outline-none focus-visible:border-accent"
          />
        </div>
      </form>

      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filters">
        {FILTERS.map((f) => (
          <Chip key={f.id} selected={filters.has(f.id)} onClick={() => toggle(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>

      {!q ? (
        <p className="text-small text-muted-foreground">Type something to search.</p>
      ) : nothing && loading ? (
        <Loadable loading skeleton={<PersonListSkeleton count={4} variant="card" />}>{null}</Loadable>
      ) : (
        <>
          {ask && (
            <section aria-labelledby="ask-soosh" className="mb-6 rounded-card bg-accent p-4 text-accent-foreground">
              <h2 id="ask-soosh" className="text-body font-semibold">
                Ask Soosh
              </h2>
              {understoodChips(q).length > 0 && (
                <p className="mt-1 flex flex-wrap gap-2 text-small">
                  {understoodChips(q).map((c) => (
                    <span key={c} className="rounded-full bg-[var(--ink)] px-3 py-1 font-semibold text-[var(--photo-text)]">
                      {c}
                    </span>
                  ))}
                </p>
              )}
              <ol className="mt-3 flex flex-col gap-2">
                {askPlans(
                  activity.map(({ hit, curated }) => ({ name: hit.label, line: curated ? cornerMeta(curated) : "", to: hit.to })),
                ).map((p) => (
                  <li key={p.to}>
                    <Link to={p.to} className="flex min-h-12 items-center justify-between gap-3 rounded-control bg-[var(--ink)] px-4 py-2 text-[var(--photo-text)]">
                      <span className="min-w-0">
                        <span className="block truncate text-body font-semibold">{p.title}</span>
                        {p.line && <span className="block truncate text-small opacity-80">{p.line}</span>}
                      </span>
                      <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {nothing ? (
            <EmptyState line={`Nothing matches “${q.slice(0, 60)}” yet.`} hint="Try a broader word." action={{ label: "Go to Discover", to: "/discover" }} />
          ) : (
            <>
              {activity.length > 0 && (
                <Section id="search-activity" title="Activity">
                  {activity.map(({ hit, curated, group }) => (
                    <li key={hit.key}>
                      <Link to={hit.to} className={ROW}>
                        <span
                          className="size-12 shrink-0 rounded-control"
                          style={{ background: hit.spaceSlug && hit.cornerSlug ? `var(--cat-${cornerColor(hit.spaceSlug, hit.cornerSlug)})` : "var(--card)" }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-body font-semibold">{hit.label}</span>
                          <span className="block truncate text-small text-muted-foreground">
                            {[group, curated ? cornerMeta(curated).split(" · ")[0] : undefined].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </Section>
              )}

              {shownOpen.length > 0 && (
                <Section id="search-open" title="Open Pursuits near you">
                  {shownOpen.map((p) => (
                    <li key={p.pursuitId}>
                      <Link to={`/pursuit/${p.pursuitId}`} className={`${ROW} justify-between`}>
                        <span className="min-w-0">
                          <span className="block truncate text-body font-semibold">{p.title.slice(0, 80)}</span>
                          <span className="block line-clamp-2 text-small text-muted-foreground">
                            {[p.session?.place, p.session ? formatDateTime(p.session.startsAt) : undefined, plural(Math.max(0, p.capacity - p.taken), "spot")]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <ArrowRight className="size-4 shrink-0 text-accent-text" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </Section>
              )}

              {groups.space.length > 0 && <Section id="search-spaces" title="Spaces">{groups.space.slice(0, 5).map(spaceRow)}</Section>}

              {groups.person.length > 0 && (
                <Section id="search-people" title="People">
                  {groups.person.slice(0, 6).map((hit) => (
                    <li key={hit.key}>
                      <Link to={hit.to} className={ROW}>
                        <Avatar className="size-10 shrink-0">
                          {hit.avatarUrl && <AvatarImage src={hit.avatarUrl} alt="" className="object-cover" />}
                          <AvatarFallback className="text-small">{initials(hit.label)}</AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 truncate text-body font-semibold">{hit.label}</span>
                      </Link>
                    </li>
                  ))}
                </Section>
              )}
            </>
          )}
        </>
      )}
    </PageShell>
  );
}
