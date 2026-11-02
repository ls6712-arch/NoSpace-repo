import { useId, useState } from "react";
import { Check, ChevronDown, ExternalLink, LoaderCircle, X } from "lucide-react";
import { Link } from "react-router";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { pickPill } from "../../lib/cityPicks";
import { plural } from "../../lib/plural";
import { ASK_COPY, UNDERSTOOD_COPY } from "../../lib/calendarCopy";
import { TRY_AGAIN } from "../../lib/stateCopy";
import type { MyPick } from "../../lib/stubbyAsk";
import type { AskState, StepRow } from "./AskStubby";

/** A Soosh page (an idea's Corner start page or Pursuit) opens in the app; anything else opens the outside page. */
const isSooshLink = (url: string) => url.startsWith("/");

const stepText = (s: StepRow) =>
  s.kind === "search" ? ASK_COPY.lookingFor(s.query ?? "") : s.kind === "pages" ? `Checking ${plural(s.count ?? 0, "page")}` : ASK_COPY.picking;

/**
 * What Stubby found, right under the Calendar stage (stubby-plan §7). While he looks: what he
 * understood, as chips, then each step as it happens, ticked once the next one starts, and
 * Stop. After: why an ask failed (with Try again), how it went, and this ask's picks, one by
 * one, best fit first. Today's earlier picks fold away under "Earlier today". One self-contained
 * block, so the deck of cards (Stubby plan PR 3) can take its place without touching the stage.
 */
export function StubbyResults({ state }: { state: AskState }) {
  const { busy, error, outcome, current, earlier, understood, steps, stop, retry, remove } = state;
  // When nothing fit, Stubby's own line says so; the status isn't repeated here.
  const status = outcome === "nothing" || outcome === "after" ? null : state.status;
  const chips = understood ? [UNDERSTOOD_COPY.when[understood.when ?? ""], UNDERSTOOD_COPY.who[understood.who ?? ""]].filter(Boolean) : [];
  if (!busy && !error && !status && current.length === 0 && earlier.length === 0) return null;
  return (
    <div data-stubby-results="" className="mb-6 flex flex-col gap-3">
      {busy && chips.length > 0 && (
        <ul data-stubby-understood="" className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <li key={c} className="rounded-full border border-border bg-card px-3 py-1 text-small font-semibold">
              {c}
            </li>
          ))}
        </ul>
      )}
      {busy && (
        <ol data-stubby-steps="" aria-live="polite" className="flex flex-col gap-1.5">
          {steps.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-small" data-step-done={s.done ? "" : undefined}>
              {s.done ? (
                <Check className="size-4 shrink-0 text-accent-text" aria-hidden="true" />
              ) : (
                <LoaderCircle className="size-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden="true" />
              )}
              <span className={cn("min-w-0 truncate", s.done && "text-muted-foreground")}>{stepText(s)}</span>
            </li>
          ))}
        </ol>
      )}
      {busy && (
        <Button type="button" variant="outline" onClick={stop} className="self-start">
          {ASK_COPY.stop}
        </Button>
      )}
      <div aria-live="polite" className="flex flex-col gap-1 empty:hidden">
        {error && (
          <p role="alert" className="text-small text-destructive">
            {error}
          </p>
        )}
        {status && <p className="text-small font-semibold">{status}</p>}
      </div>
      {error && outcome === "error" && (
        <Button type="button" variant="outline" onClick={retry} className="self-start">
          {TRY_AGAIN}
        </Button>
      )}
      {current.length > 0 && (
        <ul className="grid gap-2 tab:grid-cols-2" aria-label={ASK_COPY.listLabel}>
          {current.map((p) => (
            <PickRow key={p.id} pick={p} onRemove={() => void remove(p)} />
          ))}
        </ul>
      )}
      {earlier.length > 0 && <Earlier picks={earlier} onRemove={(p) => void remove(p)} />}
    </div>
  );
}

/** Today's picks from earlier asks, folded away until opened. */
function Earlier({ picks, onRemove }: { picks: MyPick[]; onRemove: (p: MyPick) => void }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 items-center gap-1 self-start text-small font-semibold text-muted-foreground"
      >
        {ASK_COPY.earlier}
        <ChevronDown className={cn("size-4 transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <ul id={id} className="grid gap-2 tab:grid-cols-2">
          {picks.map((p) => (
            <PickRow key={p.id} pick={p} onRemove={() => onRemove(p)} />
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
