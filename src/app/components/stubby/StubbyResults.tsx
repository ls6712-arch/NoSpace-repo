import { useId, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useReducedMotion } from "motion/react";
import { Check, ChevronDown, ExternalLink, LoaderCircle, X } from "lucide-react";
import { Link } from "react-router";
import { Button } from "../ui/button";
import { Chip } from "../ui/Chip";
import { cn } from "../ui/utils";
import { pickPill } from "../../lib/cityPicks";
import { plural } from "../../lib/plural";
import { ASK_COPY, SHEET, UNDERSTOOD_COPY } from "../../lib/calendarCopy";
import { cardCount, frontCard, selectionFull } from "../../lib/stubbyDeck";
import { TRY_AGAIN } from "../../lib/stateCopy";
import type { MyPick } from "../../lib/stubbyAsk";
import type { AskState, StepRow } from "./AskStubby";

/** A Soosh page (an idea's Corner start page or Pursuit) opens in the app; anything else opens the outside page. */
const isSooshLink = (url: string) => url.startsWith("/");

const stepText = (s: StepRow) =>
  s.kind === "search" ? ASK_COPY.lookingFor(s.query ?? "") : s.kind === "pages" ? `Checking ${plural(s.count ?? 0, "page")}` : ASK_COPY.picking;

/** How far a card is dragged before a swipe counts: right keeps, left is Not now. */
const SWIPE_PX = 96;
/** The stack behind the front card: each card this much lower, and this much smaller. */
export const STACK_OFFSET_PX = 10;
export const STACK_SHRINK = 0.05;

export interface DeckActions {
  /** Makes these picks plans on the calendar; resolves with the ids that were made. */
  onMakePlans?: (picks: MyPick[]) => Promise<number[]>;
  /** The bring-a-friend nudge: makes the pick a plan and opens the half ticket. */
  onBring?: (pick: MyPick) => void;
}

/**
 * What Stubby found, right under the Calendar stage. While he looks: what he understood, as
 * chips, then each step, and Stop (stubby-plan §7). After: why an ask failed (with Try again),
 * how it went, and his picks as a deck of cards (§6.5): one in front, the next ones peeking
 * behind. Keep sends it to Your selection, Not now to the back of the deck; Bring it back undoes
 * the last Not now. Swipe right or left, or use the arrow keys (Backspace brings one back).
 * Follow-ups add cards to the back. Today's earlier picks fold away under "Earlier today".
 */
export function StubbyResults({ state, onMakePlans, onBring }: { state: AskState } & DeckActions) {
  const { busy, error, outcome, earlier, understood, steps, stop, retry, remove, deck } = state;
  // When nothing fit, Stubby's own line says so; the status isn't repeated here.
  const status = outcome === "nothing" || outcome === "after" ? null : state.status;
  const chips = understood ? [UNDERSTOOD_COPY.when[understood.when ?? ""], UNDERSTOOD_COPY.who[understood.who ?? ""]].filter(Boolean) : [];
  const hasDeck = deck.all.length > 0 || deck.selection.length > 0;
  if (!busy && !error && !status && !hasDeck && earlier.length === 0) return null;
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
      {deck.all.length > 0 && <Deck state={state} onBring={onBring} />}
      {deck.selection.length > 0 && <Selection state={state} onMakePlans={onMakePlans} />}
      {earlier.length > 0 && <Earlier picks={earlier} onRemove={(p) => void remove(p)} />}
    </div>
  );
}

