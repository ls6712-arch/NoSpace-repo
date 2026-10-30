import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, MapPin } from "lucide-react";
import { sendPlanInvite, suggestPlan, type PlanSlot, type PlanSuggestion } from "../../lib/profileApi";
import { slotDay, slotPart } from "../../lib/profileFormat";
import { ERROR_LINE } from "../../lib/stateCopy";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Skeleton } from "../ui/skeleton";
import { ErrorNotice } from "../StateViews";
import { notify } from "../ui/toaster";
import { cn } from "../ui/utils";
import { ResponsiveSheet } from "./ResponsiveSheet";

const SOMETHING_NEW = "Something new";

export function PlanTogetherSheet({
  open,
  onOpenChange,
  friendId,
  firstName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  friendId: string;
  firstName: string;
}) {
  const [category, setCategory] = useState<string | null>(null);
  const [result, setResult] = useState<PlanSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [slot, setSlot] = useState<PlanSlot | null>(null);
  const [elsewhere, setElsewhere] = useState(false);
  const [place, setPlace] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const run = useRef(0);

  const load = useCallback(
    async (cat: string | null) => {
      const mine = ++run.current;
      setLoading(true);
      setFailed(false);
      const r = await suggestPlan(friendId, cat && cat !== SOMETHING_NEW ? cat : null);
      if (mine !== run.current) return;
      setLoading(false);
      if (!r.ok) {
        setFailed(true);
        return;
      }
      setResult(r.value);
      setSlot((cur) => (r.value.status === "ok" && cur && r.value.slots.some((s) => s.date === cur.date && s.part === cur.part) ? cur : null));
    },
    [friendId],
  );

  useEffect(() => {
    if (open) void load(category);
    // The category is chosen inside the sheet; opening again starts fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, load]);

  const pick = (c: string) => {
    setCategory(c);
    void load(c);
  };

  const ok = result?.status === "ok" ? result : null;
  const suggestedPlace = ok?.place ?? null;
  const placeName = elsewhere ? place.trim() || null : suggestedPlace?.name ?? null;

  const send = async (withSlot: PlanSlot | null) => {
    setSending(true);
    setSendError(null);
    const r = await sendPlanInvite(friendId, category, withSlot, placeName);
    setSending(false);
    if (!r.ok) {
      setSendError(ERROR_LINE);
      return;
    }
    onOpenChange(false);
    notify(`Invite sent to ${firstName}`);
  };

  const noSlots = ok !== null && ok.slots.length === 0;

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Plan with ${firstName}`}
      footer={
        <div className="flex flex-col gap-2">
          {noSlots ? (
            <Button className="min-h-11 w-full" disabled={sending} onClick={() => send(null)}>
              Send an open invite
            </Button>
          ) : (
            <Button className="min-h-11 w-full" disabled={!slot || sending} onClick={() => send(slot)}>
              Send invite
            </Button>
          )}
          <p className="text-center text-caption text-muted-foreground">{firstName} sees the plan, not who suggested which time.</p>
          {sendError && <p role="alert" className="text-center text-small text-[var(--coral-text)]">{sendError}</p>}
        </div>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        {loading && !result ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : failed ? (
          <ErrorNotice onRetry={() => load(category)} />
        ) : result?.status === "unavailable" ? (
          <p className="py-4 text-small text-muted-foreground">{firstName} isn’t taking plans right now</p>
        ) : ok ? (
          <>
            <section aria-labelledby="plan-what">
              <h3 id="plan-what" className="mb-2 text-small font-semibold">Do what?</h3>
              <div className="flex flex-wrap gap-2">
                {ok.categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={category === c}
                    onClick={() => pick(c)}
                    className={cn("min-h-11 rounded-full border border-border px-4 text-small focus-visible:ring-[3px] focus-visible:outline-1", category === c && "border-accent bg-accent text-accent-foreground")}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </section>

            <section aria-labelledby="plan-when">
              <h3 id="plan-when" className="mb-2 text-small font-semibold">When you’re both free</h3>
              {noSlots ? (
                <p className="text-small text-muted-foreground">No shared times in the next 2 weeks.</p>
              ) : (
                <div role="radiogroup" aria-labelledby="plan-when" className="flex flex-col gap-2">
                  {ok.slots.map((s) => {
                    const on = slot?.date === s.date && slot.part === s.part;
                    return (
                      <button
                        key={`${s.date}-${s.part}`}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setSlot(s)}
                        className={cn("min-h-11 rounded-card border border-border p-3 text-left focus-visible:ring-[3px] focus-visible:outline-1", on && "border-accent bg-surface-muted")}
                      >
                        <span className="block text-small font-semibold">{slotDay(s)}</span>
                        <span className="block text-caption text-muted-foreground">{slotPart(s)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="mt-2 flex items-start gap-1.5 text-caption text-muted-foreground">
                <Lock className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                Picked from both your schedules. Neither of you sees the other’s full availability.
              </p>
            </section>

            {(suggestedPlace || elsewhere) && (
              <section aria-labelledby="plan-where">
                <h3 id="plan-where" className="mb-2 text-small font-semibold">Where</h3>
                {elsewhere ? (
                  <Input aria-label="Where" value={place} maxLength={80} onChange={(e) => setPlace(e.target.value)} className="min-h-11" />
                ) : (
                  suggestedPlace && (
                    <div className="flex items-start gap-2 rounded-card border border-border p-3">
                      <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <div>
                        <p className="text-small font-semibold">{suggestedPlace.name}</p>
                        <p className="text-caption text-muted-foreground">{suggestedPlace.note}</p>
                      </div>
                    </div>
                  )
                )}
                {!elsewhere && (
                  <button type="button" onClick={() => setElsewhere(true)} className="mt-1 inline-flex min-h-11 items-center text-small font-medium text-accent-text underline-offset-4 hover:underline">
                    Suggest somewhere else
                  </button>
                )}
              </section>
            )}
          </>
        ) : null}
      </div>
    </ResponsiveSheet>
  );
}
