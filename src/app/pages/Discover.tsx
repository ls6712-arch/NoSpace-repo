import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Search, X } from "lucide-react";
import { hobbies } from "../data/hobbies";
import { useContent } from "../context/ContentContext";
import { HobbyTile } from "../components/HobbyTile";

/**
 * The whole world of NoSpace on one page — every hobby in every space, as a
 * picture. This is the browse-and-find-something-to-try view: the 8 spaces are
 * shelves, and this is everything sitting on them. Each tile links into its
 * space with that hobby's filter already applied.
 */
export function Discover() {
  const { posts } = useContent();
  const [query, setQuery] = useState("");

  const postCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of posts) {
      if (p.visibility !== "public" || !p.subHobby) continue;
      counts[p.subHobby] = (counts[p.subHobby] ?? 0) + 1;
    }
    return counts;
  }, [posts]);

  const q = query.trim().toLowerCase();
  const sections = hobbies
    .map((h) => ({
      hobby: h,
      items: q
        ? h.subItems.filter(
            (s) =>
              s.label.toLowerCase().includes(q) ||
              h.shortName.toLowerCase().includes(q) ||
              h.plainLabel.toLowerCase().includes(q),
          )
        : h.subItems,
    }))
    .filter((s) => s.items.length > 0);

  const totalShown = sections.reduce((n, s) => n + s.items.length, 0);
  const totalAll = hobbies.reduce((n, h) => n + h.subItems.length, 0);

  return (
    <div className="min-h-screen">
      <section className="relative py-14 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-amber-500 opacity-[0.10]" />
        <div className="container mx-auto px-4 relative">
          <h1 className="text-4xl md:text-5xl mb-3">Discover</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mb-6">
            Every hobby on NoSpace — {totalAll} of them, across {hobbies.length}{" "}
            spaces. Find the one you've been meaning to start.
          </p>

          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search hobbies — pottery, chess, sourdough..."
              className="w-full rounded-full border border-border bg-surface-muted py-2.5 pl-10 pr-10 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
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
          {q && (
            <p className="text-sm text-muted-foreground mt-3">
              {totalShown} {totalShown === 1 ? "hobby" : "hobbies"} match "{query}"
            </p>
          )}
        </div>
      </section>

      <section className="container mx-auto px-4 pb-24 space-y-12">
        {sections.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            Nothing matches "{query}" yet — try a broader word.
          </div>
        )}

        {sections.map(({ hobby, items }) => (
          <div key={hobby.slug}>
            <div className="flex items-end justify-between gap-4 mb-4 flex-wrap">
              <div>
                <Link to={`/space/${hobby.slug}`} className="group">
                  <h2 className="text-2xl group-hover:text-[var(--coral-text)] transition-colors">
                    {hobby.name}
                  </h2>
                </Link>
                <p className="text-sm text-muted-foreground">{hobby.plainLabel}</p>
              </div>
              <Link
                to={`/space/${hobby.slug}`}
                className="text-xs text-[var(--coral-text)] hover:underline"
              >
                Open space →
              </Link>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {items.map((s) => (
                <HobbyTile
                  key={s.slug}
                  hobbySlug={hobby.slug}
                  subSlug={s.slug}
                  label={s.label}
                  count={postCounts[s.slug]}
                  to={`/space/${hobby.slug}?hobby=${s.slug}`}
                />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
