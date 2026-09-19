import { Link } from "react-router";
import { useCircles } from "../context/CirclesContext";

/**
 * Right rail, item 3 (docs/my-space-spec.md section 4.3). No STEADY/BUSY
 * chips — the spec text explicitly drops those even though the mockup
 * shows them. Name and member count only.
 *
 * "Joined and followed Circles": only joined exists today
 * (useCircles().myRealCircleIds) — there's no separate "follow a Circle
 * without joining" concept anywhere in this codebase, so this shows joined
 * Circles only.
 */
export function CirclesRail() {
  const { circles, myRealCircleIds } = useCircles();
  const joined = circles.filter((c) => myRealCircleIds.includes(c.id));

  return (
    <section>
      <h2 className="text-lg" style={{ fontFamily: "var(--font-serif)" }}>
        Circles
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Small rooms, quieter than the feed.</p>

      {joined.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          You haven't joined a Circle yet.
        </p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {joined.map((c) => (
            <li key={c.id}>
              <Link to={`/circles/${c.id}`} className="flex min-w-0 items-baseline gap-2 hover:text-accent">
                <span className="truncate text-sm" style={{ fontFamily: "var(--font-serif)" }}>
                  {c.name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  · {c.memberCount} members
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
