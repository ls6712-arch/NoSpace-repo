import { useEffect, useState, type ReactNode } from "react";
import { HorizontalRow } from "../HorizontalRow";
import { Button } from "../ui/button";
import { notifyError } from "../ui/toaster";
import { PickCard } from "../stubby/StubbyResults";
import { fetchMyPicks, removeMyPick, type MyPick } from "../../lib/stubbyAsk";
import { cancelOwnPlan, createPlan } from "../../lib/planEdits";
import type { Owner } from "../../lib/firstPlanRemote";
import { announceChange } from "../../lib/undo";
import { ASK_COPY, CHANGED } from "../../lib/calendarCopy";
import { ERROR_LINE } from "../../lib/stateCopy";

/**
 * Stubby's picks on Discover: what he found when you asked him on Calendar, so they are not
 * only there. Each card is the same as in his deck, with Make it a plan under it. Nothing
 * saved, nothing shown: the whole section is left out, heading too.
 */
export function StubbyPicksRow({ owner, heading }: { owner: Owner; heading: ReactNode }) {
  const [picks, setPicks] = useState<MyPick[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    void fetchMyPicks().then((list) => live && setPicks(list));
    return () => {
      live = false;
    };
  }, [owner.id]);

  const drop = (id: number) => setPicks((list) => (list ?? []).filter((p) => p.id !== id));

  const makePlan = async (p: MyPick) => {
    setBusy(p.id);
    const r = await createPlan({ title: p.title, cornerKey: p.cornerKey ?? "", startsAt: p.startsAt }, owner);
    setBusy(null);
    if (r.sessionId === undefined) return notifyError(r.error ?? ERROR_LINE);
    drop(p.id);
    const sessionId = r.sessionId;
    announceChange(CHANGED.planMade, {
      undo: () => {
        setPicks((list) => [...(list ?? []), p].sort((a, b) => a.startsAt - b.startsAt));
        void cancelOwnPlan(sessionId, r.pursuitId).then((e) => e && notifyError(e));
      },
    });
  };

  const remove = async (p: MyPick) => {
    drop(p.id);
    const { error } = await removeMyPick(p.id);
    if (error) {
      setPicks((list) => [...(list ?? []), p].sort((a, b) => a.startsAt - b.startsAt));
      notifyError(error);
    }
  };

  if (!picks || picks.length === 0) return null;
  return (
    <section id="discover-stubby" aria-labelledby="stubby-title" className="scroll-mt-24">
      {heading}
      <HorizontalRow name="discover.stubby" label={ASK_COPY.listLabel} contentKey={picks.map((p) => p.id).join("|")}>
      {picks.map((p) => (
        <li key={p.id} className="flex w-[280px] shrink-0 snap-start flex-col gap-3 rounded-card border-[1.5px] border-dashed border-accent-text bg-card p-4">
          <PickCard pick={p} count={null} onRemove={() => void remove(p)} />
          <Button type="button" onClick={() => void makePlan(p)} disabled={busy === p.id} aria-busy={busy === p.id} className="mt-auto self-start">
            {ASK_COPY.makePlan}
          </Button>
        </li>
      ))}
      </HorizontalRow>
    </section>
  );
}
