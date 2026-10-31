import { describePick, timeRange, type CalendarFreeSlot } from "../../lib/calendarView";
import { SHEET } from "../../lib/calendarCopy";
import { cn } from "../ui/utils";

/** White, a 1.5px dashed border in the accent text colour: how a pick looks everywhere (brief section 3). */
export const PICK_BORDER = "border-[1.5px] border-dashed border-accent-text bg-card";

/**
 * Stubby's pick inside a free stretch: the label, the thing, when, and Keep.
 * Tapping the card opens the pick (reason, place, Not this); Keep makes it a plan.
 */
export function PickCard({ slot, onOpen, onKeep, className }: { slot: CalendarFreeSlot; onOpen: (slot: CalendarFreeSlot) => void; onKeep: (slot: CalendarFreeSlot) => void; className?: string }) {
  const pick = slot.pick;
  if (!pick) return null;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 rounded-control p-2", PICK_BORDER, className)}>
      <button type="button" data-hit aria-label={describePick(pick)} onClick={() => onOpen(slot)} className="flex min-h-6 min-w-0 flex-col items-start gap-0.5 text-left text-foreground">
        <span className="text-caption font-semibold text-accent-text">{SHEET.stubbysPick}</span>
        <span className="line-clamp-2 text-small font-bold leading-tight">{pick.title}</span>
        <span className="truncate text-caption text-muted-foreground">{timeRange(pick.startsAt, pick.endsAt)}</span>
      </button>
      <button
        type="button"
        data-hit
        onClick={() => onKeep(slot)}
        className="inline-flex min-h-8 items-center self-start rounded-full bg-foreground px-4 text-caption font-semibold text-background"
      >
        {SHEET.keep}
      </button>
    </div>
  );
}

/** The month's small version: just the label and the thing. */
export function PickChip({ slot, onOpen }: { slot: CalendarFreeSlot; onOpen: (slot: CalendarFreeSlot) => void }) {
  const pick = slot.pick;
  if (!pick) return null;
  return (
    <button
      type="button"
      aria-label={describePick(pick)}
      onClick={() => onOpen(slot)}
      className={cn("flex min-h-6 w-full min-w-0 items-center gap-1 rounded-control px-2 py-0.5 text-left text-caption font-semibold leading-tight text-accent-text", PICK_BORDER)}
    >
      <span className="truncate">{pick.title}</span>
    </button>
  );
}
