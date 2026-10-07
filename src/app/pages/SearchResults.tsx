import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  Search,
  Sparkle,
  Compass,
  UserRound,
  PenLine,
  MessagesSquare,
  Package,
  type LucideIcon,
} from "lucide-react";
import { useUnifiedSearch, SEARCH_GROUP_ORDER, type SearchGroup } from "../lib/search";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { APP_NAME } from "../config";
import { EmptyState } from "../components/StateViews";
import { Loadable } from "../components/ui/skeleton";
import { PersonListSkeleton } from "../components/Skeletons";

const GROUP_ICON: Record<SearchGroup, LucideIcon> = {
  space: Compass,
  corner: Sparkle,
  person: UserRound,
  pursuit: PenLine,
  moment: MessagesSquare,
  product: Package,
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * The one results page both search boxes (Discover's and the global nav's)
 * send a submitted query to, grouped by type rather than one flat list —
 * and, unlike either search box before this, actually covers Spaces,
 * Corners, People, Pursuits, and Moments, with Products always last rather
 * than first (see lib/search.ts for why the old nav search effectively
 * only ever surfaced products for anything but an exact Space or creator
 * name).
 */
export function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const { groups, all, loading } = useUnifiedSearch(query);

  // Landing here again with a different ?q= (e.g. a fresh nav-search submit
  // while this page is already mounted) should update the box, not leave it
  // showing the previous search.
  useEffect(() => {
    const fromUrl = searchParams.get("q") ?? "";
    setQuery(fromUrl);
    // Only ever react to the URL changing, not to every local keystroke —
    // this effect must not fight the input while someone's typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("q")]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (query.trim()) params.set("q", query.trim());
    else params.delete("q");
    setSearchParams(params, { replace: true });
  }

  const q = query.trim();

  return (
    <div className="min-h-viewport bg-surface">
      <div className="container mx-auto max-w-4xl px-4 py-10">
        <div className="ns-section-kicker mb-3">Search</div>
        <h1 className="mb-6 text-display" style={{ fontFamily: "var(--font-serif)" }}>
          {q ? `Results for “${q}”` : `Search ${APP_NAME}`}
        </h1>

        <form onSubmit={onSubmit} className="relative mb-8 max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Moments, people, Spaces"
            className="w-full rounded-control border border-border bg-input-background py-3 pl-11 pr-4 text-body text-foreground outline-none focus-visible:border-[var(--violet-electric)]"
          />
        </form>

        {!q ? (
          <p className="text-small text-muted-foreground">Type something above to search.</p>
        ) : all.length === 0 && loading ? (
          <Loadable loading skeleton={<PersonListSkeleton count={4} variant="card" />}>{null}</Loadable>
        ) : all.length === 0 ? (
          <EmptyState
            line={`Nothing matches “${q}” yet.`}
            hint="Try a broader word."
            action={{ label: "Go to Discover", to: "/discover" }}
          />
        ) : (
          <div className="space-y-12">
            {SEARCH_GROUP_ORDER.map(({ group, title }) => {
              const hits = groups[group];
              if (hits.length === 0) return null;
              const Icon = GROUP_ICON[group];
              return (
                <section key={group}>
                  <h2 className="mb-3 flex items-center gap-2 text-small font-medium text-muted-foreground">
                    <Icon className="size-4" />
                    {title}
                    <span className="text-caption text-muted-foreground/70">({hits.length})</span>
                  </h2>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {hits.slice(0, 12).map((hit) => (
                      <li key={hit.key} className="min-w-0">
                        <Link
                          to={hit.to}
                          className="flex items-center gap-3 rounded-card border border-border bg-card px-4 py-3 transition-colors hover:border-[var(--violet-electric)]"
                        >
                          {hit.group === "person" ? (
                            <Avatar className="size-8 shrink-0">
                              {hit.avatarUrl && <AvatarImage src={hit.avatarUrl} alt="" className="object-cover" />}
                              <AvatarFallback className="text-caption">{initials(hit.label)}</AvatarFallback>
                            </Avatar>
                          ) : (
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                              <Icon className="size-3.5 text-muted-foreground" />
                            </span>
                          )}
                          <span className="min-w-0">
                            <span className="block truncate text-small" title={hit.label}>{hit.label}</span>
                            {hit.sub && (
                              <span className="block truncate text-caption text-muted-foreground" title={hit.sub}>{hit.sub}</span>
                            )}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
