// Who the caller is and claiming an ask, against whatever the database has. Pure apart from the
// rpc it is handed, so it runs the same under Deno and in vitest (guests.test.ts).
//
// Before 20261111000050_member_gate.sql and 20261111000100_stubby_guests.sql are applied, the new
// functions (my_access, claim_stubby_turn) don't exist. Members then keep Stubby as it was: the
// old member rule (my_profile_private) and the old claim (claim_stubby_ask). Guests get nothing:
// they're already refused by the startup check (stubby_guest_ready), and here too.

import { isMissingInDb, legacyAccess } from "../_shared/access.ts";
import type { AskLimits, ClaimResult, LimitCode } from "./handler.ts";

export type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string } | null }>;

const LIMIT_CODES: readonly LimitCode[] = ["GUEST_LIMIT_REACHED", "USER_LIMIT_REACHED", "GUEST_GLOBAL_CAP", "GLOBAL_CAP"];

/** my_access() as the caller; before the member gate migration, the old member rule. null if unknown. */
export async function readAccess(callerRpc: Rpc): Promise<{ member?: unknown; guest?: unknown; adult21?: unknown } | null> {
  const { data, error } = await callerRpc("my_access");
  if (!error) return data as { member?: unknown; guest?: unknown; adult21?: unknown };
  if (!isMissingInDb(error.code)) return null;
  const legacy = await callerRpc("my_profile_private");
  return legacy.error ? null : legacyAccess(legacy.data);
}

/** claim_stubby_turn() as the server; before the guest migration, claim_stubby_ask() for accounts. */
export async function claimTurn(serverRpc: Rpc, user: string, l: AskLimits): Promise<ClaimResult> {
  const { data, error } = await serverRpc("claim_stubby_turn", {
    p_user: user,
    p_guest: l.guest,
    p_ip_hash: l.ipHash,
    p_per_user: l.perPerson,
    p_per_ip: l.perIp,
    p_new_guests_per_ip_hour: l.newGuestsPerIpHour,
    p_guest_global: l.guestCap,
    p_global: l.global,
  });
  if (error && isMissingInDb(error.code) && !l.guest) {
    const old = await serverRpc("claim_stubby_ask", { p_user: user, p_per_user: l.perPerson, p_global: l.global });
    if (old.error) throw old.error;
    const id = old.data as number | null;
    return id ? { askId: id } : { askId: null, code: "USER_LIMIT_REACHED", resetsAt: null };
  }
  if (error) throw error;
  const r = (Array.isArray(data) ? data[0] : data) as { ask_id: number | null; code: string; resets_at: string | null } | null;
  if (r?.ask_id) return { askId: r.ask_id };
  const code = (LIMIT_CODES as readonly string[]).includes(r?.code ?? "") ? (r!.code as LimitCode) : l.guest ? "GUEST_LIMIT_REACHED" : "USER_LIMIT_REACHED";
  return { askId: null, code, resetsAt: r?.resets_at ?? null };
}
