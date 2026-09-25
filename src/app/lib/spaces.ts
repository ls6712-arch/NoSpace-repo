import { supabase } from "../../lib/supabase";

/**
 * Thin RPC wrappers for the Spaces Rework backend (Phases 2-5). Every RPC
 * here raises a friendly, already-user-facing message on failure
 * (`raise exception '...'`), so callers just show `error` as-is — no
 * translation layer. `error` is `null` on success.
 *
 * Reads (spaces/space_members/space_corners/space_events/etc.) go straight
 * through `supabase.from(...)` at each call site instead of being wrapped
 * here, matching how the rest of the app reads Supabase tables directly.
 */

export type SpaceRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  cover_image: string;
  category_slug: string | null;
  meets: "in_person" | "online" | "both";
  neighborhood: string | null;
  city: string | null;
  access: "open" | "closed";
  join_questions: unknown[];
  rules: string | null;
  member_cap: number | null;
  posting_mode: "immediate" | "approval";
  events_created_by: "hosts" | "members";
  status: "active" | "read_only" | "deleted";
  created_by: string | null;
  created_at: string;
  host_handoff_started_at: string | null;
};

export type SpaceMemberRow = {
  space_id: string;
  user_id: string;
  role: "host" | "member";
  status: "active" | "pending" | "banned";
  join_answers: { message?: string; post_id?: number } | null;
  invited_by: string | null;
  joined_at: string;
};

export type SpaceEventRow = {
  id: number;
  space_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  meets: "in_person" | "online" | "both";
  neighborhood: string | null;
  city: string | null;
  created_by: string | null;
  featured: boolean;
  status: "scheduled" | "cancelled";
  created_at: string;
};

