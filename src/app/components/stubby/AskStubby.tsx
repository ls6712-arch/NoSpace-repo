import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ExternalLink, X } from "lucide-react";
import { Button } from "../ui/button";
import { Chip } from "../ui/Chip";
import { Input } from "../ui/input";
import { cn } from "../ui/utils";
import { plural } from "../../lib/plural";
import { pickPill } from "../../lib/cityPicks";
import { ASK_COPY } from "../../lib/calendarCopy";
import { ASK_MAX_LENGTH, askStubby, asksLeft as readAsksLeft, fetchMyPicks, removeMyPick, type MyPick } from "../../lib/stubbyAsk";
import type { BuddyReaction } from "./StubbyBuddy";

/**
 * "Something different?": type what you're after (or tap a quick idea) and Stubby searches
 * right then. He never talks: while he looks, the dock's Stubby thinks (onBusy), and when
 * he's done he reacts (onReact). What he found shows here as your own picks, with a link
 * out and Remove.
 *
 * `card` is the box on its own (with its heading); `panel` sits inside the dock's sheet or
 * side panel, which already carries the title, so it drops the border, padding and heading.
 */
export function AskStubby({
  variant = "card",
  onBusy,
  onReact,
  onAsksLeft,
  autoFocus = false,
}: {
  variant?: "card" | "panel";
  onBusy?: (busy: boolean) => void;
  onReact?: (r: BuddyReaction) => void;
  /** Called whenever the count of asks left today is known or changes. */
  onAsksLeft?: (left: number) => void;
  /** Focus the field once it can be typed in. */
  autoFocus?: boolean;
}) {
  const inputId = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [left, setLeftState] = useState<number | null>(null);
  const [picks, setPicks] = useState<MyPick[]>([]);
  const report = useRef(onAsksLeft);
  report.current = onAsksLeft;
  const setLeft = useCallback((n: number) => {
    setLeftState(n);
    report.current?.(n);
  }, []);

  const load = useCallback(async () => {
    const [p, n] = await Promise.all([fetchMyPicks(), readAsksLeft()]);
    setPicks(p);
    setLeft(n);
  }, [setLeft]);
  useEffect(() => {
    void load();
  }, [load]);

  const out = left === 0;
  useEffect(() => {
    if (autoFocus && left !== null && !out) document.getElementById(inputId)?.focus({ preventScroll: true });
  }, [autoFocus, left, out, inputId]);

  const ask = async (what: string) => {
    if (busy) return;
    setBusy(true);
    onBusy?.(true);
    setError(null);
    setStatus(null);
    const r = await askStubby(what);
    setBusy(false);
    onBusy?.(false);
    if (r.error) {
      setError(r.error);
      onReact?.("tilt");
      return;
    }
    if (r.asksLeft !== null) setLeft(r.asksLeft);
    if (r.found > 0) {
      setStatus(`Found ${plural(r.found, "thing")}.`);
      setText("");
      onReact?.("stamped");
    } else {
      setStatus(ASK_COPY.nothing);
      onReact?.("shrug");
    }
    setPicks(await fetchMyPicks());
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(text);
  };
  const quick = (idea: string) => {
    setText(idea);
    void ask(idea);
  };

  const remove = async (p: MyPick) => {
    setPicks((all) => all.filter((x) => x.id !== p.id));
    const r = await removeMyPick(p.id);
    if (r.error) {
      setError(r.error);
      setPicks(await fetchMyPicks());
    }
  };

  const panel = variant === "panel";
  return (
    <section
      aria-labelledby={panel ? undefined : `${inputId}-title`}
      aria-label={panel ? ASK_COPY.title : undefined}
      className={cn("flex flex-col gap-3", panel ? "" : "mt-6 rounded-card border border-border bg-card p-4")}
    >
      {!panel && (
        <h2 id={`${inputId}-title`} className="text-lead font-bold" style={{ fontFamily: "var(--font-display)" }}>
          {ASK_COPY.title}
        </h2>
      )}
      {left !== null && !out && (
        <div role="group" aria-label={ASK_COPY.chipsLabel} className="flex flex-wrap gap-2">
          {ASK_COPY.chips.map((idea) => (
            <Chip key={idea} aria-pressed={undefined} disabled={busy} onClick={() => quick(idea)}>
              {idea}
            </Chip>
          ))}
        </div>
      )}
      <form onSubmit={submit} className={cn("flex flex-col gap-2", panel ? "" : "tab:flex-row tab:items-end")}>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor={inputId} className="text-small font-semibold">
            {ASK_COPY.label}
          </label>
          <Input
            id={inputId}
            value={text}
            maxLength={ASK_MAX_LENGTH}
            placeholder={ASK_COPY.placeholder}
            onChange={(e) => setText(e.target.value)}
            disabled={busy || out}
          />
        </div>
        <Button type="submit" disabled={busy || out || text.trim().length < 2} aria-busy={busy} className={panel ? "" : "tab:self-end"}>
          {busy ? ASK_COPY.busy : ASK_COPY.button}
        </Button>
      </form>
      <div aria-live="polite" className="flex flex-col gap-1">
        {left !== null && <p className="text-caption text-muted-foreground">{out ? ASK_COPY.none : `${plural(left, "ask")} left today`}</p>}
        {error && (
          <p role="alert" className="text-small text-destructive">
            {error}
          </p>
        )}
        {status && <p className="text-small font-semibold">{status}</p>}
      </div>
      {picks.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label={ASK_COPY.listLabel}>
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
    </section>
  );
}