/** The deck: the front card, the ones behind it peeking out, and what to do when it runs out. */
function Deck({ state, onBring }: { state: AskState; onBring?: (pick: MyPick) => void }) {
  const reduce = useReducedMotion() ?? false;
  const { deck, pick, keep, notNow, bringBack, seeSkipped, retry, followUp, busy, nudgeId, remove } = state;
  const id = frontCard(deck);
  const front = id === null ? undefined : pick(id);
  const count = cardCount(deck);
  const behind = Math.min(2, Math.max(0, deck.order.length - 1));
  const full = selectionFull(deck);
  const [dx, setDx] = useState(0);
  const start = useRef<number | null>(null);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "ArrowRight" && !full) {
      e.preventDefault();
      keep();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      notNow();
    } else if (e.key === "Backspace" && deck.recent.length > 0) {
      e.preventDefault();
      bringBack();
    }
  };
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    start.current = e.clientX;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (start.current !== null) setDx(e.clientX - start.current);
  };
  const up = () => {
    if (start.current === null) return;
    start.current = null;
    if (dx > SWIPE_PX && !full) keep();
    else if (dx < -SWIPE_PX) notNow();
    setDx(0);
  };

  const runOut = id === null;
  return (
    <section data-stubby-deck="" aria-label={ASK_COPY.listLabel} className="flex flex-col gap-3">
      {/* Each new card is read out: its name and where it is in the deck. */}
      <p className="sr-only" aria-live="polite">
        {front && count ? `${front.title}, ${ASK_COPY.count(count.n, count.total)}` : ""}
      </p>
      {!runOut && front && (
        <div
          tabIndex={0}
          onKeyDown={onKey}
          className="relative isolate mb-6 rounded-card outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-stubby-deck-front=""
        >
          {/* The next cards, as a stack behind the front one: each a little lower and a little smaller. */}
          {Array.from({ length: behind }, (_, i) => (
            <div
              key={i}
              aria-hidden="true"
              data-stubby-deck-behind=""
              className="absolute inset-0 origin-bottom rounded-card border border-border bg-card shadow-overlay"
              style={{ transform: `translateY(${(i + 1) * STACK_OFFSET_PX}px) scale(${1 - (i + 1) * STACK_SHRINK})`, zIndex: -1 - i }}
            />
          ))}
          <div
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            className={cn("relative touch-pan-y select-none rounded-card border-[1.5px] border-dashed border-accent-text bg-card p-4", !reduce && dx === 0 && "transition-transform")}
            style={dx && !reduce ? { transform: `translateX(${dx}px) rotate(${dx / 24}deg)` } : undefined}
          >
            <Card pick={front} count={count} onRemove={() => void remove(front)} />
            {nudgeId === front.id && onBring && (
              <Button type="button" variant="outline" className="mt-3" onClick={() => onBring(front)}>
                {SHEET.bringSomeone}
              </Button>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" onClick={keep} disabled={full}>
                {ASK_COPY.keep}
              </Button>
              <Button type="button" variant="outline" onClick={notNow}>
                {ASK_COPY.notNow}
              </Button>
            </div>
          </div>
        </div>
      )}
      {runOut && (
        <div data-stubby-runout="" className="flex flex-wrap gap-2">
          {deck.order.length > 0 && (
            <Button type="button" variant="outline" onClick={seeSkipped}>
              {ASK_COPY.seeSkipped}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={retry} disabled={busy}>
            {ASK_COPY.askAgain}
          </Button>
          {deck.selection.length > 0 && (
            <Button type="button" variant="outline" onClick={() => document.getElementById("stubby-selection")?.focus()}>
              {ASK_COPY.goToSelection}
            </Button>
          )}
        </div>
      )}
      {deck.recent.length > 0 && (
        <Button type="button" variant="ghost" onClick={bringBack} className="self-start">
          {ASK_COPY.bringBack}
        </Button>
      )}
      <div role="group" aria-label={ASK_COPY.chipsLabel} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] tab:mx-0 tab:flex-wrap tab:overflow-visible tab:px-0 [&::-webkit-scrollbar]:hidden">
        {ASK_COPY.followUps.map((f) => (
          <Chip key={f.kind} aria-pressed={undefined} disabled={busy} onClick={() => followUp(f.kind)} className="shrink-0 border border-border">
            {f.label}
          </Chip>
        ))}
      </div>
    </section>
  );
}

/** One card: what, when, where, price, why, and Open. An idea is never shown as a dated ticket. */
function Card({ pick: p, count, onRemove }: { pick: MyPick; count: { n: number; total: number } | null; onRemove: () => void }) {
  const idea = p.kind === "idea";
  const meta = idea ? [p.place, p.price?.trim() || null] : [pickPill(p), p.place];
  const linkClass = "mt-1 inline-flex min-h-8 items-center gap-1 text-small font-semibold underline underline-offset-2";
  return (
    <div data-pick-kind={p.kind} className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-caption font-semibold text-accent-text">{idea ? ASK_COPY.ideaLabel : ASK_COPY.cardLabel}</p>
          {count && <p className="text-caption text-muted-foreground">{ASK_COPY.count(count.n, count.total)}</p>}
        </div>
        <p className="text-lead font-semibold leading-tight">{p.title}</p>
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
      <button type="button" onClick={onRemove} aria-label={`${ASK_COPY.remove}: ${p.title}`} className="-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground">
        <X className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Your selection: up to 5 kept cards as small tickets. Choose one or more, then Make it a plan. */
function Selection({ state, onMakePlans }: { state: AskState; onMakePlans?: (picks: MyPick[]) => Promise<number[]> }) {
  const { deck, pick, unselect, madePlans } = state;
  const [chosen, setChosen] = useState<ReadonlySet<number>>(new Set());
  const [making, setMaking] = useState(false);
  const picks = deck.selection.map((id) => pick(id)).filter((p): p is MyPick => !!p);
  const toggle = (id: number) =>
    setChosen((c) => {
      const next = new Set(c);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const make = async () => {
    if (!onMakePlans) return;
    const list = picks.filter((p) => chosen.has(p.id));
    if (!list.length) return;
    setMaking(true);
    const made = await onMakePlans(list);
    setMaking(false);
    madePlans(made);
    setChosen((c) => new Set([...c].filter((x) => !made.includes(x))));
  };
  return (
    <section aria-labelledby="stubby-selection" className="flex flex-col gap-2">
      <h3 id="stubby-selection" tabIndex={-1} className="text-small font-semibold outline-none">
        {ASK_COPY.selection}
      </h3>
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] tab:mx-0 tab:flex-wrap tab:px-0 [&::-webkit-scrollbar]:hidden">
        {picks.map((p) => (
          <li key={p.id} className="flex shrink-0 items-stretch rounded-control border border-border bg-card">
            <button
              type="button"
              aria-pressed={chosen.has(p.id)}
              onClick={() => toggle(p.id)}
              className={cn("flex max-w-56 flex-col items-start px-3 py-2 text-left", chosen.has(p.id) && "bg-accent/15")}
            >
              <span className="flex items-center gap-1 text-small font-semibold">
                {chosen.has(p.id) && <Check className="size-3.5 shrink-0 text-accent-text" aria-hidden="true" />}
                <span className="truncate">{p.title}</span>
              </span>
              <span className="text-caption text-muted-foreground">{p.kind === "idea" ? ASK_COPY.ideaLabel : pickPill(p)}</span>
            </button>
            <button type="button" onClick={() => unselect(p.id)} aria-label={`${ASK_COPY.remove}: ${p.title}`} className="inline-flex w-11 items-center justify-center text-muted-foreground">
              <X className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {onMakePlans && (
        <Button type="button" onClick={() => void make()} disabled={chosen.size === 0 || making} aria-busy={making} className="self-start">
          {ASK_COPY.makePlan}
        </Button>
      )}
    </section>
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
            <li key={p.id} className="rounded-control border-[1.5px] border-dashed border-accent-text p-3">
              <Card pick={p} count={null} onRemove={() => onRemove(p)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
