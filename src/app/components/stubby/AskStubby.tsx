import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useReducedMotion } from "motion/react";
import { Button } from "../ui/button";
import { Chip } from "../ui/Chip";
import { Input } from "../ui/input";
import { cn } from "../ui/utils";
import { plural } from "../../lib/plural";
import { ASK_COPY } from "../../lib/calendarCopy";
import { groupPicks, latestAskToday } from "../../lib/askGroups";
import { ASK_MAX_LENGTH, askStubbyStream, asksLeft as readAsksLeft, fetchMyPicks, removeMyPick, type AskStep, type MyPick, type Understood } from "../../lib/stubbyAsk";
import type { BuddyReaction } from "./StubbyBuddy";

/**
 * How the last ask ended, for Stubby's line: found something, found only the soonest after
 * tonight, found nothing, or failed.
 */
export type AskOutcome = "found" | "after" | "nothing" | "error" | null;

/** One live step while he looks (Stubby plan §7), ticked once the next one starts. */
export interface StepRow {
  key: string;
  kind: "search" | "pages" | "picking";
  query?: string;
  count?: number;
  done: boolean;
}

export interface AskState {
  text: string;
  setText: (text: string) => void;
  busy: boolean;
  error: string | null;
  status: string | null;
  outcome: AskOutcome;
  /** Asks left today, once known. */
  left: number | null;
  /** This ask's picks, revealed one by one. */
  current: MyPick[];
  /** Today's picks from earlier asks. */
  earlier: MyPick[];
  /** What Stubby understood from the ask, while and after he looks. */
  understood: Understood | null;
  steps: StepRow[];
  /** No new step for 12 seconds. */
  stalled: boolean;
  ask: (what: string) => Promise<void>;
  /** Stops listening. The ask was paid for, so it still counts. */
  stop: () => void;
  /** Asks the last thing again, after an error. */
  retry: () => void;
  remove: (p: MyPick) => Promise<void>;
}

/** With no new step for this long, he says he's still looking. */
export const STALL_MS = 12_000;
/** Picks come in one at a time, this far apart (all at once under reduced motion). */
export const REVEAL_MS = 400;

/**
 * Asking Stubby, as state: what is typed, whether he is looking and his steps as they stream
 * in, how many asks are left today, and what he found. Only this ask's picks are "current";
 * today's earlier ones are kept apart. The form (AskStubby) and the results (StubbyResults)
 * both read it, so the results can sit anywhere on the page.
 */
export function useAskStubby({ onReact }: { onReact?: (r: BuddyReaction) => void } = {}): AskState {
  const reduce = useReducedMotion() ?? false;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<AskOutcome>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [picks, setPicks] = useState<MyPick[]>([]);
  const [askId, setAskId] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(Infinity);
  const [understood, setUnderstood] = useState<Understood | null>(null);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [stalled, setStalled] = useState(false);
  const react = useRef(onReact);
  react.current = onReact;
  const running = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const lastAsk = useRef("");
  const stallTimer = useRef<number | undefined>(undefined);
  const revealTimer = useRef<number | undefined>(undefined);
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;

  useEffect(() => {
    let live = true;
    void Promise.all([fetchMyPicks(), readAsksLeft()]).then(([p, n]) => {
      if (!live) return;
      setPicks(p);
      setAskId(latestAskToday(p, Date.now()));
      setLeft(n);
    });
    return () => {
      live = false;
      controller.current?.abort();
      window.clearTimeout(stallTimer.current);
      window.clearInterval(revealTimer.current);
    };
  }, []);

  const resetStall = useCallback(() => {
    window.clearTimeout(stallTimer.current);
    setStalled(false);
    stallTimer.current = window.setTimeout(() => setStalled(true), STALL_MS);
  }, []);
  const endStall = useCallback(() => {
    window.clearTimeout(stallTimer.current);
    setStalled(false);
  }, []);

  const onStep = useCallback(
    (s: AskStep) => {
      resetStall();
      if (s.type === "understood") return setUnderstood(s.understood);
      setSteps((all) => {
        const ticked = all.map((r) => ({ ...r, done: true }));
        const last = all[all.length - 1];
        // The page count grows in place; everything else is a new step.
        if (s.type === "pages" && last?.kind === "pages") return [...ticked.slice(0, -1), { ...last, count: s.count, done: false }];
        if (s.type === "search") return [...ticked, { key: `s${all.length}`, kind: "search", query: s.query, done: false }];
        if (s.type === "pages") return [...ticked, { key: `p${all.length}`, kind: "pages", count: s.count, done: false }];
        return [...ticked, { key: `k${all.length}`, kind: "picking", done: false }];
      });
    },
    [resetStall],
  );

  /** Shows this ask's picks one by one. Stubby stamps on the first (or shrugs, when nothing fit tonight). */
  const reveal = useCallback((count: number, first: BuddyReaction) => {
    window.clearInterval(revealTimer.current);
    if (reduceRef.current || count <= 1) {
      setRevealed(Infinity);
      react.current?.(first);
      return;
    }
    setRevealed(1);
    react.current?.(first);
    let shown = 1;
    revealTimer.current = window.setInterval(() => {
      shown += 1;
      setRevealed(shown);
      if (shown >= count) window.clearInterval(revealTimer.current);
    }, REVEAL_MS);
  }, []);

  const ask = useCallback(
    async (what: string) => {
      if (running.current) return;
      running.current = true;
      lastAsk.current = what;
      const c = new AbortController();
      controller.current = c;
      setBusy(true);
      setError(null);
      setFound(null);
      setOutcome(null);
      setUnderstood(null);
      setSteps([]);
      resetStall();
      let r: Awaited<ReturnType<typeof askStubbyStream>>;
      try {
        r = await askStubbyStream(what, { signal: c.signal, onStep });
      } catch {
        // Stopped: stop() has already put things back.
        return;
      } finally {
        if (controller.current === c) {
          running.current = false;
          controller.current = null;
        }
      }
      if (c.signal.aborted) return;
      endStall();
      setBusy(false);
      setSteps((all) => all.map((s) => ({ ...s, done: true })));
      if (r.error) {
        setError(r.error);
        setOutcome("error");
        react.current?.("tilt");
        return;
      }
      if (r.asksLeft !== null) setLeft(r.asksLeft);
      const fresh = await fetchMyPicks();
      const id = r.askId ?? latestAskToday(fresh, Date.now());
      const mine = id === null ? 0 : fresh.filter((p) => p.askId === id).length;
      setPicks(fresh);
      setAskId(id);
      if (r.found > 0) setText("");
      if (r.found > 0 && r.outcome === "after") {
        // Nothing fit tonight: Stubby's line says so, and these are the soonest after.
        setOutcome("after");
        reveal(mine, "shrug");
      } else if (r.found > 0) {
        // The count matches what's shown: this ask's saved picks.
        setFound(mine || r.found);
        setOutcome("found");
        reveal(mine, "stamped");
      } else {
        setOutcome("nothing");
        setRevealed(Infinity);
        react.current?.("shrug");
      }
    },
    [onStep, resetStall, endStall, reveal],
  );

  const stop = useCallback(() => {
    const c = controller.current;
    if (!c) return;
    c.abort();
    controller.current = null;
    running.current = false;
    endStall();
    setBusy(false);
    setSteps([]);
    setUnderstood(null);
    // The ask was paid for: it still counts.
    setLeft((n) => (n === null ? n : Math.max(0, n - 1)));
  }, [endStall]);

  const retry = useCallback(() => {
    if (lastAsk.current) void ask(lastAsk.current);
  }, [ask]);

  const remove = useCallback(async (p: MyPick) => {
    setPicks((all) => all.filter((x) => x.id !== p.id));
    const r = await removeMyPick(p.id);
    if (r.error) {
      setError(r.error);
      setPicks(await fetchMyPicks());
    }
  }, []);

  const { current, earlier } = useMemo(() => groupPicks(picks, askId, Date.now()), [picks, askId]);
  const status = outcome === "found" && found ? `Found ${plural(found, "thing")}.` : outcome === "nothing" ? ASK_COPY.nothing : null;
  return {
    text,
    setText,
    busy,
    error,
    status,
    outcome,
    left,
    current: current.slice(0, revealed),
    earlier,
    understood,
    steps,
    stalled,
    ask,
    stop,
    retry,
    remove,
  };
}

