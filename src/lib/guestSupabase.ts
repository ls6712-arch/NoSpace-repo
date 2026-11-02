import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { trackedFetch } from "../app/lib/networkStatus";
import { isSupabaseConfigured, supabase, supabaseAnonKey, supabaseUrl } from "./supabase";

/**
 * The guest's own Supabase client, for Stubby only.
 *
 * A guest is an anonymous Supabase user, made on their first ask (never on page load). Its
 * session is kept apart from the main client's under its own storage key, so the rest of the app
 * never sees a guest as signed in: every other page keeps reading as a signed-out visitor, and
 * nothing a guest does can reach a member-only table (the database refuses anyway; see
 * 20261111000000_member_gate.sql).
 *
 * When the guest signs up, the same user id becomes a real account (linkIdentity for Google or
 * Apple, a verified email for email), the session moves to the main client, and this one is
 * cleared. Their picks, asks, taste and feedback stay with the same id.
 */
export const GUEST_STORAGE_KEY = "soosh-guest-stubby";

export const guestSupabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      global: { fetch: trackedFetch },
      auth: { storageKey: GUEST_STORAGE_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;

/** Turnstile (invisible) on guest creation, behind a flag: set VITE_TURNSTILE_SITE_KEY to switch it on. */
export const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || null;

/** The guest's session, if there is one already. Never makes one. */
export async function guestSession() {
  if (!guestSupabase) return null;
  try {
    const { data } = await guestSupabase.auth.getSession();
    return data.session ?? null;
  } catch {
    return null;
  }
}

/**
 * The guest session, made now if there isn't one. Called on the first ask only. With Turnstile on,
 * the caller passes the token it got; Supabase checks it (Authentication > Attack Protection).
 */
export async function ensureGuestSession(captchaToken?: string | null): Promise<{ ok: boolean }> {
  if (!guestSupabase) return { ok: false };
  if (await guestSession()) return { ok: true };
  try {
    const { data, error } = await guestSupabase.auth.signInAnonymously(captchaToken ? { options: { captchaToken } } : undefined);
    return { ok: !error && !!data.session };
  } catch {
    return { ok: false };
  }
}

/** Ends a session on the server (the old guest session after sign-up), so its tokens stop working. */
export async function revokeSession(accessToken: string): Promise<void> {
  if (!supabaseUrl || !supabaseAnonKey) return;
  try {
    await fetch(`${supabaseUrl}/auth/v1/logout?scope=local`, {
      method: "POST",
      headers: { apikey: supabaseAnonKey, authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // Best effort: it expires on its own within the hour.
  }
}

/** Forgets the guest on this device, without touching the account it may have become. */
export function forgetGuest(): void {
  try {
    window.localStorage.removeItem(GUEST_STORAGE_KEY);
    window.localStorage.removeItem(`${GUEST_STORAGE_KEY}-code-verifier`);
  } catch {
    // Storage blocked: nothing was kept.
  }
}

/**
 * After the guest's email is verified on the guest client: the session moves to the main client,
 * and the guest's own copy is forgotten. Returns false if the move failed (the guest stays as it was).
 */
export async function moveGuestSessionToMain(): Promise<boolean> {
  if (!guestSupabase || !supabase) return false;
  const s = await guestSession();
  if (!s) return false;
  const { error } = await supabase.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
  if (error) return false;
  forgetGuest();
  return true;
}
