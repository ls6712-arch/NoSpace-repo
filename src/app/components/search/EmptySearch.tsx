import { useEffect, useState } from "react";
import { Link } from "react-router";
import { fetchBusyCorners, type BusyCorner } from "../../lib/busyCorners";
import { cornerPath } from "../../lib/cornerPath";
import { cornerName, visitorCorners } from "../../lib/discoverCorners";
import { useInterests } from "../../lib/interests";
import { plural } from "../../lib/plural";
import { HorizontalRow } from "../HorizontalRow";
import { SuggestionPhoto } from "../home/SuggestionPhoto";

/** Approved Oct 31, 2026 (docs/glossary.md, Search). */
export const BUSY_HEADING = "Busy this week";

const split = (key: string) => {
  const [spaceSlug, slug] = key.split("/");
  return { spaceSlug, slug };
};

/**
 * What /search shows before anything is typed: the Corners with the most events in the next 7 days, then a row of up
 * to six Corners. A section with nothing in it is left out (no city, nothing on, or the call failed), and neither
 * ever says "Be the first". With both empty the page shows its one plain line instead.
 */
export function EmptySearch({ onEmpty }: { onEmpty?: (empty: boolean) => void }) {
  const { city } = useInterests();
  const [busy, setBusy] = useState<BusyCorner[]>([]);
  const corners = visitorCorners(6);

  useEffect(() => {
    let live = true;
    void fetchBusyCorners(city).then((rows) => live && setBusy(rows));
    return () => {
      live = false;
    };
  }, [city]);

  const empty = busy.length === 0 && corners.length === 0;
  useEffect(() => onEmpty?.(empty), [empty, onEmpty]);

  return (
    <div className="flex flex-col gap-8">
      {busy.length > 0 && (
        <section aria-labelledby="search-busy">
          <h2 id="search-busy" className="mb-3 text-lead">
            {BUSY_HEADING}
          </h2>
          <ul className="grid gap-2 desk:grid-cols-2 desk:gap-3">
            {busy.map((b) => {
              const c = split(b.key);
              return (
                <li key={b.key}>
                  <Link to={cornerPath(c.spaceSlug, c.slug)} className="flex min-h-14 items-center gap-3 rounded-card border border-border bg-card p-3">
                    <SuggestionPhoto corner={c} className="size-12 shrink-0 rounded-control" width={48} />
                    <span className="min-w-0">
                      <span className="block truncate text-body font-semibold">{cornerName(c.slug)}</span>
                      <span className="block truncate text-small text-muted-foreground">{plural(b.events, "event")}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {corners.length > 0 && (
        <section aria-labelledby="search-corners">
          <h2 id="search-corners" className="mb-3 text-lead">
            Corners
          </h2>
          <HorizontalRow name="search.corners" label="Corners" contentKey={corners.join("|")}>
            {corners.map((key) => {
              const c = split(key);
              return (
                <li key={key} className="w-[180px] shrink-0 snap-start">
                  <Link to={cornerPath(c.spaceSlug, c.slug)} className="block overflow-hidden rounded-card border border-border bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <SuggestionPhoto corner={c} className="aspect-[4/3] w-full" width={180} />
                    <span className="block truncate p-3 text-body font-semibold">{cornerName(c.slug)}</span>
                  </Link>
                </li>
              );
            })}
          </HorizontalRow>
        </section>
      )}
    </div>
  );
}
