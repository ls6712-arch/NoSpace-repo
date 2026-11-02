import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "../ui/button";
import { Chip } from "../ui/Chip";
import { Input } from "../ui/input";
import { cn } from "../ui/utils";
import { plural } from "../../lib/plural";
import { ASK_COPY } from "../../lib/calendarCopy";
import { ASK_MAX_LENGTH, askStubby, asksLeft as readAsksLeft, fetchMyPicks, removeMyPick, type MyPick } from "../../lib/stubbyAsk";
import type { BuddyReaction } from "./StubbyBuddy";

/**
 * How the last ask ended, for Stubby's line: found something, found only the soonest after
 * tonight, found nothing, or failed.
 */
export type AskOutcome = "found" | "after" | "nothing" | "error" | null;

export interface AskState {
  text: string;
  setText: (text: string) => void;
  busy: boolean;
  error: string | null;
  status: string | null;
  outcome: AskOutcome;
  /** Asks left today, once known. */
  left: number | null;
  picks: MyPick[];
  ask: (what: string) => Promise<void>;
  remove: (p: MyPick) => Promise<void>;
}

/**
 * Asking Stubby, as state: what is typed, whether he is looking, how many asks are left
 * today, and what he found (your own picks). The form (AskStubby) and the results
 * (StubbyResults) both read it, so the results can sit anywhere on the page.
 */
export function useAskStubby({ onReact }: { onReact?: (r: BuddyReaction) => void } = {}): AskState {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<AskOutcome>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [picks, setPicks] = useState<MyPick[]>([]);
  const react = useRef(onReact);
  react.current = onReact;
  const running = useRef(false);

  useEffect(() => {
    let live = true;
    void Promise.all([fetchMyPicks(), readAsksLeft()]).then(([p, n]) => {
      if (!live) return;
      setPicks(p);
      setLeft(n);
    });
    return () => {
      live = false;
    };
  }, []);

  const ask = useCallback(async (what: string) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    setStatus(null);
    setOutcome(null);
    const r = await askStubby(what);
    running.current = false;
    setBusy(false);
    if (r.error) {
      setError(r.error);
      setOutcome("error");
      react.current?.("tilt");
      return;
    }
    if (r.asksLeft !== null) setLeft(r.asksLeft);
    if (r.found > 0 && r.outcome === "after") {
      // Nothing fit tonight: Stubby's line says so, and these are the soonest after.
      setText("");
      setOutcome("after");
      react.current?.("shrug");
    } else if (r.found > 0) {
      setStatus(`Found ${plural(r.found, "thing")}.`);
      setText("");
      setOutcome("found");
      react.current?.("stamped");
    } else {
      setStatus(ASK_COPY.nothing);
      setOutcome("nothing");
      react.current?.("shrug");
    }
    setPicks(await fetchMyPicks());
  }, []);

  const remove = useCallback(async (p: MyPick) => {
    setPicks((all) => all.filter((x) => x.id !== p.id));
    const r = await removeMyPick(p.id);
    if (r.error) {
      setError(r.error);
      setPicks(await fetchMyPicks());
    }
  }, []);

  return { text, setText, busy, error, status, outcome, left, picks, ask, remove };
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
