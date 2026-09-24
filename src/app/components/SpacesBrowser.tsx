import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Button } from "./ui/button";
import type { SpaceRow } from "../lib/spaces";

/** Discover's "Spaces" tab — host-created communities, Phase 5 of the
 * Spaces Rework. No member counts anywhere in this app's Spaces UI, same
 * rule as the Space page itself. */
export function SpacesBrowser({ query }: { query: string }) {
  const [spaces, setSpaces] = useState<SpaceRow[] | "loading">("loading");
  const q = query.trim().toLowerCase();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) return;
      const { data } = await supabase
        .from("spaces")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(60);
      if (!cancelled) setSpaces((data as SpaceRow[]) ?? []);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (spaces === "loading") return <div className="mb-14 min-h-[30vh]" />;

  const matching = q
    ? spaces.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
    : spaces;

  return (
    <div className="mb-14">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="ns-section-kicker mb-2">HOST-CREATED COMMUNITIES</div>
          <h2 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>Spaces</h2>
        </div>
        <Link to="/create-space">
          <Button variant="outline" size="sm">
            <Plus className="size-3.5" />
            Create a Space
          </Button>
        </Link>
      </div>

      {matching.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
          {q ? "No Spaces match that. Try a broader word." : "No Spaces yet — be the first to start one."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {matching.map((s) => (
            <Link
              key={s.id}
              to={`/space/${s.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-[var(--coral-deep)] hover:shadow-md"
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface-muted">
                <img
                  src={s.cover_image}
                  alt=""
                  className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                />
                <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                  {s.access === "open" ? "Open" : "Closed"}
                </span>
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium">{s.name}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
