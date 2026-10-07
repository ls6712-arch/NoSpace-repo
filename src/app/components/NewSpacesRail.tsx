import { useEffect, useState } from "react";
import { Link } from "react-router";
import { supabase } from "../../lib/supabase";
import { formatWeekday } from "../lib/dates";
import { freshSpaces } from "../lib/freshSpaces";
import type { SpaceRow } from "../lib/spaces";
import { EmptyState } from "./StateViews";

const DAY = 86_400_000;

/** "opened today", or "opened Wednesday" — the rail only ever lists the past
 * 7 days (see freshSpaces). */
function openedLabel(createdAt: number): string {
  const days = Math.floor((Date.now() - createdAt) / DAY);
  if (days < 1) return "opened today";
  return `opened ${formatWeekday(createdAt, "long")}`;
}

/**
 * Right rail, item 4 (docs/my-space-spec.md section 4). Platform-wide, not
 * personalized: the newest Spaces (host-created, same `spaces` table as
 * Discover's Spaces tab) opened in the last 7 days. Corners are never
 * listed here.
 */
export function NewSpacesRail() {
  const [spaces, setSpaces] = useState<SpaceRow[]>([]);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    const since = new Date(Date.now() - 7 * DAY).toISOString();
    supabase
      .from("spaces")
      .select("*")
      .eq("status", "active")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("[NewSpacesRail] load failed:", error);
          return;
        }
        setSpaces(freshSpaces((data as SpaceRow[]) ?? [], Date.now(), 3));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <h2 className="text-lead" style={{ fontFamily: "var(--font-serif)" }}>
        Freshly opened this week
      </h2>
      <p className="mt-0.5 text-caption text-muted-foreground">
        Spaces opened in the last 7 days.
      </p>

      {spaces.length === 0 ? (
        <EmptyState size="rail" line="Nothing new to show yet." action={{ label: "Browse Spaces", to: "/discover?tab=spaces" }} />
      ) : (
        <ul className="mt-3 space-y-2.5">
          {spaces.map((s) => (
            <li key={s.id}>
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="h-8 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: "var(--coral-deep)" }}
                />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-small" style={{ fontFamily: "var(--font-serif)" }} title={s.name}>
                    {s.name}
                  </span>
                  <span className="block truncate text-caption text-muted-foreground">
                    {openedLabel(new Date(s.created_at).getTime())}
                  </span>
                </div>
                <Link to={`/space/${s.slug}`} className="shrink-0 text-caption text-accent hover:underline">
                  Visit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
