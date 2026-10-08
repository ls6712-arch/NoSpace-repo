import { supabase } from "../../lib/supabase";

/** The profile columns anyone may read: they are what a public Shelf shows. */
export const PUBLIC_PROFILE_COLUMNS =
  "id, username, display_name, avatar_url, tagline, bio, cover_title, cover_tagline, cover_post_id";

/** The columns only the account's owner should read. Other people used to be
 * able to read all of these on any profile (who is an admin, who invited whom,
 * invite allowance, theme, onboarding state, settings). They now come from
 * public.my_profile_private(), which returns only the caller's own row. */
export interface PrivateProfile {
  access: "active" | "pending";
  invited_by: string | null;
  invite_allowance: number;
  onboarding_completed: boolean;
  onboarding_completed_at: string | null;
  theme_preference: "system" | "light" | "dark";
  is_admin: boolean;
  discoverable: boolean;
  show_this_corner: boolean;
}

export type OwnPrivateProfile =
  | { status: "ok"; data: PrivateProfile }
  /** The function isn't in this database yet (its migration hasn't run): the
   * caller reads those columns straight from profiles, as before. */
  | { status: "missing" }
  /** A failure that may pass (offline, a hiccup). Nothing is known. */
  | { status: "error" };

// PGRST202 is PostgREST's "no such function"; 42883 is Postgres's own.
const isMissing = (code?: string) => code === "PGRST202" || code === "42883";

let functionMissing = false;

/** Reads the signed-in person's own private profile columns. "Missing" is
 * remembered for the page session so the old path doesn't ask twice. */
export async function fetchOwnPrivateProfile(): Promise<OwnPrivateProfile> {
  if (!supabase) return { status: "error" };
  if (functionMissing) return { status: "missing" };
  const { data, error } = await supabase.rpc("my_profile_private");
  if (error) {
    if (isMissing(error.code)) {
      functionMissing = true;
      return { status: "missing" };
    }
    return { status: "error" };
  }
  const row = (Array.isArray(data) ? data[0] : data) as PrivateProfile | null | undefined;
  return row ? { status: "ok", data: row } : { status: "error" };
}

/** Test hook: forget what was learned about the function. */
export function resetOwnPrivateProfileCache() {
  functionMissing = false;
}