/**
 * The ask, in the page: the field ("What are you in the mood for?"), how many asks are left
 * today beside it, Ask Stubby, and the quick ideas. On a phone the quick ideas are one row
 * that scrolls sideways, so the calendar still shows in the first screen. At 0 the field is
 * off and the quick ideas are gone; Stubby's own line says so (STUBBY_LINES.outOfAsks), so it
 * isn't repeated here.
 */
export function AskStubby({
  state,
  inputId: givenId,
  onFieldFocus,
  hideLabel = false,
}: {
  state: AskState;
  /** The field's id, so the page can focus it (the sticky bar). */
  inputId?: string;
  onFieldFocus?: () => void;
  /** Stubby is already asking the same question: the label stays for screen readers only. */
  hideLabel?: boolean;
}) {
  const ownId = useId();
  const inputId = givenId ?? ownId;
  const { text, setText, busy, left, ask } = state;
  const out = left === 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(text);
  };
  const quick = (idea: string) => {
    setText(idea);
    void ask(idea);
  };

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={submit} className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={inputId} className={cn("text-small font-semibold", hideLabel && "sr-only")}>
            {ASK_COPY.label}
          </label>
          {left !== null && !out && <p className="ml-auto shrink-0 text-caption text-muted-foreground">{`${plural(left, "ask")} left today`}</p>}
        </div>
        <div className="flex gap-2">
          <Input
            id={inputId}
            value={text}
            maxLength={ASK_MAX_LENGTH}
            placeholder={ASK_COPY.placeholder}
            onChange={(e) => setText(e.target.value)}
            onFocus={onFieldFocus}
            disabled={busy || out}
            className="min-w-0 flex-1"
          />
          <Button type="submit" disabled={busy || out || text.trim().length < 2} aria-busy={busy} className="shrink-0">
            {busy ? ASK_COPY.busy : ASK_COPY.button}
          </Button>
        </div>
      </form>
      {left !== null && !out && (
        // A phone: one row that scrolls sideways, edge to edge. From 744px: wraps.
        <div
          role="group"
          aria-label={ASK_COPY.chipsLabel}
          className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] tab:mx-0 tab:flex-wrap tab:overflow-visible tab:px-0 tab:pb-0 [&::-webkit-scrollbar]:hidden"
        >
          {ASK_COPY.chips.map((idea) => (
            <Chip key={idea} aria-pressed={undefined} disabled={busy} onClick={() => quick(idea)} className="shrink-0 snap-start border border-border">
              {idea}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
