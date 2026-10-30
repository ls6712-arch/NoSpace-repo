import { supabase } from "../../lib/supabase";

/**
 * Profile reads. The database builds a different shape for each kind of viewer
 * (public.get_profile and friends), so a field a viewer may not see is never in
 * the response. These types mirror those shapes: one per role, no optional
 * "maybe hidden" fields.
 */
export type FollowState = "none" | "pending" | "accepted" | "declined";

export interface MutualFriend {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface Identity {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  followState: FollowState;
}

interface Open extends Identity {
  private: false;
  neighborhood: string | null;
  bio: string | null;
  stubCount: number;
  pursuitCount: number;
  friendCount: number;
  level: { index: number; name: string };
}

export interface OwnerProfile extends Open {
  role: "owner";
  stubsToNext: number | null;
  planningPaused: boolean;
  isPrivate: boolean;
}
export interface FriendProfile extends Open {
  role: "friend";
  followsYou: boolean;
  planningPaused: boolean;
  mutualFriends: MutualFriend[];
  mutualFriendCount: number;
  sharedCategories: string[];
}
export interface FollowerProfile extends Open {
  role: "follower";
  followsYou: boolean;
  mutualFriendCount: number;
}
export interface PublicProfile extends Open {
  role: "public";
  followsYou: boolean;
}
export interface ClosedProfile extends Identity {
  role: "public";
  private: true;
  levelName: string;
}

export type ProfileDto = OwnerProfile | FriendProfile | FollowerProfile | PublicProfile | ClosedProfile;
export type OpenProfileDto = Exclude<ProfileDto, ClosedProfile>;

export function isClosed(p: ProfileDto): p is ClosedProfile {
  return p.private;
}

/** Owner Moment: everything. */
export interface OwnerMoment {
  id: number;
  photoUrl: string | null;
  caption: string | null;
  category: string | null;
  occurredAt: string;
  placeName: string | null;
  neighborhood: string | null;
  /** Set while the Moment is inside its 2 hour delay. */
  visibleAt: string | null;
}
/** Everyone else: the day and neighborhood, never the time or exact place. */
export interface SharedMoment {
  id: number;
  photoUrl: string | null;
  caption: string | null;
  category: string | null;
  /** YYYY-MM-DD. */
  date: string;
  neighborhood: string | null;
}
export interface MomentPage<T> {
  total: number;
  items: T[];
}

export interface StubItem {
  id: number;
  /** Owner only. */
  date: string | null;
  /** YYYY-MM-DD. */
  day: string;
  title: string | null;
  category: string | null;
}

export interface PursuitItem {
  id: string;
  category: string;
  goal: string;
  target: number | null;
  momentCount: number;
  stubCount: number;
  finished: boolean;
  /** Owner only. */
  lastMomentDate: string | null;
  /** Owner: YYYY-MM-DD. Others: YYYY-MM. */
  finishedAt: string | null;
  sharedWithYou: boolean;
}

export interface Membership {
  name: string;
  monthly_cost_cents: number;
}
export type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type DayPart = "morning" | "afternoon" | "evening";
export interface AvailabilityBlock {
  day: Day;
  part: DayPart;
}
export interface PlanningPrefs {
  availability: AvailabilityBlock[];
  freeHoursPerWeek: number | null;
  monthlyBudgetCents: number | null;
  memberships: Membership[];
  shareMembershipsWithFriends: boolean;
  calendarConnected: boolean;
  planningPaused: boolean;
}

export interface PlanSlot {
  /** YYYY-MM-DD. */
  date: string;
  part: DayPart;
}
export type PlanSuggestion =
  | { status: "unavailable" }
  | { status: "ok"; slots: PlanSlot[]; categories: string[]; place?: { name: string; note: string } };

export type ProfileResult<T> = { ok: true; value: T } | { ok: false; message: string };

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<ProfileResult<T>> {
  if (!supabase) return { ok: false, message: "Couldn’t load this. Try again." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, message: error.message };
  return { ok: true, value: data as T };
}

/** Null when there is no such profile, or either side blocked the other (the page shows the 404). */
export async function fetchProfile(username: string): Promise<ProfileResult<ProfileDto | null>> {
  return rpc<ProfileDto | null>("get_profile", { p_username: username });
}
export function fetchMoments(profileId: string, limit: number, offset: number, owner: true): Promise<ProfileResult<MomentPage<OwnerMoment>>>;
export function fetchMoments(profileId: string, limit: number, offset: number, owner: false): Promise<ProfileResult<MomentPage<SharedMoment>>>;
export function fetchMoments(profileId: string, limit: number, offset: number): Promise<ProfileResult<MomentPage<OwnerMoment | SharedMoment>>>;
export function fetchMoments(profileId: string, limit: number, offset: number): Promise<ProfileResult<MomentPage<OwnerMoment | SharedMoment>>> {
  return rpc("get_profile_moments", { p_profile: profileId, p_limit: limit, p_offset: offset });
}
export const fetchStubs = (profileId: string) => rpc<StubItem[]>("get_profile_stubs", { p_profile: profileId });
export const fetchPursuits = (profileId: string) => rpc<PursuitItem[]>("get_profile_pursuits", { p_profile: profileId });

export const fetchMyPlanning = () => rpc<PlanningPrefs>("get_my_planning");
export const savePlanning = (p: Omit<PlanningPrefs, "calendarConnected" | "planningPaused">) =>
  rpc<null>("set_my_planning", {
    p_availability: p.availability,
    p_free_hours: p.freeHoursPerWeek,
    p_budget_cents: p.monthlyBudgetCents,
    p_memberships: p.memberships,
    p_share_memberships: p.shareMembershipsWithFriends,
  });
export const setPlanningPaused = (paused: boolean) => rpc<null>("set_planning_paused", { p_paused: paused });
export const saveProfileDetails = (neighborhood: string, bio: string, isPrivate: boolean) =>
  rpc<null>("update_profile_details", { p_neighborhood: neighborhood, p_bio: bio, p_is_private: isPrivate });
export const createPursuit = (category: string, goal: string, target: number | null) =>
  rpc<string>("create_profile_pursuit", { p_category: category, p_goal: goal, p_target: target });
export const setPursuitFinished = (id: string, finished: boolean) =>
  rpc<null>("set_pursuit_finished", { p_id: id, p_finished: finished });

export const suggestPlan = (friendId: string, category: string | null) =>
  rpc<PlanSuggestion>("suggest_plan", { p_friend_id: friendId, p_category: category });
export const sendPlanInvite = (
  friendId: string,
  category: string | null,
  slot: PlanSlot | null,
  place: string | null,
) =>
  rpc<string>("send_plan_invite", {
    p_friend_id: friendId,
    p_category: category,
    p_date: slot?.date ?? null,
    p_part: slot?.part ?? null,
    p_place: place,
  });
