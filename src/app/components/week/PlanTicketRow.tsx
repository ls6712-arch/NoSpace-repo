import { Link } from "react-router";
import { catStyle } from "../../lib/categoryStyle";
import { WEEK_VIEW } from "../../lib/homeCopy";
import type { Pass } from "../../lib/tasteModel";
import { goingLine, isJustYou, kindLine, placeLine, ticketTime, type WeekPlanDetail } from "../../lib/weekView";
import { AvatarStack } from "../ui/AvatarStack";

/**
 * A plan as a ticket row: the start time on a block in the Corner's colour, a
 * dashed perforation, then the kind line, title, place and price, and who is
 * going. A plan with only you in it offers "Bring someone". The price is the
 * host's own words and is left out when unknown (never "$0"); a pass is named.
 */
export function PlanTicketRow({
  plan,
  passes,
  canBring,
  onBring,
}: {
  plan: WeekPlanDetail;
  passes: readonly Pass[];
  canBring: boolean;
  onBring: (plan: WeekPlanDetail) => void;
}) {
  const time = ticketTime(plan.startsAt);
  const kind = kindLine(plan);
  const where = placeLine(plan, passes);
  const line = goingLine(plan.going);
  const title = (
    <span className="text-lead font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
      {plan.title}
    </span>
  );
  return (
    <li className="relative flex overflow-hidden rounded-card border border-border bg-card">
      <div
        style={catStyle(plan.color)}
        className="flex w-[72px] shrink-0 flex-col items-center justify-center bg-[var(--cat)] text-[var(--ink)]"
      >
        <span className="text-title font-extrabold leading-none" style={{ fontFamily: "var(--font-display)" }}>
          {time.top}
        </span>
        <span className="text-caption font-semibold">{time.bottom}</span>
      </div>
      <span aria-hidden="true" className="absolute inset-y-3 left-[72px] border-l-2 border-dashed border-border" />
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3 pl-4">
        {kind && <span className="text-caption font-semibold text-muted-foreground">{kind}</span>}
        {plan.pursuitId ? (
          <Link to={`/pursuit/${plan.pursuitId}`} className="text-foreground">
            {title}
          </Link>
        ) : (
          title
        )}
        {where && <span className="text-small text-muted-foreground">{where}</span>}
        {line ? (
          <span className="mt-1 flex items-center gap-2">
            <AvatarStack people={plan.going.friends.map((f) => ({ name: f.name, avatarUrl: f.avatarUrl }))} total={plan.going.friends.length} size="size-6" />
            <span className="min-w-0 text-small">{line}</span>
          </span>
        ) : (
          isJustYou(plan.going) &&
          canBring && (
            <button
              type="button"
              onClick={() => onBring(plan)}
              className="-mb-1 inline-flex min-h-11 items-center self-start text-small font-semibold text-accent-text underline-offset-4 hover:underline"
            >
              {WEEK_VIEW.bringSomeone}
            </button>
          )
        )}
      </div>
    </li>
  );
}
