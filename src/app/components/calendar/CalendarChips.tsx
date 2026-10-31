import { Ticket } from "lucide-react";
import { catStyle } from "../../lib/categoryStyle";
import { describeBlock, describeFree, describePlan, describeStub, shortTime, stubColor, type CalendarFreeSlot } from "../../lib/calendarView";
import { SHEET } from "../../lib/calendarCopy";
import type { Occurrence } from "../../lib/calendarEntries";
import type { StubCard } from "../../lib/stubs";
import { FREE_LABEL, type WeekPlanDetail } from "../../lib/weekView";
import { cn } from "../ui/utils";

/**
 * The calendar's small shapes, the same in every view (brief section 3):
 *  - a plan, a Pursuit session or a Stub: the Corner's colour with ink text, a Stub with the ticket icon;
 *  - free time: no fill, a dashed border at 28% ink and a muted label;
 *  - a block: a grey hatch, with its note or "Your block".
 * The look is never the only signal: each carries its words. Each is a real button that opens its sheet.
 */
const CHIP = "flex min-h-6 w-full min-w-0 items-center gap-1 rounded-control px-2 py-0.5 text-left text-caption font-semibold leading-tight";
const COLOURED = "bg-[var(--cat)] text-[var(--ink)]";
export const DASHED = "border-[1.5px] border-dashed border-[color-mix(in_oklab,var(--foreground)_28%,transparent)]";
/** A grey hatch for your blocks (and, later, busy times from Google). */
export const HATCH_STYLE = { backgroundImage: "repeating-linear-gradient(135deg, color-mix(in oklab, var(--foreground) 14%, transparent) 0 2px, transparent 2px 7px)" } as const;

export function PlanChip({ plan, onOpen }: { plan: WeekPlanDetail; onOpen: (plan: WeekPlanDetail) => void }) {
  return (
    <button type="button" aria-label={describePlan(plan)} onClick={() => onOpen(plan)} style={catStyle(plan.color)} className={cn(CHIP, COLOURED)}>
      <span className="shrink-0">{shortTime(plan.startsAt)}</span>
      <span className="truncate">{plan.title}</span>
    </button>
  );
}

export function StubChip({ stub, onOpen }: { stub: StubCard; onOpen: (stub: StubCard) => void }) {
  return (
    <button type="button" aria-label={describeStub(stub)} onClick={() => onOpen(stub)} style={catStyle(stubColor(stub))} className={cn(CHIP, COLOURED)}>
      <Ticket aria-hidden="true" strokeWidth={1.75} className="size-3 shrink-0" />
      <span className="truncate">{stub.title}</span>
    </button>
  );
}

export function FreeChip({ slot, onOpen }: { slot: CalendarFreeSlot; onOpen: (slot: CalendarFreeSlot) => void }) {
  return (
    <button type="button" aria-label={describeFree(slot)} onClick={() => onOpen(slot)} className={cn(CHIP, DASHED, "font-medium text-muted-foreground")}>
      <span className="truncate">{FREE_LABEL[slot.part]}</span>
    </button>
  );
}

export function BlockChip({ block, onOpen }: { block: Occurrence; onOpen: (block: Occurrence) => void }) {
  return (
    <button type="button" aria-label={describeBlock(block)} onClick={() => onOpen(block)} style={HATCH_STYLE} className={cn(CHIP, "border border-border text-foreground")}>
      <span className="truncate">{block.entry.note ?? SHEET.yourBlock}</span>
    </button>
  );
}
