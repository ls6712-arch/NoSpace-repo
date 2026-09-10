import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  Search,
  Sparkle,
  Compass,
  Users,
  UserRound,
  PenLine,
  MessagesSquare,
  Package,
  type LucideIcon,
} from "lucide-react";
import { useUnifiedSearch, SEARCH_GROUP_ORDER, type SearchGroup } from "../lib/search";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";

const GROUP_ICON: Record<SearchGroup, LucideIcon> = {
  space: Compass,
  corner: Sparkle,
  circle: Users,
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
 * Corners, Circles, People, Pursuits, and Moments, with Products always
 * last rather than first (see lib/search.ts for why the old nav search
 * effectively only ever surfaced products for anything but an exact Space
 * or creator name).
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
    <div className="min-h-screen bg-surface">
      <div className="container mx-auto max-w-4xl px-4 py-10">
        <div className="ns-section-kicker mb-3">SEARCH</div>
        <h1 className="mb-6 text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
          {q ? `Results for "${q}"` : "Search NoSpace"}
        </h1>

        <form onSubmit={onSubmit} className="relative mb-8 max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Spaces, Corners, Circles, people, Pursuits, Moments…"
            className="w-full rounded-full border border-border bg-input-background py-3 pl-11 pr-4 text-sm text-foreground outline-none focus-visible:border-[var(--violet-electric)]"
          />
        </form>

        {!q ? (
          <p className="text-sm text-muted-foreground">Type something above to search.</p>
        ) : all.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {loading ? "Searching…" : `Nothing matches "${q}" yet.`}
          </p>
        ) : (
          <div className="space-y-10">
            {SEARCH_GROUP_ORDER.map(({ group, title }) => {
              const hits = groups[group];
              if (hits.length === 0) return null;
              const Icon = GROUP_ICON[group];
              return (
                <section key={group}>
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Icon className="size-4" />
                    {title}
                    <span className="text-xs text-muted-foreground/70">({hits.length})</span>
                  </h2>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {hits.slice(0, 12).map((hit) => (
                      <li key={hit.key}>
                        <Link
                          to={hit.to}
                          className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:border-[var(--violet-electric)]"
                        >
                          {hit.group === "person" ? (
                            <Avatar className="size-8 shrink-0">
                              {hit.avatarUrl && <AvatarImage src={hit.avatarUrl} alt="" className="object-cover" />}
                              <AvatarFallback className="text-[10px]">{initials(hit.label)}</AvatarFallback>
                            </Avatar>
                          ) : (
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                              <Icon className="size-3.5 text-muted-foreground" />
                            </span>
                          )}
                          <span className="min-w-0">
                            <span className="block truncate text-sm">{hit.label}</span>
                            {hit.sub && (
                              <span className="block truncate text-xs text-muted-foreground">{hit.sub}</span>
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
