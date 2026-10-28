import { useEffect, useState } from "react";
import { Link } from "react-router";
import { fetchOpenPursuits, type OpenPursuit } from "../../lib/openPursuits";
import { formatDateTime } from "../../lib/dates";
import { plural } from "../../lib/plural";

/**
 * Open groups run by this Space's hosts, for the Space's Corner. The one with the
 * most room has the accent border and a spots badge. Hidden when there are none.
 */
export function SpaceOpenPursuits({ spaceSlug, cornerSlug, hostIds }: { spaceSlug?: string; cornerSlug?: string; hostIds: readonly string[] }) {
  const [items, setItems] = useState<OpenPursuit[]>([]);
  const hostKey = hostIds.join(",");
  useEffect(() => {
    if (!spaceSlug || !cornerSlug || hostIds.length === 0) return;
    let live = true;
    void fetchOpenPursuits(spaceSlug, cornerSlug, 10).then((all) => {
      if (live) setItems(all.filter((p) => hostIds.includes(p.ownerId)));
    });
    return () => {
      live = false;
    };
    // hostIds is derived from hostKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceSlug, cornerSlug, hostKey]);

  if (items.length === 0) return null;
  const roomLeft = (p: OpenPursuit) => Math.max(0, p.capacity - p.taken);
  const best = items.reduce((a, b) => (roomLeft(b) > roomLeft(a) ? b : a), items[0]);
  return (
    <section aria-labelledby="space-open-pursuits" className="mt-6">
      <h2 id="space-open-pursuits" className="mb-3 text-lead font-semibold">
        Open Pursuits
      </h2>
      <ul className="flex flex-col gap-3">
        {items.map((p) => {
          const left = roomLeft(p);
          const isBest = p.pursuitId === best.pursuitId;
          return (
            <li key={p.pursuitId}>
              <Link
                to={`/pursuit/${p.pursuitId}`}
                className={`block rounded-card bg-card p-4 ${isBest ? "border border-accent" : ""}`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 text-body font-semibold">{p.title.slice(0, 80)}</span>
                  {left > 0 && (
                    <span className="shrink-0 rounded-full bg-[var(--gold,var(--accent))] px-2.5 py-0.5 text-caption font-semibold text-[var(--ink)]">
                      {plural(left, "spot")}
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-small text-muted-foreground">
                  {[p.session ? formatDateTime(p.session.startsAt) : undefined, p.session?.place].filter(Boolean).join(" · ") || "Open to join"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
