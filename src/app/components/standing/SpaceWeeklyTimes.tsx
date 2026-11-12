import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { InlineError } from "../StateViews";
import { StandingSlotForm } from "./StandingSlotForm";
import { SPEND_LABEL } from "../discover/IdeaPills";
import {
  BLANK_SLOT,
  SLOT_COPY,
  deleteSlot,
  fetchSlots,
  saveSlot,
  slotWhen,
  toInput,
  verifySlot,
  type StandingSlot,
} from "../../lib/standingSlots";
import { ConfirmDialog } from "../ConfirmDialog";

/**
 * A Space's weekly times ("Every Thursday, 7:00 PM"), for its hosts only. Each is saved with
 * this Space's id, which is the only kind of weekly time a host may write (database policy).
 * Reuses the same form as the admin screen.
 */
export function SpaceWeeklyTimes({ spaceId, city }: { spaceId: string; city?: string | null }) {
  const [slots, setSlots] = useState<StandingSlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id?: number; slot: StandingSlot | null } | null>(null);
  const [deleting, setDeleting] = useState<StandingSlot | null>(null);

  const load = async () => {
    const r = await fetchSlots(spaceId);
    setSlots(r.slots);
    setError(r.error);
  };
  useEffect(() => {
    void load();
  }, [spaceId]);

  // New York is the only city with weekly times for now.
  if (city && !/new york|brooklyn|queens|bronx|manhattan|staten island/i.test(city)) return null;

  return (
    <section aria-labelledby="weekly-times" className="flex flex-col gap-3">
      <div>
        <h2 id="weekly-times" className="text-lead font-bold" style={{ fontFamily: "var(--font-display)" }}>
          {SLOT_COPY.spaceTitle}
        </h2>
        <p className="text-small text-muted-foreground">{SLOT_COPY.spaceLine}</p>
      </div>
      {error && <InlineError message={error} />}
      {editing ? (
        <StandingSlotForm
          key={editing.id ?? "new"}
          initial={editing.slot ? toInput(editing.slot) : BLANK_SLOT}
          title={editing.id === undefined ? SLOT_COPY.add : SLOT_COPY.edit}
          onCancel={() => setEditing(null)}
          onSave={async (input) => {
            const r = await saveSlot(input, { id: editing.id, spaceId });
            if (r.error) return r.error;
            setEditing(null);
            await load();
            return null;
          }}
        />
      ) : (
        <Button className="self-start" variant="outline" onClick={() => setEditing({ slot: null })}>
          {SLOT_COPY.add}
        </Button>
      )}
      {slots.length === 0 && !editing && <p className="text-small text-muted-foreground">{SLOT_COPY.spaceEmpty}</p>}
      <ul className="flex flex-col gap-3">
        {slots.map((s) => (
          <li key={s.id} className="flex flex-col gap-2 rounded-card border border-border bg-card p-4">
            <p className="text-body font-semibold">{s.title}</p>
            <p className="text-small text-muted-foreground">{[slotWhen(s), s.placeName, SPEND_LABEL[s.spend], s.active ? null : SLOT_COPY.off].filter(Boolean).join(" · ")}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={async () => { const r = await verifySlot(s.id); if (r.error) setError(r.error); else await load(); }}>
                {SLOT_COPY.verifiedToday}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing({ id: s.id, slot: s })}>
                Edit
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDeleting(s)}>
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.title ?? ""}”?`}
        description={SLOT_COPY.deleteBody}
        onConfirm={async () => {
          if (!deleting) return;
          const r = await deleteSlot(deleting.id);
          if (r.error) setError(r.error);
          setDeleting(null);
          if (!r.error) await load();
        }}
      />
    </section>
  );
}
