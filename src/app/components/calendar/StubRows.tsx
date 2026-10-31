import { Ticket } from "lucide-react";
import { catStyle } from "../../lib/categoryStyle";
import { stubColor } from "../../lib/calendarView";
import type { StubCard } from "../../lib/stubs";

/** A day's Stubs as quiet rows: the Corner's colour, the ticket icon, the title and its line. */
export function StubRows({ stubs }: { stubs: readonly StubCard[] }) {
  if (stubs.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {stubs.map((s) => (
        <li key={s.id} style={catStyle(stubColor(s))} className="flex min-h-12 items-center gap-3 rounded-card bg-[var(--cat)] px-4 py-2 text-[var(--ink)]">
          <Ticket aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-body font-semibold">{s.title}</span>
            <span className="truncate text-small">Stub{s.meta ? ` · ${s.meta}` : ""}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
