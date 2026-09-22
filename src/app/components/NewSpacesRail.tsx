import { Link } from "react-router";
import { getHobby } from "../data/hobbies";
import { useCorners } from "../context/CornersContext";

const DAY = 86_400_000;

/** "opened Wednesday" for anything this past week, "opened last week" just
 * past that, then a plain week count — matches the mockup's own phrasing
 * rather than a generic "3d ago" (already used elsewhere for Moments,
 * deliberately not reused here: those read as activity, this is an
 * announcement, and "opened 3d ago" reads oddly for a Corner). */
function openedLabel(createdAt: number): string {
  const days = Math.floor((Date.now() - createdAt) / DAY);
  if (days < 1) return "opened today";
  if (days < 7) return `opened ${new Date(createdAt).toLocaleDateString(undefined, { weekday: "long" })}`;
  if (days < 14) return "opened last week";
  return `opened ${Math.floor(days / 7)} weeks ago`;
}

/**
 * Right rail, item 4 (docs/my-space-spec.md section 4). Platform-wide, not
 * personalized — the newest real Corners across every Space, regardless of
 * whether the viewer follows that Space or anyone in it. Reuses the same
 * coral-left-bar list-row shape ShelfRail already established for "Winter
 * cups"-style rows, rather than a new card style.
 */
export function NewSpacesRail() {
  const { newestCorners } = useCorners();
  const corners = newestCorners(3);

  return (
    <section>
      <h2 className="text-lg" style={{ fontFamily: "var(--font-serif)" }}>
        Freshly opened this week
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Real Spaces the community just started. Not personalized, not ranked, just new.
      </p>

      {corners.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing new to show yet.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {corners.map((c) => {
            const space = getHobby(c.spaceSlug);
            return (
              <li key={`${c.spaceSlug}-${c.slug}`}>
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="h-8 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: "var(--coral-deep)" }}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm" style={{ fontFamily: "var(--font-serif)" }}>
                      {c.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      Inside {space?.shortName ?? c.spaceSlug}
                      {c.createdAt != null ? ` · ${openedLabel(c.createdAt)}` : ""}
                    </span>
                  </div>
                  <Link
                    to={`/corner/${c.slug}`}
                    className="shrink-0 text-xs text-accent hover:underline"
                  >
                    Visit
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
