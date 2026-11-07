import { useMemo, useState } from "react";
import { Link } from "react-router";
import { SECTION_GAP } from "../../lib/pageGrid";
import {
  ACTIVITY_TABS,
  COST_LABEL,
  ENERGY_LABEL,
  WHO_LABEL,
  activitiesFor,
  doThisPath,
  durationLabel,
  inTab,
  type ActivityTabId,
} from "../../lib/cornerActivities";
import { TAB_LABELS } from "../../lib/discoverCorners";
import type { Activity } from "../../data/cornerActivities";

function Tag({ children }: { children: string }) {
  return <li className="rounded-full border border-border px-2.5 py-0.5 text-caption text-muted-foreground">{children}</li>;
}

function ActivityCard({ activity }: { activity: Activity }) {
  return (
    <li className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
      <h3 className="text-lead font-semibold">{activity.title}</h3>
      <p className="text-body text-muted-foreground">{activity.how}</p>
      <ul className="flex flex-wrap gap-1.5" aria-label="About this one">
        <Tag>{ENERGY_LABEL[activity.energy]}</Tag>
        {activity.who.map((w) => (
          <Tag key={w}>{WHO_LABEL[w]}</Tag>
        ))}
        <Tag>{COST_LABEL[activity.cost]}</Tag>
        <Tag>{durationLabel(activity)}</Tag>
      </ul>
      <p className="text-small">
        <span className="font-semibold">First step: </span>
        {activity.firstStep}
      </p>
      <Link
        to={doThisPath(activity)}
        className="mt-auto inline-flex min-h-11 items-center justify-center self-start rounded-control bg-[var(--accent)] px-5 text-small font-semibold text-accent-foreground"
      >
        Do this
      </Link>
    </li>
  );
}

/**
 * What to do inside a Corner (data/corner_activities.csv): At home, With people and At a place, each a list of cards, an
 * activity in every tab it fits. A tab with nothing in it is not shown. "Do this" opens the composer on this Corner with the
 * activity's prompt, and the Moment keeps the activity. Nothing when the Corner has no activities.
 */
export function CornerActivities({ cornerSlug, activities: given }: { cornerSlug: string; activities?: readonly Activity[] }) {
  const all = given ?? activitiesFor(cornerSlug);
  const tabs = useMemo(() => ACTIVITY_TABS.filter((t) => all.some((a) => inTab(a, t))), [all]);
  const [picked, setPicked] = useState<ActivityTabId | null>(null);
  if (all.length === 0 || tabs.length === 0) return null;
  const tab = picked && tabs.includes(picked) ? picked : tabs[0];
  const shown = all.filter((a) => inTab(a, tab));
  return (
    <section className={SECTION_GAP} id="corner-things-to-try" aria-labelledby="things-to-try-title">
      <h2 id="things-to-try-title" className="mb-4 text-title">
        Things to try
      </h2>
      {tabs.length > 1 && (
        <ul role="tablist" aria-label="Things to try" className="mb-5 flex gap-6">
          {tabs.map((t) => (
            <li key={t}>
              <button
                type="button"
                role="tab"
                id={`things-tab-${t}`}
                aria-selected={tab === t}
                aria-controls="things-panel"
                onClick={() => setPicked(t)}
                className={`min-h-11 border-b-2 text-small font-semibold transition-colors ${
                  tab === t ? "border-[var(--accent)] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {TAB_LABELS[t]}
              </button>
            </li>
          ))}
        </ul>
      )}
      <ul id="things-panel" role={tabs.length > 1 ? "tabpanel" : undefined} aria-labelledby={tabs.length > 1 ? `things-tab-${tab}` : undefined} className="grid items-start gap-4 tab:grid-cols-2 desk:grid-cols-3">
        {shown.map((a) => (
          <ActivityCard key={a.id} activity={a} />
        ))}
      </ul>
    </section>
  );
}
