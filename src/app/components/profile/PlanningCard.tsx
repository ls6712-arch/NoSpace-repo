import { useState } from "react";
import { Link } from "react-router";
import { Lock } from "lucide-react";
import { fetchMyPlanning, savePlanning, setPlanningPaused, type AvailabilityBlock, type Day, type DayPart, type Membership, type PlanningPrefs } from "../../lib/profileApi";
import { availabilitySummary, budgetSummary, hoursSummary, membershipSummary } from "../../lib/profileFormat";
import { ERROR_LINE } from "../../lib/stateCopy";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { ErrorNotice } from "../StateViews";
import { notifyError } from "../ui/toaster";
import { cn } from "../ui/utils";
import { Skeleton } from "../ui/skeleton";
import { ResponsiveSheet } from "./ResponsiveSheet";
import { useSection } from "./useSection";

const DAYS: { key: Day; label: string }[] = [
  { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" }, { key: "wed", label: "Wed" }, { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" }, { key: "sat", label: "Sat" }, { key: "sun", label: "Sun" },
];
const PARTS: { key: DayPart; label: string }[] = [
  { key: "morning", label: "Morning" }, { key: "afternoon", label: "Afternoon" }, { key: "evening", label: "Evening" },
];

const PROMPT_KEY = "soosh.planningPromptDismissed";

function promptDismissed(): boolean {
  try {
    return localStorage.getItem(PROMPT_KEY) === "1";
  } catch {
    return false;
  }
}

type Row = "availability" | "hours" | "budget" | "memberships";

function EditSheet({ prefs, open, onOpenChange, onSaved }: { prefs: PlanningPrefs; open: boolean; onOpenChange: (o: boolean) => void; onSaved: (p: PlanningPrefs) => void }) {
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>(prefs.availability);
  const [hours, setHours] = useState(prefs.freeHoursPerWeek === null ? "" : String(prefs.freeHoursPerWeek));
  const [budget, setBudget] = useState(prefs.monthlyBudgetCents === null ? "" : String(prefs.monthlyBudgetCents / 100));
  const [memberships, setMemberships] = useState(prefs.memberships.map((m) => m.name).join(", "));
  const [share, setShare] = useState(prefs.shareMembershipsWithFriends);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const has = (day: Day, part: DayPart) => blocks.some((b) => b.day === day && b.part === part);
  const flip = (day: Day, part: DayPart) =>
    setBlocks((cur) => (has(day, part) ? cur.filter((b) => !(b.day === day && b.part === part)) : [...cur, { day, part }]));

  const save = async () => {
    setBusy(true);
    setError(null);
    const list: Membership[] = memberships
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
      .map((name) => ({ name: name.slice(0, 80), monthly_cost_cents: prefs.memberships.find((m) => m.name === name)?.monthly_cost_cents ?? 0 }));
    const next = {
      availability: blocks,
      freeHoursPerWeek: hours.trim() === "" ? null : Math.min(168, Number(hours)),
      monthlyBudgetCents: budget.trim() === "" ? null : Math.round(Number(budget) * 100),
      memberships: list,
      shareMembershipsWithFriends: share,
    };
    const r = await savePlanning(next);
    setBusy(false);
    if (!r.ok) {
      setError(ERROR_LINE);
      return;
    }
    onSaved({ ...prefs, ...next });
    onOpenChange(false);
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Your planning"
      footer={
        <Button className="min-h-11 w-full" disabled={busy} onClick={save}>
          Save changes
        </Button>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <fieldset className="min-w-0">
          <legend className="text-small font-semibold">Availability</legend>
          <p className="mb-2 text-caption text-muted-foreground">Pick the parts of the day you’re usually free.</p>
          <div className="flex flex-col gap-1.5">
            {DAYS.map((d) => (
              <div key={d.key} role="group" aria-label={d.label} className="grid grid-cols-[2.75rem_1fr_1fr_1fr] items-center gap-1.5">
                <span className="text-caption font-medium text-muted-foreground" aria-hidden="true">{d.label}</span>
                {PARTS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    aria-pressed={has(d.key, p.key)}
                    aria-label={`${d.label} ${p.key}`}
                    onClick={() => flip(d.key, p.key)}
                    className={cn("min-h-11 min-w-0 rounded-control border border-border px-1 text-caption focus-visible:ring-[3px] focus-visible:outline-1", has(d.key, p.key) && "border-accent bg-accent text-accent-foreground")}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </fieldset>
        <div>
          <Label htmlFor="plan-hours">Free time (hours a week)</Label>
          <Input id="plan-hours" inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value.replace(/\D/g, ""))} className="mt-1 min-h-11" />
        </div>
        <div>
          <Label htmlFor="plan-budget">Budget (dollars a month)</Label>
          <Input id="plan-budget" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))} className="mt-1 min-h-11" />
        </div>
        <div>
          <Label htmlFor="plan-memberships">Memberships & gear</Label>
          <Input id="plan-memberships" value={memberships} onChange={(e) => setMemberships(e.target.value)} className="mt-1 min-h-11" />
          <div className="mt-2 flex items-center justify-between gap-3">
            <Label htmlFor="plan-share" className="text-small">Friends see membership names when planning</Label>
            <Switch id="plan-share" checked={share} onCheckedChange={setShare} />
          </div>
        </div>
        {error && <p role="alert" className="text-small text-[var(--accent-text)]">{error}</p>}
      </div>
    </ResponsiveSheet>
  );
}

