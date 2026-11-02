import { ExternalLink, X } from "lucide-react";
import { Link } from "react-router";
import { pickPill } from "../../lib/cityPicks";
import { ASK_COPY } from "../../lib/calendarCopy";
import type { MyPick } from "../../lib/stubbyAsk";
import type { AskState } from "./AskStubby";

/** A Soosh page (an idea's Corner start page or Pursuit) opens in the app; anything else opens the outside page. */
const isSooshLink = (url: string) => url.startsWith("/");

/**
 * What Stubby found, right under the Calendar stage: why an ask failed, how it went, and
 * your own picks (link out and Remove), best fit first. Each pick carries its why line. An
 * idea is labelled "An idea" and never shown as a dated ticket. One self-contained block, so
 * the deck of cards (Stubby plan PR 3) can take its place without touching the stage.
 */
export function StubbyResults({ state }: { state: AskState }) {
  const { error, outcome, picks, remove } = state;
  // When nothing fit, Stubby's own line says so; the status isn't repeated here.
  const status = outcome === "nothing" || outcome === "after" ? null : state.status;
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
            <PickRow key={p.id} pick={p} onRemove={() => void remove(p)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PickRow({ pick: p, onRemove }: { pick: MyPick; onRemove: () => void }) {
  const idea = p.kind === "idea";
  const meta = idea ? [p.place, p.price?.trim() || null] : [pickPill(p), p.place];
  const linkClass = "mt-1 inline-flex min-h-8 items-center gap-1 text-small font-semibold underline underline-offset-2";
  return (
    <li data-pick-kind={p.kind} className="flex items-start gap-3 rounded-control border-[1.5px] border-dashed border-accent-text p-3">
      <div className="min-w-0 flex-1">
        <p className="text-caption font-semibold text-accent-text">{idea ? ASK_COPY.ideaLabel : ASK_COPY.cardLabel}</p>
        <p className="text-body font-semibold leading-tight">{p.title}</p>
        {meta.some(Boolean) && <p className="text-small text-muted-foreground">{meta.filter(Boolean).join(" · ")}</p>}
        {p.why && <p className="mt-1 text-small">{p.why}</p>}
        {p.note && <p className="text-caption text-muted-foreground">{p.note}</p>}
        {isSooshLink(p.url) ? (
          <Link to={p.url} className={linkClass}>
            {ASK_COPY.open}
          </Link>
        ) : (
          <a href={p.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {ASK_COPY.open}
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        )}
      </div>
      <button type="button" onClick={onRemove} aria-label={`${ASK_COPY.remove}: ${p.title}`} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground">
        <X className="size-5" aria-hidden="true" />
      </button>
    </li>
  );
}
