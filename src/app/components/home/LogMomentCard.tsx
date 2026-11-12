import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { subHobbyLabel } from "../../data/hobbies";
import { formatMonth } from "../../lib/dates";
import { plural } from "../../lib/plural";
import { fetchLogProgress, REGULAR_DAYS, type CornerCard } from "../../lib/punchCards";
import { PunchHoles } from "../log/PunchCard";

/**
 * One tap to Log a Moment, between the suggestions and the feed. When a Corner
 * card is under way this month, the card shows it ("Pottery: 3 of 10 days in
 * November"), so logging feels like carrying on. It never promises a Stub: most
 * Moments earn none (20261101134307_stubs_four_kinds.sql).
 */
export function LogMomentCard() {
  const { user } = useAuth();
  const [card, setCard] = useState<CornerCard | null>(null);

  useEffect(() => {
    if (!user) return;
    let live = true;
    void fetchLogProgress().then((p) => {
      if (!live || !p) return;
      // The fullest card still open this month.
      const open = p.corners.filter((c) => !c.kept && c.days > 0 && c.days < REGULAR_DAYS);
      setCard(open.sort((a, b) => b.days - a.days)[0] ?? null);
    });
    return () => {
      live = false;
    };
  }, [user]);

  const slug = card?.key.split("/")[1] ?? "";
  const name = card ? (subHobbyLabel(slug) ?? slug) : "";

  return (
    <Link to="/create" className="flex min-h-11 flex-col gap-3 rounded-card p-4 text-foreground bg-surface-muted">
      <span className="flex items-center gap-3.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground" aria-hidden="true">
          <Plus className="size-[22px]" strokeWidth={2.25} />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-lead font-bold" style={{ fontFamily: "var(--font-display)" }}>
            Log a Moment
          </span>
          <span className="text-small text-muted-foreground">
            {card ? `${name}: ${card.days} of ${plural(REGULAR_DAYS, "day")} in ${formatMonth(Date.now())}` : "Did something today? Log it."}
          </span>
        </span>
      </span>
      {card && <PunchHoles size="sm" done={card.days} total={REGULAR_DAYS} />}
    </Link>
  );
}
