import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { askStubby, fetchCityPicks, type CityPick } from "../../lib/cityPicks";
import { WEEK_VIEW } from "../../lib/homeCopy";
import { plural } from "../../lib/plural";
import { StubbyBuddy, type StubbyBuddyHandle } from "../stubby/StubbyBuddy";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { CityPicksRow } from "./CityPicksRow";

const DAY = 24 * 3_600_000;

/** What came back from an ask, in words. Counts go through plural() (style guide). */
export function askLine(added: number, asksLeft: number | null): string {
  const found = added > 0 ? `Added ${plural(added, "thing")} for you.` : WEEK_VIEW.askNone;
  return asksLeft === null ? found : `${found} ${plural(asksLeft, "ask")} left today.`;
}

/**
 * "This week in New York" plus a way to ask Stubby for something else. Stubby looks
 * on the web right then (stubby-scout, member mode, 3 asks a day); what he finds joins
 * this row for the person who asked, and the clean finds go live for everyone. He
 * thinks while he looks, stamps when he found something, shrugs when he didn't.
 * The row reloads on its own; the rest of the calendar is left alone.
 */
export function CityPicksSection({ picks }: { picks: readonly CityPick[] }) {
  const { user } = useAuth();
  const [shown, setShown] = useState<readonly CityPick[]>(picks);
  useEffect(() => setShown(picks), [picks]);
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<{ text: string; error: boolean } | null>(null);
  const buddy = useRef<StubbyBuddyHandle>(null);
  const id = useId();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setLine(null);
    const r = await askStubby(focus);
    if (r.error || !r.result) {
      setBusy(false);
      buddy.current?.react("tilt");
      setLine({ text: r.error ?? WEEK_VIEW.askNone, error: true });
      return;
    }
    const now = Date.now();
    const next = await fetchCityPicks(now, now + 7 * DAY, user?.id ?? null);
    setBusy(false);
    setShown(next);
    buddy.current?.react(r.result.added > 0 ? "stamped" : "shrug");
    setLine({ text: askLine(r.result.added, r.result.asksLeft), error: false });
    if (r.result.added > 0) setFocus("");
  };

  return (
    <div className="flex flex-col gap-4">
      <CityPicksRow picks={shown} />
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3 rounded-card border border-border bg-card p-4" aria-busy={busy}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lead">{WEEK_VIEW.askTitle}</h2>
            <label htmlFor={id} className="text-small text-muted-foreground">
              {WEEK_VIEW.askLabel}
            </label>
          </div>
          <StubbyBuddy ref={buddy} waiting={busy} className="shrink-0" />
        </div>
        <div className="flex flex-col gap-2 tab:flex-row">
          <Input id={id} value={focus} maxLength={120} placeholder={WEEK_VIEW.askHint} onChange={(e) => setFocus(e.target.value)} disabled={busy} className="tab:flex-1" />
          <Button type="submit" disabled={busy || !focus.trim()}>
            {busy ? WEEK_VIEW.askBusy : WEEK_VIEW.askButton}
          </Button>
        </div>
        <p aria-live="polite" className={line?.error ? "text-small text-destructive" : "text-small text-muted-foreground"}>
          {line?.text ?? ""}
        </p>
      </form>
    </div>
  );
}
