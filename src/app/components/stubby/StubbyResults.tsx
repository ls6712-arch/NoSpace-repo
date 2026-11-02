import { ExternalLink, X } from "lucide-react";
import { pickPill } from "../../lib/cityPicks";
import { ASK_COPY } from "../../lib/calendarCopy";
import type { AskState } from "./AskStubby";

/**
 * What Stubby found, right under the Calendar stage: why an ask failed, how it went, and
 * your own picks (link out and Remove). One self-contained block, so the deck of cards
 * (Stubby plan PR 3) can take its place without touching the stage.
 */
export function StubbyResults({ state }: { state: AskState }) {
  const { error, outcome, picks, remove } = state;
  // When nothing fit, Stubby's own line says so; the status isn't repeated here.
  const status = outcome === "nothing" ? null : state.status;
  if (!error && !status && picks.length === 0) return null;
  return (
    <div data-stubby-results="" className="mb-6 flex flex-col gap-3">
      <div aria-live="polite" className="flex flex-col gap-1 empty:hidden">
        {error && (
          <p role="alert" className="text-small text-destructive">
            {error}
          </p>
        )}
        {status && <p className="text-small font-semibold">{status}</p>}
      </div>
      {picks.length > 0 && (
        <ul className="grid gap-2 tab:grid-cols-2" aria-label={ASK_COPY.listLabel}>
          {picks.map((p) => (
            <li key={p.id} className="flex items-start gap-3 rounded-control border-[1.5px] border-dashed border-accent-text p-3">
              <div className="min-w-0 flex-1">
                <p className="text-caption font-semibold text-accent-text">{ASK_COPY.cardLabel}</p>
                <p className="text-body font-semibold leading-tight">{p.title}</p>
                <p className="text-small text-muted-foreground">{[pickPill(p), p.place].filter(Boolean).join(" · ")}</p>
                {p.note && <p className="text-caption text-muted-foreground">{p.note}</p>}
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-8 items-center gap-1 text-small font-semibold underline underline-offset-2">
                  {ASK_COPY.open}
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              </div>
              <button type="button" onClick={() => void remove(p)} aria-label={`${ASK_COPY.remove}: ${p.title}`} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground">
                <X className="size-5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
