import { Ticket } from "lucide-react";
import { Link } from "react-router";
import { catStyle } from "../../lib/categoryStyle";
import { describeFree, describePlan, describeStub, planHref, shortTime, stubColor } from "../../lib/calendarView";
import type { StubCard } from "../../lib/stubs";
import { FREE_LABEL, type FreeSlot, type WeekPlanDetail } from "../../lib/weekView";
import { cn } from "../ui/utils";

/**
 * The calendar's small shapes, the same in every view (brief §3):
 *  - a plan, a Pursuit session or a Stub: the Corner's colour with ink text, a Stub with the ticket icon;
 *  - free time: no fill, a dashed border at 28% ink and a muted label.
 * The look is never the only signal: each carries its words.
 */
const CHIP = "flex min-h-6 w-full min-w-0 items-center gap-1 rounded-control px-2 py-0.5 text-left text-caption font-semibold leading-tight";
const COLOURED = "bg-[var(--cat)] text-[var(--ink)]";
export const DASHED = "border-[1.5px] border-dashed border-[color-mix(in_oklab,var(--foreground)_28%,transparent)]";

export function PlanChip({ plan }: { plan: WeekPlanDetail }) {
  const href = planHref(plan);
  const body = (
    <>
      <span className="shrink-0">{shortTime(plan.startsAt)}</span>
      <span className="truncate">{plan.title}</span>
    </>
  );
  return href ? (
    <Link to={href} aria-label={describePlan(plan)} style={catStyle(plan.color)} className={cn(CHIP, COLOURED)}>
      {body}
    </Link>
  ) : (
    <div role="group" aria-label={describePlan(plan)} style={catStyle(plan.color)} className={cn(CHIP, COLOURED)}>
      {body}
    </div>
  );
}

export function StubChip({ stub }: { stub: StubCard }) {
  return (
    <div role="group" aria-label={describeStub(stub)} style={catStyle(stubColor(stub))} className={cn(CHIP, COLOURED)}>
      <Ticket aria-hidden="true" strokeWidth={1.75} className="size-3 shrink-0" />
      <span className="truncate">{stub.title}</span>
    </div>
  );
}

export function FreeChip({ slot }: { slot: FreeSlot }) {
  return (
    <div role="group" aria-label={describeFree(slot)} className={cn(CHIP, DASHED, "font-medium text-muted-foreground")}>
      <span className="truncate">{FREE_LABEL[slot.part]}</span>
    </div>
  );
}
