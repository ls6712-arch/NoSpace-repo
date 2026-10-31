import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { fetchMoments, type OwnerMoment, type SharedMoment } from "../../lib/profileApi";
import { momentAlt, momentTitle, ownerMomentMeta, sharedMomentMeta, visibleAtLabel } from "../../lib/profileFormat";
import { plural } from "../../lib/plural";
import { Button } from "../ui/button";
import { ImageWithFallback } from "../ImageWithFallback";
import { ErrorNotice } from "../StateViews";
import { GridSkeleton } from "./Skeletons";

const FIRST = 6;
const PAGE = 30;
const GRID = "grid grid-cols-2 gap-3 min-[360px]:grid-cols-3";

type Moment = OwnerMoment | SharedMoment;
const isOwner = (m: Moment): m is OwnerMoment => "occurredAt" in m;

function Tile({ m }: { m: Moment }) {
  return (
    <li>
      <Link to={`/moment/${m.id}`} className="block rounded-control focus-visible:ring-[3px] focus-visible:outline-1">
        <ImageWithFallback src={m.photoUrl} alt={momentAlt(m)} aspect="1 / 1" width={240} className="w-full rounded-control" />
        <p className="mt-1 truncate text-small font-semibold">{momentTitle(m)}</p>
        <p className="truncate text-caption text-muted-foreground">{isOwner(m) ? ownerMomentMeta(m) : sharedMomentMeta(m)}</p>
        {isOwner(m) && m.visibleAt && <p className="text-caption text-muted-foreground">{visibleAtLabel(m.visibleAt)}</p>}
      </Link>
    </li>
  );
}

/** A new owner's first screen: a Log a Moment tile, five dashed places, one line. */
function NewOwnerGrid() {
  return (
    <div>
      <ul className={GRID}>
        <li>
          <Link
            to="/create"
            className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-control border border-border bg-card text-small font-semibold text-foreground focus-visible:ring-[3px] focus-visible:outline-1"
          >
            <Plus className="size-5" aria-hidden="true" />
            Log a Moment
          </Link>
        </li>
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i} aria-hidden="true" className="aspect-square w-full rounded-control border-2 border-dashed border-border" />
        ))}
      </ul>
      <p className="mt-3 text-small text-muted-foreground">Your Moments show up here.</p>
    </div>
  );
}

export function MomentsPane({ profileId, owner }: { profileId: string; owner: boolean }) {
  const [items, setItems] = useState<Moment[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [more, setMore] = useState<"idle" | "loading" | "error">("idle");
  const [all, setAll] = useState(false);
  const run = useRef(0);

  const load = useCallback(
    async (offset: number) => {
      const mine = run.current;
      const r = await fetchMoments(profileId, PAGE, offset);
      if (mine !== run.current) return false;
      if (!r.ok) return false;
      setTotal(r.value.total);
      setItems((prev) => (offset === 0 ? r.value.items : [...prev, ...r.value.items]));
      return true;
    },
    [profileId],
  );

  const first = useCallback(async () => {
    setStatus("loading");
    const ok = await load(0);
    setStatus(ok ? "ready" : "error");
  }, [load]);

  useEffect(() => {
    run.current++;
    setItems([]);
    setAll(false);
    void first();
  }, [first]);

  const showMore = async () => {
    setMore("loading");
    const ok = await load(items.length);
    setMore(ok ? "idle" : "error");
  };

  if (status === "loading") return <GridSkeleton />;
  if (status === "error") return <ErrorNotice onRetry={first} />;
  if (total === 0) {
    return owner ? <NewOwnerGrid /> : <p className="py-6 text-small text-muted-foreground">No Moments yet</p>;
  }

  const shown = all ? items : items.slice(0, FIRST);
  return (
    <div>
      <ul className={GRID}>
        {shown.map((m) => (
          <Tile key={m.id} m={m} />
        ))}
      </ul>
      {!all && total > FIRST && (
        <Button variant="outline" className="mt-4 min-h-11 w-full" onClick={() => setAll(true)}>
          See all {plural(total, "Moment")}
        </Button>
      )}
      {all && items.length < total && (
        <div className="mt-4">
          {more === "error" && <ErrorNotice onRetry={showMore} />}
          <Button variant="outline" className="min-h-11 w-full" disabled={more === "loading"} onClick={showMore}>
            Show more
          </Button>
        </div>
      )}
    </div>
  );
}
