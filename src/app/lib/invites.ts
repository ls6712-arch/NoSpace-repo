import { supabase } from "../../lib/supabase";
import { friendlyError } from "./friendlyError";

/**
 * Step 2 (invite-only sign-up) — thin RPC wrappers, same shape as
 * lib/spaces.ts's own `call` helper: every RPC here already raises a
 * friendly, user-facing message on failure, so a caller just shows
 * `error` as-is. Reads of the `invites`/`waitlist` tables themselves go
 * straight through `supabase.from(...)` at each call site (AdminInvites.tsx),
 * matching how the rest of the app reads tables directly.
 */

export interface InvitePreview {
  isValid: boolean;
  inviterName: string | null;
  inviterAvatar: string | null;
  note: string | null;
}

const EMPTY_PREVIEW: InvitePreview = {
  isValid: false,
  inviterName: null,
  inviterAvatar: null,
  note: null,
};

export async function fetchInvitePreview(code: string): Promise<InvitePreview> {
  if (!supabase || !code) return EMPTY_PREVIEW;
  const { data, error } = await supabase.rpc("invite_preview", { p_code: code });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return EMPTY_PREVIEW;
  return {
    isValid: !!row.is_valid,
    inviterName: row.inviter_name ?? null,
    inviterAvatar: row.inviter_avatar ?? null,
    note: row.note ?? null,
  };
}

export type ClaimInviteResult = "claimed" | "already_active" | "invalid" | "error";

export async function claimInvite(code: string): Promise<ClaimInviteResult> {
  if (!supabase || !code) return "error";
  const { data, error } = await supabase.rpc("claim_invite", { p_code: code });
  if (error) return "error";
  if (data === "claimed" || data === "already_active" || data === "invalid") return data;
  return "error";
}

export interface CreateInviteResult {
  code: string | null;
  expiresAt: string | null;
  error: string | null;
}

export async function createInvite(note: string): Promise<CreateInviteResult> {
  if (!supabase) return { code: null, expiresAt: null, error: "You’re not logged in." };
  const { data, error } = await supabase.rpc("create_invite", { p_note: note.trim() || null });
  if (error) return { code: null, expiresAt: null, error: friendlyError(error) };
  const row = Array.isArray(data) ? data[0] : data;
  return {
    code: row?.invite_code ?? null,
    expiresAt: row?.invite_expires_at ?? null,
    error: null,
  };
}

/** The one shape of an invite link, shared by AdminInvites and the
 * onboarding invite card so the two can never drift apart. */
export const SITE_ORIGIN = "https://www.trynospace.com";
export function inviteLink(code: string): string {
  return `${SITE_ORIGIN}/#/i/${code}`;
}

/**
 * How many more invites this person can create — the same count
 * create_invite() enforces server-side (claimed, plus open and unexpired,
 * against profiles.invite_allowance). `null` means no limit (admins).
 * Returns 0 on any read failure, so a caller hides the invite UI rather
 * than offering something the server would refuse.
 */
export async function fetchInvitesLeft(
  userId: string,
  allowance: number,
  isAdmin: boolean,
): Promise<number | null> {
  if (isAdmin) return null;
  if (!supabase || !userId || allowance <= 0) return 0;
  const { data, error } = await supabase
    .from("invites")
    .select("status, expires_at")
    .eq("inviter_id", userId);
  if (error) return 0;
  const now = Date.now();
  const used = (data ?? []).filter(
    (r: { status: string; expires_at: string }) =>
      r.status === "claimed" || (r.status === "open" && new Date(r.expires_at).getTime() > now),
  ).length;
  return Math.max(0, allowance - used);
}

/**
 * Step 4c · the Day-2 invite ask. How many invites to offer on My Space
 * right now, or 0 to show nothing: my_invite_ask() returns a number only
 * once the account is a day old, their first moment has a written thought
 * from someone else, and they haven't sent an invite yet.
 */
export async function fetchInviteAsk(): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase.rpc("my_invite_ask");
  if (error) return 0;
  return typeof data === "number" ? data : Number(data) || 0;
}

export async function revokeInvite(code: string): Promise<boolean> {
  if (!supabase || !code) return false;
  const { data, error } = await supabase.rpc("revoke_invite", { p_code: code });
  return !error && !!data;
}

export async function joinWaitlist(email: string, hobby: string): Promise<boolean> {
  if (!supabase || !email.trim()) return false;
  const { error } = await supabase.rpc("join_waitlist", {
    p_email: email.trim(),
    p_hobby: hobby.trim() || null,
  });
  // "Always true for duplicates" per the RPC contract — a genuine failure
  // (network, unexpected server error) is the only case this reports back.
  return !error;
}