async function call<T = null>(fn: string, args: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  if (!supabase) return { data: null, error: "Not signed in." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { data: null, error: error.message };
  return { data: (data as T) ?? null, error: null };
}

// ── Create / edit a Space ───────────────────────────────────────────────

export function createSpace(input: {
  slug: string;
  name: string;
  description: string;
  coverImage: string;
  meets: "in_person" | "online" | "both";
  access: "open" | "closed";
  postingMode: "immediate" | "approval";
  eventsCreatedBy: "hosts" | "members";
  cornerIds: number[];
  neighborhood?: string;
  city?: string;
  memberCap?: number;
  rules?: string;
  exactAddress?: string;
}) {
  return call<string>("create_space", {
    p_slug: input.slug,
    p_name: input.name,
    p_description: input.description,
    p_cover_image: input.coverImage,
    p_meets: input.meets,
    p_access: input.access,
    p_posting_mode: input.postingMode,
    p_events_created_by: input.eventsCreatedBy,
    p_corner_ids: input.cornerIds,
    p_neighborhood: input.neighborhood ?? null,
    p_city: input.city ?? null,
    p_member_cap: input.memberCap ?? null,
    p_rules: input.rules ?? null,
    p_exact_address: input.exactAddress ?? null,
  });
}

export function updateSpace(input: {
  spaceId: string;
  name: string;
  description: string;
  coverImage: string;
  meets: "in_person" | "online" | "both";
  access: "open" | "closed";
  postingMode: "immediate" | "approval";
  eventsCreatedBy: "hosts" | "members";
  neighborhood?: string;
  city?: string;
  memberCap?: number;
  rules?: string;
  exactAddress?: string;
  clearAddress?: boolean;
}) {
  return call("update_space", {
    p_space_id: input.spaceId,
    p_name: input.name,
    p_description: input.description,
    p_cover_image: input.coverImage,
    p_meets: input.meets,
    p_access: input.access,
    p_posting_mode: input.postingMode,
    p_events_created_by: input.eventsCreatedBy,
    p_neighborhood: input.neighborhood ?? null,
    p_city: input.city ?? null,
    p_member_cap: input.memberCap ?? null,
    p_rules: input.rules ?? null,
    p_exact_address: input.exactAddress ?? null,
    p_clear_address: input.clearAddress ?? false,
  });
}

/** Replaces a Space's linked Corners in one transaction (1-3 ids, first
 * primary) — space_corners has no client-writable policy of its own
 * anymore, so this is the only way to change them post-creation. */
export function setSpaceCorners(spaceId: string, cornerIds: number[]) {
  return call("set_space_corners", { p_space_id: spaceId, p_corner_ids: cornerIds });
}

export function spaceMomentCount30d(spaceId: string) {
  return call<number>("space_moment_count_30d", { p_space_id: spaceId });
}

// ── Membership ───────────────────────────────────────────────────────────

/** Returns 'active' (Open Space, joined immediately) or 'pending' (Closed,
 * a request was filed). `message`/`postId` are the Closed-Space "Request to
 * join" flow's optional fields. */
export function requestOrJoinSpace(spaceId: string, message?: string, postId?: number) {
  const answers = message || postId ? { message: message || undefined, post_id: postId } : null;
  return call<"active" | "pending">("request_or_join_space", { p_space_id: spaceId, p_join_answers: answers });
}
export function cancelJoinRequest(spaceId: string) {
  return call("cancel_join_request", { p_space_id: spaceId });
}
export function approveJoinRequest(spaceId: string, userId: string) {
  return call("approve_join_request", { p_space_id: spaceId, p_user_id: userId });
}
export function declineJoinRequest(spaceId: string, userId: string) {
  return call("decline_join_request", { p_space_id: spaceId, p_user_id: userId });
}
export function banMember(spaceId: string, userId: string) {
  return call("ban_member", { p_space_id: spaceId, p_user_id: userId });
}
export function unbanMember(spaceId: string, userId: string) {
  return call("unban_member", { p_space_id: spaceId, p_user_id: userId });
}
export function removeMember(spaceId: string, userId: string) {
  return call("remove_member", { p_space_id: spaceId, p_user_id: userId });
}
export function leaveSpace(spaceId: string) {
  return call("leave_space", { p_space_id: spaceId });
}
export function demoteHost(spaceId: string, userId: string) {
  return call("demote_host", { p_space_id: spaceId, p_user_id: userId });
}
export function inviteHost(spaceId: string, invitedUserId: string) {
  return call("invite_host", { p_space_id: spaceId, p_invited_user_id: invitedUserId });
}
export function acceptHostInvite(inviteId: number) {
  return call("accept_host_invite", { p_invite_id: inviteId });
}
export function declineHostInvite(inviteId: number) {
  return call("decline_host_invite", { p_invite_id: inviteId });
}
export function unlinkMyMoment(spaceId: string, postId: number) {
  return call("unlink_my_moment", { p_space_id: spaceId, p_post_id: postId });
}
export function acceptHostHandoff(spaceId: string) {
  return call("accept_host_handoff", { p_space_id: spaceId });
}

// ── Deletion ─────────────────────────────────────────────────────────────

/** Returns 'deleted' (sole host — done immediately) or 'pending' (a
 * multi-host request was opened). */
export function requestSpaceDeletion(spaceId: string) {
  return call<"deleted" | "pending">("request_space_deletion", { p_space_id: spaceId });
}
export function cancelDeletionRequest(requestId: number) {
  return call("cancel_deletion_request", { p_request_id: requestId });
}
/** Returns 'deleted' | 'cancelled' | 'pending' | 'expired'. */
export function respondToDeletionRequest(requestId: number, decision: "approved" | "declined") {
  return call<"deleted" | "cancelled" | "pending" | "expired">("respond_to_deletion_request", {
    p_request_id: requestId,
    p_decision: decision,
  });
}

// ── Events ───────────────────────────────────────────────────────────────

export function createEvent(input: {
  spaceId: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  timezone: string;
  meets: "in_person" | "online" | "both";
  neighborhood?: string;
  city?: string;
  exactAddress?: string;
}) {
  return call<number>("create_event", {
    p_space_id: input.spaceId,
    p_title: input.title,
    p_description: input.description ?? null,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt ?? null,
    p_timezone: input.timezone,
    p_meets: input.meets,
    p_neighborhood: input.neighborhood ?? null,
    p_city: input.city ?? null,
    p_exact_address: input.exactAddress ?? null,
  });
}

export function updateEvent(input: {
  eventId: number;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  timezone: string;
  meets: "in_person" | "online" | "both";
  neighborhood?: string;
  city?: string;
  exactAddress?: string;
  clearAddress?: boolean;
}) {
  return call("update_event", {
    p_event_id: input.eventId,
    p_title: input.title,
    p_description: input.description ?? null,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt ?? null,
    p_timezone: input.timezone,
    p_meets: input.meets,
    p_neighborhood: input.neighborhood ?? null,
    p_city: input.city ?? null,
    p_exact_address: input.exactAddress ?? null,
    p_clear_address: input.clearAddress ?? false,
  });
}
export function cancelEvent(eventId: number) {
  return call("cancel_event", { p_event_id: eventId });
}
export function featureEvent(eventId: number) {
  return call("feature_event", { p_event_id: eventId });
}
export function unfeatureEvent(eventId: number) {
  return call("unfeature_event", { p_event_id: eventId });
}
export function rsvpToEvent(eventId: number) {
  return call("rsvp_to_event", { p_event_id: eventId });
}
export function cancelRsvp(eventId: number) {
  return call("cancel_rsvp", { p_event_id: eventId });
}
export function listEventTeasers(spaceId: string) {
  return call<{ id: number; title: string; starts_at: string; timezone: string }[]>("list_event_teasers", {
    p_space_id: spaceId,
  });
}
