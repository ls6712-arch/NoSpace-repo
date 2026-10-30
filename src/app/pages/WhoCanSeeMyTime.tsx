import { Link } from "react-router";
import { ChevronLeft } from "lucide-react";
import { fetchMyPlanning, savePlanning, setPlanningPaused, type PlanningPrefs } from "../lib/profileApi";
import { SettingsShell } from "../components/settings/SettingsShell";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { ErrorNotice } from "../components/StateViews";
import { Skeleton } from "../components/ui/skeleton";
import { notifyError } from "../components/ui/toaster";
import { ERROR_LINE } from "../lib/stateCopy";
import { useSection } from "../components/profile/useSection";

/** Every time-related field and who sees it, with the toggles that exist. */
export function WhoCanSeeMyTime() {
  const { state, reload, set } = useSection(fetchMyPlanning, "planning");

  const body = () => {
    if (state.status === "loading") return <Skeleton className="h-64 w-full rounded-card" />;
    if (state.status === "error") return <ErrorNotice onRetry={reload} />;
    const p: PlanningPrefs = state.value;

    const togglePause = async (paused: boolean) => {
      set({ ...p, planningPaused: paused });
      const r = await setPlanningPaused(paused);
      if (!r.ok) {
        set(p);
        notifyError(ERROR_LINE);
      }
    };
    const toggleShare = async (share: boolean) => {
      set({ ...p, shareMembershipsWithFriends: share });
      const r = await savePlanning({
        availability: p.availability,
        freeHoursPerWeek: p.freeHoursPerWeek,
        monthlyBudgetCents: p.monthlyBudgetCents,
        memberships: p.memberships,
        shareMembershipsWithFriends: share,
      });
      if (!r.ok) {
        set(p);
        notifyError(ERROR_LINE);
      }
    };

    const line = "flex items-start justify-between gap-4 border-t border-border py-4 first:border-t-0";
    return (
      <ul className="rounded-card border border-border bg-card px-4">
        <li className={line}>
          <div>
            <p className="text-small font-semibold">Availability</p>
            <p className="text-caption text-muted-foreground">Friends see shared times only, when planning. Never your full schedule.</p>
          </div>
        </li>
        <li className={line}>
          <div>
            <p className="text-small font-semibold">Free time</p>
            <p className="text-caption text-muted-foreground">Only you</p>
          </div>
        </li>
        <li className={line}>
          <div>
            <p className="text-small font-semibold">Budget</p>
            <p className="text-caption text-muted-foreground">Only you, never shared</p>
          </div>
        </li>
        <li className={line}>
          <div>
            <Label htmlFor="share-memberships" className="text-small font-semibold">Memberships & gear</Label>
            <p className="text-caption text-muted-foreground">
              {p.shareMembershipsWithFriends ? "Friends: names only, when planning" : "Only you"}
            </p>
          </div>
          <Switch id="share-memberships" checked={p.shareMembershipsWithFriends} onCheckedChange={toggleShare} />
        </li>
        <li className={line}>
          <div>
            <p className="text-small font-semibold">Calendar</p>
            <p className="text-caption text-muted-foreground">Not connected. Free/busy only, never event details.</p>
          </div>
        </li>
        <li className={line}>
          <div>
            <Label htmlFor="pause-planning-settings" className="text-small font-semibold">Pause planning</Label>
            <p className="text-caption text-muted-foreground">Hide you from all suggestions and plans</p>
          </div>
          <Switch id="pause-planning-settings" checked={p.planningPaused} onCheckedChange={togglePause} />
        </li>
      </ul>
    );
  };

  return (
    <SettingsShell activeKey="privacy">
      <Link to="/you" className="mb-3 inline-flex min-h-11 items-center gap-1 text-small text-accent-text">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Back
      </Link>
      <h2 className="mb-4 font-[family-name:var(--font-display)] text-title font-bold">Who can see my time</h2>
      {body()}
    </SettingsShell>
  );
}
