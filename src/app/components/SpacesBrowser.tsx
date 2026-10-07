import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Button } from "./ui/button";
import type { SpaceRow } from "../lib/spaces";
import { Loadable } from "./ui/skeleton";
import { SpaceGridSkeleton } from "./Skeletons";
import { EmptyState, ErrorNotice } from "./StateViews";
import { ImageWithFallback } from "./ImageWithFallback";

/** Discover's "Spaces" tab — host-created communities, Phase 5 of the
 * Spaces Rework. No member counts anywhere in this app's Spaces UI, same
 * rule as the Space page itself. */
export function SpacesBrowser({ query }: { query: string }) {
  const [spaces, setSpaces] = useState<SpaceRow[] | "loading" | "error">(supabase ? "loading" : []);
  const [attempt, setAttempt] = useState(0);
  const q = query.trim().toLowerCase();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) return;
      setSpaces((s) => (Array.isArray(s) ? s : "loading"));
      const { data, error } = await supabase
        .from("spaces")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(60);
      if (cancelled) return;
      if (error) {
        console.warn("[SpacesBrowser] load failed:", error);
        setSpaces("error");
        return;
      }
      setSpaces((data as SpaceRow[]) ?? []);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const list = Array.isArray(spaces) ? spaces : [];
  const matching = q
    ? list.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
    : list;

  return (
    <div className="mb-14">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="ns-section-kicker mb-2">Host-created communities</div>
          <h2 className="text-title" style={{ fontFamily: "var(--font-serif)" }}>Spaces</h2>
        </div>
        <Link to="/create-space">
          <Button variant="outline" size="sm">
            <Plus className="size-3.5" />
            Create a Space
          </Button>
        </Link>
      </div>

      <Loadable loading={spaces === "loading"} skeleton={<SpaceGridSkeleton count={10} />}>
      {spaces === "error" ? (
        <ErrorNotice onRetry={() => setAttempt((a) => a + 1)} />
      ) : matching.length === 0 ? (
        q ? (
          <EmptyState line="No Spaces match that." hint="Try a broader word." />
        ) : (
          <EmptyState
            line="No Spaces yet."
            hint="Be the first to start one."
            action={{ label: "Create a Space", to: "/create-space" }}
          />
        )
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {matching.map((s) => (
            <Link
              key={s.id}
              to={`/space/${s.slug}`}
              className="group flex flex-col overflow-hidden rounded-card border border-border bg-card transition-[transform,border-color,box-shadow] duration-base ease-standard hover:-translate-y-1 hover:border-[var(--coral-deep)] hover:shadow-card"
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface-muted">
                <ImageWithFallback src={s.cover_image} alt="" className="size-full" imgClassName="transition-transform duration-base ease-standard group-hover:scale-110" />
                <span className="absolute right-2 top-2 rounded-control bg-scrim-solid/60 px-2 py-0.5 text-caption text-on-media">
                  {s.access === "open" ? "Open" : "Closed"}
                </span>
              </div>
              <div className="p-3">
                <p className="truncate text-small font-medium" title={s.name}>{s.name}</p>
                <p className="mt-0.5 truncate text-caption text-muted-foreground" title={s.description}>{s.description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
      </Loadable>
    </div>
  );
}
