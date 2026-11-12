import { CORNER_ACTIVITIES, type Activity, type ActivityCost, type ActivityEnergy, type ActivityWho } from "../data/cornerActivities";
import { activityDurationMinutes } from "../config";
import { formatDuration } from "./dates";

/**
 * The activities for a Corner (data/corner_activities.csv, approved content), by the Corner's slug. A slug is
 * one Corner everywhere (the three that sit in two Spaces are not among the activity Corners), so the Space is not
 * part of the lookup; the generator already put each activity on the Space the Corner sits under.
 */
const BY_CORNER = new Map<string, Activity[]>();
const BY_ID = new Map<string, Activity>();
for (const a of CORNER_ACTIVITIES) {
  BY_CORNER.set(a.cornerSlug, [...(BY_CORNER.get(a.cornerSlug) ?? []), a]);
  BY_ID.set(a.id, a);
}

export const activitiesFor = (cornerSlug: string): readonly Activity[] => BY_CORNER.get(cornerSlug) ?? [];
export const activityById = (id: string | null | undefined): Activity | undefined => (id ? BY_ID.get(id) : undefined);
export const hasActivities = (cornerSlug: string): boolean => BY_CORNER.has(cornerSlug);
/** The Corners that have activities (slug). */
export const cornersWithActivities = (): string[] => [...BY_CORNER.keys()];

export type ActivityTabId = "home" | "people" | "place";
export const ACTIVITY_TABS: readonly ActivityTabId[] = ["home", "people", "place"];

/** At home: where is home. With people: a friend or a group. At a place: outside or at a place. An activity can be in more than one. */
export function inTab(a: Activity, tab: ActivityTabId): boolean {
  if (tab === "home") return a.where === "home";
  if (tab === "people") return a.who.includes("friend") || a.who.includes("group");
  return a.where === "outside" || a.where === "place";
}

export const ENERGY_LABEL: Record<ActivityEnergy, string> = { low: "Low energy", medium: "Medium energy", high: "High energy" };
export const WHO_LABEL: Record<ActivityWho, string> = { solo: "Solo", friend: "With a friend", group: "With a group" };
export const COST_LABEL: Record<ActivityCost, string> = { free: "Free", low: "Low cost", treat: "Treat" };
/** "15 min", "1 hr", "3 hr": the same words as a Corner's meta line (dates.ts formatDuration). */
export const durationLabel = (a: Activity): string => formatDuration(activityDurationMinutes[a.duration]);

/** "Try this": the composer with the Corner set and the activity remembered (its prompt shows there, its id is saved on the Moment). */
export function tryThisPath(a: Activity): string {
  return `/create?hobby=${encodeURIComponent(a.spaceSlug)}&sub=${encodeURIComponent(a.cornerSlug)}&activity=${encodeURIComponent(a.id)}`;
}

/** The activity a composer link asks for, only when it exists and belongs to the Corner the composer is on. */
export function activityFromParams(params: URLSearchParams, cornerSlug: string): Activity | undefined {
  const a = activityById(params.get("activity"));
  return a && a.cornerSlug === cornerSlug ? a : undefined;
}