/** The owner-only planning card. Empty rows show a hint and an Add action. */
export function PlanningCard({ onPausedChange }: { onPausedChange?: (paused: boolean) => void }) {
  const { state, reload, set } = useSection(fetchMyPlanning, "planning");
  const [editing, setEditing] = useState<Row | null>(null);
  const [promptOff, setPromptOff] = useState(promptDismissed);

  if (state.status === "loading") return <Skeleton className="h-72 w-full rounded-card" />;
  if (state.status === "error") return <ErrorNotice onRetry={reload} />;
  const p = state.value;

  const togglePause = async (paused: boolean) => {
    set({ ...p, planningPaused: paused });
    onPausedChange?.(paused);
    const r = await setPlanningPaused(paused);
    if (!r.ok) {
      set(p);
      onPausedChange?.(p.planningPaused);
      notifyError(ERROR_LINE);
    }
  };

  const avail = availabilitySummary(p.availability);
  const hours = hoursSummary(p.freeHoursPerWeek);
  const budget = budgetSummary(p.monthlyBudgetCents);
  const members = membershipSummary(p.memberships);

  const row = (key: Row, title: string, value: string, note: string, hint: string) => (
    <li className="flex items-start justify-between gap-3 border-t border-border py-3 first:border-t-0">
      <div className="min-w-0">
        <p className="text-small font-semibold">{title}</p>
        <p className="text-small text-foreground">{value || hint}</p>
        {value && <p className="text-caption text-muted-foreground">{note}</p>}
      </div>
      <Button variant="outline" size="sm" className="min-h-11 shrink-0" onClick={() => setEditing(key)}>
        {value ? "Edit" : "Add"}
      </Button>
    </li>
  );

  return (
    <section aria-labelledby="planning-title" className="rounded-card bg-surface-muted p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 id="planning-title" className="font-[family-name:var(--font-display)] text-lead font-bold">Your planning</h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-caption font-medium">
          <Lock className="size-3" aria-hidden="true" />
          Only you see this
        </span>
      </div>
      {p.availability.length === 0 && !promptOff && (
        <div role="note" className="mb-1 mt-2 rounded-control bg-card p-3">
          <p className="text-small">Add when you’re usually free to get plan suggestions.</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" className="min-h-11" onClick={() => setEditing("availability")}>
              Add
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="min-h-11"
              onClick={() => {
                try {
                  localStorage.setItem(PROMPT_KEY, "1");
                } catch {
                  // Fine: it asks again next visit.
                }
                setPromptOff(true);
              }}
            >
              Not now
            </Button>
          </div>
        </div>
      )}
      <ul>
        {row("availability", "Availability", avail, "Friends: shared times only, when planning", "When you’re usually free, used to suggest times")}
        {row("hours", "Free time", hours, "Only you", "How many hours a week you can spare")}
        {row("budget", "Budget", budget, "Only you, never shared", "Only you see this, ever")}
        {row("memberships", "Memberships & gear", members, p.shareMembershipsWithFriends ? "Friends: names only" : "Only you", "Gyms, studios, classes you belong to")}
        <li className="border-t border-border py-3">
          <p className="text-small font-semibold">Calendar</p>
          <p className="text-small text-foreground">Not connected</p>
          <p className="text-caption text-muted-foreground">Free/busy only, never event details</p>
        </li>
      </ul>
      <div className="flex items-center justify-between gap-3 border-t border-border py-3">
        <div>
          <Label htmlFor="pause-planning" className="text-small font-semibold">Pause planning</Label>
          <p className="text-caption text-muted-foreground">Hide you from all suggestions and plans</p>
        </div>
        <Switch id="pause-planning" checked={p.planningPaused} onCheckedChange={togglePause} />
      </div>
      <Link to="/privacy/time" className="inline-flex min-h-11 items-center text-small font-medium text-accent-text underline-offset-4 hover:underline">
        Who can see my time
      </Link>
      {editing && <EditSheet key={editing} prefs={p} open onOpenChange={(o) => !o && setEditing(null)} onSaved={set} />}
    </section>
  );
}
