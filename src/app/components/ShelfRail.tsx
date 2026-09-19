import { Link } from "react-router";
import { useSessionsByHobby, archiveKey } from "./HobbyShelf";

/** Cycled per spine — the same dark-tuned illustration palette GeneratedArt
 * uses (theme.css's --gen-art-*), not new raw hex. */
const SPINE_COLORS = [
  "var(--gen-art-terracotta)",
  "var(--gen-art-olive)",
  "var(--gen-art-denim)",
  "var(--gen-art-mustard)",
  "var(--gen-art-blush)",
];

/**
 * Right rail, item 1 (docs/my-space-spec.md section 4.1). Reuses
 * useSessionsByHobby() — this app's existing "Shelf" concept (HobbyShelf.tsx
 * already calls each one a "book") — rather than inventing a new grouping.
 * One list, not spines-plus-a-separate-list: each row already carries its
 * own color swatch and a visible (not hover-only) label, so there's nothing
 * left to duplicate.
 */
export function ShelfRail() {
  const sessions = useSessionsByHobby().slice(0, 5);
  const max = Math.max(1, ...sessions.map((s) => s.sessions));

  return (
    <section>
      <h2 className="text-lg" style={{ fontFamily: "var(--font-serif)" }}>
        The Shelf
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Where bodies of work get bound.</p>

      {sessions.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing on the Shelf yet. Log a Moment to start one.
        </p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {sessions.map((s, i) => (
            <li key={s.key}>
              <Link
                to={`/you/work/${archiveKey(s)}`}
                className="flex items-center gap-3 hover:text-accent"
              >
                <span
                  aria-hidden="true"
                  className="w-1.5 shrink-0 rounded-full"
                  style={{
                    height: `${Math.max(16, (s.sessions / max) * 32)}px`,
                    backgroundColor: SPINE_COLORS[i % SPINE_COLORS.length],
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm" style={{ fontFamily: "var(--font-serif)" }}>
                    {s.label}
                  </span>
                </span>
                <span className="ns-section-kicker shrink-0 text-muted-foreground">
                  {s.sessions} {s.sessions === 1 ? "MOMENT" : "MOMENTS"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
