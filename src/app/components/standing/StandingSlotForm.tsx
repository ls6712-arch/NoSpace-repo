import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useCorners } from "../../context/CornersContext";
import { SPEND_LABEL } from "../discover/IdeaPills";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { SLOT_COPY, slotProblem, weekdayName, type SlotInput, type SlotMode } from "../../lib/standingSlots";
import type { IdeaSpend } from "../../data/cornerIdeas";

function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-small font-semibold">
        {label}
        {hint && <span className="ml-2 font-normal text-muted-foreground">{hint}</span>}
      </Label>
      {children(id)}
    </div>
  );
}

const selectClass = "h-11 w-full rounded-control border border-border bg-background px-3 text-body";

/**
 * Add or edit one weekly time. Shared by the admin screen and a Space's host panel, so the
 * same fields and the same checks (slotProblem) apply in both. `onSave` returns an error
 * message, or null when it saved.
 */
export function StandingSlotForm({
  initial,
  title,
  onSave,
  onCancel,
}: {
  initial: SlotInput;
  title: string;
  onSave: (input: SlotInput) => Promise<string | null>;
  onCancel: () => void;
}) {
  const { allCorners } = useCorners();
  const [input, setInput] = useState(initial);
  const [cornerText, setCornerText] = useState(() => allCorners.find((c) => c.slug === initial.cornerSlug)?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof SlotInput>(k: K, v: SlotInput[K]) => setInput((i) => ({ ...i, [k]: v }));

  const pickCorner = (text: string) => {
    setCornerText(text);
    const hit = allCorners.find((c) => c.name.toLowerCase() === text.trim().toLowerCase());
    set("cornerSlug", hit?.slug ?? "");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const problem = slotProblem(input);
    if (problem) return setError(problem);
    setBusy(true);
    const err = await onSave(input);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4 rounded-card border border-border bg-card p-4">
      <h2 className="text-lead font-bold" style={{ fontFamily: "var(--font-display)" }}>
        {title}
      </h2>
      <Field label="Corner" hint="Start typing a name">
        {(id) => (
          <>
            <Input id={id} list={`${id}-corners`} value={cornerText} onChange={(e) => pickCorner(e.target.value)} />
            <datalist id={`${id}-corners`}>
              {[...new Map(allCorners.map((c) => [c.slug, c.name])).entries()].map(([slug, name]) => (
                <option key={slug} value={name} />
              ))}
            </datalist>
          </>
        )}
      </Field>
      <Field label="Title" hint="80 characters at most">
        {(id) => <Input id={id} value={input.title} maxLength={80} onChange={(e) => set("title", e.target.value)} />}
      </Field>
      <div className="grid gap-4 tab:grid-cols-2">
        <Field label="Place">{(id) => <Input id={id} value={input.placeName} maxLength={80} onChange={(e) => set("placeName", e.target.value)} />}</Field>
        <Field label="Neighborhood">{(id) => <Input id={id} value={input.area} maxLength={60} onChange={(e) => set("area", e.target.value)} />}</Field>
      </div>
      <div className="grid gap-4 tab:grid-cols-3">
        <Field label="Day">
          {(id) => (
            <select id={id} className={selectClass} value={input.weekday} onChange={(e) => set("weekday", Number(e.target.value))}>
              {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                <option key={d} value={d}>
                  {weekdayName(d)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Starts" hint="New York time">
          {(id) => <Input id={id} type="time" value={input.startTime} onChange={(e) => set("startTime", e.target.value)} />}
        </Field>
        <Field label="Ends" hint="Optional">
          {(id) => <Input id={id} type="time" value={input.endTime} onChange={(e) => set("endTime", e.target.value)} />}
        </Field>
      </div>
      <div className="grid gap-4 tab:grid-cols-2">
        <Field label="Spend">
          {(id) => (
            <select id={id} className={selectClass} value={input.spend} onChange={(e) => set("spend", e.target.value as IdeaSpend)}>
              {(Object.keys(SPEND_LABEL) as IdeaSpend[]).map((s) => (
                <option key={s} value={s}>
                  {SPEND_LABEL[s]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="You can">
          {(id) => (
            <select id={id} className={selectClass} value={input.mode} onChange={(e) => set("mode", e.target.value as SlotMode)}>
              <option value="do">Take part</option>
              <option value="watch">Watch</option>
            </select>
          )}
        </Field>
      </div>
      <Field label="Link" hint="Starts with https://. Optional">
        {(id) => <Input id={id} type="url" value={input.sourceUrl} maxLength={500} onChange={(e) => set("sourceUrl", e.target.value)} />}
      </Field>
      <label className="flex min-h-11 items-center gap-3 text-small">
        <input type="checkbox" checked={input.active} onChange={(e) => set("active", e.target.checked)} className="size-5" />
        <span>{input.active ? "On" : SLOT_COPY.off}</span>
      </label>
      {error && (
        <p role="alert" className="text-small text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          Save changes
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
