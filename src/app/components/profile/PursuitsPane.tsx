import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { createPursuit, deletePursuit, fetchMoments, fetchPursuits, setPursuitArchived, setPursuitFinished, type OwnerMoment, type PursuitItem } from "../../lib/profileApi";
import { momentAlt, momentTitle, ownerMomentMeta, pursuitFraction, pursuitStatus } from "../../lib/profileFormat";
import { Button } from "../ui/button";
import { ImageWithFallback } from "../ImageWithFallback";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ConfirmDialog } from "../ConfirmDialog";
import { ErrorNotice } from "../StateViews";
import { notifyError } from "../ui/toaster";
import { ERROR_LINE } from "../../lib/stateCopy";
import { cn } from "../ui/utils";
import { ListSkeleton } from "./Skeletons";
import { ResponsiveSheet } from "./ResponsiveSheet";
import { useSection } from "./useSection";

export const DEFAULT_CATEGORIES = ["Climbing", "Pottery", "Cooking", "Board games", "Running", "Museums", "Live music", "Yoga"];

function Bar({ fraction }: { fraction: number }) {
  const pct = Math.round(fraction * 100);
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Pursuit progress" className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Card({ p, owner, onOpen }: { p: PursuitItem; owner: boolean; onOpen?: () => void }) {
  const frac = pursuitFraction(p);
  const body = (
    <>
      <p className="text-caption font-medium text-muted-foreground">{p.category}</p>
      <p className="text-body font-semibold">{p.goal}</p>
      {frac !== null && !p.finished && <Bar fraction={frac} />}
      <p className="mt-2 flex items-center gap-1 text-small text-muted-foreground">
        {p.finished && <Check className="size-4 text-foreground" aria-hidden="true" />}
        {pursuitStatus(p, owner ? "owner" : "other")}
      </p>
      {!owner && p.sharedWithYou && (
        <p className="mt-2 inline-block rounded-full bg-surface-muted px-2.5 py-1 text-caption font-medium">You do this too</p>
      )}
    </>
  );
  const cls = "block w-full rounded-card border border-border bg-card p-4 text-left";
  return owner && onOpen ? (
    <button type="button" onClick={onOpen} className={cn(cls, "min-h-11 focus-visible:ring-[3px] focus-visible:outline-1")}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function DetailSheet({
  profileId,
  pursuit,
  onClose,
  onToggle,
  onArchive,
  onDelete,
}: {
  profileId: string;
  pursuit: PursuitItem | null;
  onClose: () => void;
  onToggle: (p: PursuitItem) => void;
  onArchive: (p: PursuitItem) => void;
  onDelete: (p: PursuitItem) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <ResponsiveSheet
        open={pursuit !== null}
        onOpenChange={(o) => !o && onClose()}
        title={pursuit?.goal ?? "Pursuit"}
        footer={
          pursuit && (
            <div className="flex flex-col gap-2">
              <Button variant={pursuit.finished ? "outline" : "default"} className="min-h-11 w-full" onClick={() => onToggle(pursuit)}>
                {pursuit.finished ? "Reopen" : "Finish"}
              </Button>
              <Button variant="outline" className="min-h-11 w-full" onClick={() => onArchive(pursuit)}>
                {pursuit.archived ? "Unarchive" : "Archive"}
              </Button>
              <Button variant="ghost" className="min-h-11 w-full text-[var(--accent-text)]" onClick={() => setConfirming(true)}>
                Delete
              </Button>
            </div>
          )
        }
      >
        {pursuit && <DetailMoments profileId={profileId} pursuit={pursuit} />}
      </ResponsiveSheet>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete this Pursuit?"
        description="Its Stubs go with it. Its Moments stay. To keep the Stubs, archive it instead."
        confirmLabel="Delete"
        onConfirm={() => {
          if (pursuit) onDelete(pursuit);
          setConfirming(false);
        }}
      />
    </>
  );
}

function DetailMoments({ profileId, pursuit }: { profileId: string; pursuit: PursuitItem }) {
  const { state, reload } = useSection(async () => {
    const r = await fetchMoments(profileId, 100, 0, pursuit.id);
    return r.ok ? { ok: true as const, value: r.value.items as OwnerMoment[] } : r;
  }, pursuit.id);
  if (state.status === "loading") return <ListSkeleton />;
  if (state.status === "error") return <ErrorNotice onRetry={reload} />;
  if (state.value.length === 0) return <p className="py-4 text-small text-muted-foreground">No Moments yet</p>;
  return (
    <ul className="flex flex-col gap-2 pb-2">
      {state.value.map((m) => (
        <li key={m.id} className="flex items-center gap-3 rounded-control border border-border p-2">
          <ImageWithFallback src={m.photoUrl} alt={momentAlt(m)} width={96} className="size-12 shrink-0 rounded-control" />
          <div className="min-w-0">
            <p className="truncate text-small font-semibold">{momentTitle(m)}</p>
            <p className="text-caption text-muted-foreground">{ownerMomentMeta(m)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function CreateSheet({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const [category, setCategory] = useState("");
  const [goal, setGoal] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetNum = target.trim() === "" ? null : Number(target);
  const valid = category.trim() !== "" && (targetNum === null || (Number.isInteger(targetNum) && targetNum >= 1 && targetNum <= 1000));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const r = await createPursuit(category.trim(), goal.trim(), targetNum);
    setBusy(false);
    if (!r.ok) {
      setError(ERROR_LINE);
      return;
    }
    setCategory("");
    setGoal("");
    setTarget("");
    onOpenChange(false);
    onCreated();
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Start a Pursuit"
      footer={
        <Button className="min-h-11 w-full" disabled={!valid || busy} onClick={submit}>
          Start a Pursuit
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <div>
          <Label htmlFor="pursuit-category">Category</Label>
          <Input id="pursuit-category" value={category} maxLength={60} onChange={(e) => setCategory(e.target.value)} className="mt-1 min-h-11" />
          <div className="mt-2 flex flex-wrap gap-2">
            {DEFAULT_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
                className={cn("min-h-11 rounded-full border border-border px-4 text-small focus-visible:ring-[3px] focus-visible:outline-1", category === c && "border-accent bg-accent text-accent-foreground")}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="pursuit-goal">Goal</Label>
          <Input id="pursuit-goal" value={goal} maxLength={60} onChange={(e) => setGoal(e.target.value)} className="mt-1 min-h-11" />
        </div>
        <div>
          <Label htmlFor="pursuit-target">Number of Moments (optional)</Label>
          <Input id="pursuit-target" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value.replace(/\D/g, ""))} className="mt-1 min-h-11" />
        </div>
        {error && <p role="alert" className="text-small text-[var(--accent-text)]">{error}</p>}
      </div>
    </ResponsiveSheet>
  );
}

export function PursuitsPane({ profileId, owner, onChanged }: { profileId: string; owner: boolean; onChanged?: () => void }) {
  const { state, reload, set } = useSection(() => fetchPursuits(profileId), profileId);
  const [filter, setFilter] = useState<"active" | "finished" | "archived">("active");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (state.status === "loading") return <ListSkeleton />;
  if (state.status === "error") return <ErrorNotice onRetry={reload} />;

  const list = state.value;
  const active = list.filter((p) => !p.finished && !p.archived);
  const finished = list.filter((p) => p.finished && !p.archived);
  const archived = list.filter((p) => p.archived);
  const shown = filter === "active" ? active : filter === "finished" ? finished : archived;
  const open = list.find((p) => p.id === openId) ?? null;

  // Optimistic: flip it now, put it back if the save fails.
  const toggle = async (p: PursuitItem) => {
    const before = list;
    const next = !p.finished;
    set(list.map((x) => (x.id === p.id ? { ...x, finished: next, finishedAt: next ? new Date().toISOString().slice(0, 10) : null } : x)));
    setOpenId(null);
    const r = await setPursuitFinished(p.id, next);
    if (!r.ok) {
      set(before);
      notifyError(ERROR_LINE);
      return;
    }
    onChanged?.();
    void reload();
  };

  const archive = async (p: PursuitItem) => {
    const before = list;
    set(list.map((x) => (x.id === p.id ? { ...x, archived: !p.archived } : x)));
    setOpenId(null);
    const r = await setPursuitArchived(p.id, !p.archived);
    if (!r.ok) {
      set(before);
      notifyError(ERROR_LINE);
      return;
    }
    onChanged?.();
  };

  const remove = async (p: PursuitItem) => {
    const before = list;
    set(list.filter((x) => x.id !== p.id));
    setOpenId(null);
    const r = await deletePursuit(p.id);
    if (!r.ok) {
      set(before);
      notifyError(ERROR_LINE);
      return;
    }
    onChanged?.();
  };

  const pill = (key: "active" | "finished" | "archived", label: string, n: number) => (
    <button
      type="button"
      aria-pressed={filter === key}
      onClick={() => setFilter(key)}
      className={cn("min-h-11 rounded-full border border-border px-4 text-small font-medium focus-visible:ring-[3px] focus-visible:outline-1", filter === key && "border-accent bg-accent text-accent-foreground")}
    >
      {label} · {n}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {pill("active", "Active", active.length)}
        {pill("finished", "Finished", finished.length)}
        {owner && archived.length > 0 && pill("archived", "Archived", archived.length)}
      </div>
      {shown.length === 0 ? (
        <p className="py-2 text-small text-muted-foreground">{filter === "active" ? "No active Pursuits" : filter === "finished" ? "Nothing finished yet" : "Nothing archived"}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((p) => (
            <li key={p.id}>
              <Card p={p} owner={owner} onOpen={() => setOpenId(p.id)} />
            </li>
          ))}
        </ul>
      )}
      {owner && (
        <>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-card border-2 border-dashed border-border text-small font-semibold focus-visible:ring-[3px] focus-visible:outline-1"
          >
            <Plus className="size-4" aria-hidden="true" />
            Start a Pursuit
          </button>
          <DetailSheet profileId={profileId} pursuit={open} onClose={() => setOpenId(null)} onToggle={toggle} onArchive={archive} onDelete={remove} />
          <CreateSheet
            open={creating}
            onOpenChange={setCreating}
            onCreated={() => {
              void reload();
              onChanged?.();
            }}
          />
        </>
      )}
    </div>
  );
}
