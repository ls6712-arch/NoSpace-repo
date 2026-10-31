import { Ticket } from "lucide-react";
import { catStyle } from "../../lib/categoryStyle";
import { SHEET } from "../../lib/calendarCopy";
import type { Occurrence } from "../../lib/calendarEntries";
import { describeBlock, describeStub, stubColor, timeRange } from "../../lib/calendarView";
import type { StubCard } from "../../lib/stubs";
import { HATCH_STYLE } from "./CalendarChips";

/** A day's Stubs as quiet rows: the Corner's colour, the ticket icon, the title and its line. Tapping one opens its ticket. */
export function StubRows({ stubs, onOpen }: { stubs: readonly StubCard[]; onOpen: (stub: StubCard) => void }) {
  if (stubs.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {stubs.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            aria-label={describeStub(s)}
            onClick={() => onOpen(s)}
            style={catStyle(stubColor(s))}
            className="flex min-h-12 w-full items-center gap-3 rounded-card bg-[var(--cat)] px-4 py-2 text-left text-[var(--ink)]"
          >
            <Ticket aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-body font-semibold">{s.title}</span>
              <span className="truncate text-small">Stub{s.meta ? ` · ${s.meta}` : ""}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** A day's blocks as rows, hatched, with the note or "Your block" and the time. */
export function BlockRows({ blocks, onOpen }: { blocks: readonly Occurrence[]; onOpen: (block: Occurrence) => void }) {
  if (blocks.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {blocks.map((b) => (
        <li key={`${b.entry.id}-${b.startMs}`}>
          <button type="button" aria-label={describeBlock(b)} onClick={() => onOpen(b)} style={HATCH_STYLE} className="flex min-h-12 w-full flex-col justify-center rounded-card border border-border px-4 py-2 text-left">
            <span className="truncate text-body font-semibold">{b.entry.note ?? SHEET.yourBlock}</span>
            <span className="truncate text-small">{timeRange(b.startMs, b.endMs)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
