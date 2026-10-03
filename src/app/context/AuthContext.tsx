import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { clearLocalData } from "../lib/localData";
import { restoreOwnPursuits } from "../lib/pursuitsRemote";
import { takeSavedInviteCode } from "../lib/inviteCode";
import { claimInvite } from "../lib/invites";
import { ERROR_LINE, OFFLINE_LINE } from "../lib/stateCopy";
import { friendlyError } from "../lib/friendlyError";

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  /** The short quote shown near your name — optional, set during onboarding
   * or any time after. */
  tagline?: string;
  /** Set once, the first time the old inline /you setup finished or was
   * skipped through. Superseded by onboarding_completed below (see
   * sql/onboarding-v2.sql) — kept only because existing rows already have
   * it; nothing reads it anymore. */
  onboarding_completed_at?: string | null;
  /** False only for an account created after sql/onboarding-v2.sql ran —
   * every pre-existing row was backfilled to true in that same migration,
   * so this never retroactively gates someone who already had an account.
   * Checked by Root.tsx to route a brand-new signup through /onboarding
   * before anything else, and set true there on finish or skip. */
  onboarding_completed: boolean;
  /** A short, optional line under the name — what got you into this, and
   * where it's going. Never required, never blocking. */
  bio?: string | null;
  /** The Studio cover's editable title/tagline/photo (sql/profile-cover.sql)
   * — each falls back when unset: title to display_name, tagline to bio,
   * photo to the most recently pinned Moment. Set from the owner-only
   * "Edit cover" panel, never inferred automatically. */
  cover_title?: string | null;
  cover_tagline?: string | null;
  cover_post_id?: number | null;
  /** "system" follows the OS; set from Settings > Appearance and mirrored to
   * localStorage so it survives being signed out (sql/theme-preference.sql). */
  theme_preference?: "system" | "light" | "dark";
  /** Step 2 (invite-only sign-up) — 'pending' until an invite is claimed;
   * every pre-existing account was backfilled to 'active' by that
   * migration. Read-only here: only claim_invite/create_invite flip it,
   * server-side. Root.tsx routes a pending account to /welcome and nowhere
   * else. */
  access?: "active" | "pending";
  invited_by?: string | null;
  invite_allowance?: number;
}

interface AuthContextType {
  /** True until the initial session check has resolved. */
  loading: boolean;
  user: User | null;
  profile: Profile | null;
  /** False when Supabase env vars aren't set — accounts are unavailable, not broken. */
  isConfigured: boolean;
  signUp: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{ error: string | null; needsConfirmation?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  /** Re-sends the signup confirmation email — the one self-service option
   * when the first one never arrives (Supabase's shared default mailer is
   * rate-limited and unreliable against some domains; the real fix is
   * configuring a custom SMTP provider in the project's Auth settings,
   * which this can't do). Same emailRedirectTo as signUp, for the same
   * reason: a HashRouter path here would break the returned token parsing. */
  resendConfirmation: (email: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (next: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  /** Revokes every refresh token for this account, not just this browser's —
   * Settings > Account's "Sign out everywhere". A revoked session's own
   * access token still works until it expires on its own (see
   * docs/pause-session-revocation-plan.md); this stops any NEW token from
   * being minted on any other device, same as the pause flow's own
   * revocation. */
  signOutEverywhere: () => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  /** Upserts the given fields onto your own profile row and reloads it.
   * Used by onboarding (name, tagline, the completed-at flag) and anywhere
   * else that needs to save more than AvatarPicker's own self-contained
   * avatar_url writes. */
  updateProfile: (
    fields: Partial<
      Pick<
        Profile,
        | "display_name"
        | "tagline"
        | "onboarding_completed_at"
        | "onboarding_completed"
        | "bio"
        | "cover_title"
        | "cover_tagline"
        | "cover_post_id"
        | "theme_preference"
      >
    >,
  ) => Promise<{ error: string | null }>;
  /** Set when a saved invite code (localStorage, across the sign-in
   * redirect) turned out invalid — the door screen (/welcome) shows this
   * once, then clears it via clearInviteClaimError so it doesn't reappear
   * on a later visit or an unrelated re-render. Never set for the
   * door screen's own manual code field, which tracks its own error. */
  inviteClaimError: string | null;
  clearInviteClaimError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Module-level so it survives across re-renders without extra state, and is
// only ever set true (a schema, once migrated, doesn't go missing again
// within a page session).
let themeColumnKnownMissing = false;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [inviteClaimError, setInviteClaimError] = useState<string | null>(null);

  /**
   * Reads the profile row. The row is created by a database trigger the
   * moment an account is made, so right after signup it can be missing, or
   * present with the email-derived placeholder name the trigger sets before
   * our own update lands. Either way the person's first impression used to be
   * the app getting their name wrong, so this retries briefly. Returns the
   * last row it saw (or null), so a caller — bootstrapProfile below, in
   * particular — can act on the same read this already did instead of
   * needing a separate fetch.
   */
  const loadProfile = async (userId: string, expectName?: string): Promise<Profile | null> => {
    if (!supabase) return null;
    let lastRow: Profile | null = null;
    // theme_preference (sql/theme-preference.sql) may not exist yet on a
    // database that hasn't run that migration — a select naming a missing
    // column fails outright, which would otherwise leave `profile` stuck at
    // null for everyone. Once seen missing, stop asking for it this session.
    // access/invited_by/invite_allowance (Step 2) get no such fallback: the
    // deploy order applies that migration before this app ever ships, so a
    // database missing them is the one case the ordering already prevents.
    for (let attempt = 0; attempt < 4; attempt++) {
      const columns = themeColumnKnownMissing
        ? "id, username, display_name, avatar_url, tagline, onboarding_completed_at, onboarding_completed, bio, cover_title, cover_tagline, cover_post_id, access, invited_by, invite_allowance"
        : "id, username, display_name, avatar_url, tagline, onboarding_completed_at, onboarding_completed, bio, cover_title, cover_tagline, cover_post_id, theme_preference, access, invited_by, invite_allowance";
      const { data, error } = await supabase
        .from("profiles")
        .select(columns)
        .eq("id", userId)
        .maybeSingle();
      if (error && !themeColumnKnownMissing && error.code === "42703") {
        themeColumnKnownMissing = true;
        attempt -= 1;
        continue;
      }
      const row = data as Profile | null;
      if (row) {
        setProfile(row);
        lastRow = row;
        // Settled if we weren't waiting for a particular name, or it arrived.
        if (!expectName || row.display_name?.trim() === expectName.trim()) return row;
      }
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
    return lastRow;
  };

  /**
   * Step 2's actual claim-on-sign-in: run right after every profile load
   * that might be a brand-new or still-pending account. A pending account
   * with a code saved from the arrival page (localStorage — the only thing
   * that survives the Google redirect, whose redirect_to is the bare site
   * root) gets that code claimed here, before Root.tsx ever has to decide
   * where to route them. The code is taken (read + cleared) regardless of
   * what claim_invite says, so a bad code is never retried silently on a
   * later sign-in. 'invalid' surfaces once on the door screen via
   * inviteClaimError; 'claimed'/'already_active' just needs the profile
   * reloaded so `access` reflects reality — Root.tsx takes it from there.
   */
  const bootstrapProfile = async (userId: string, expectName?: string) => {
    const row = await loadProfile(userId, expectName);
    if (row?.access !== "pending") return;
    const code = takeSavedInviteCode();
    if (!code) return;
    const result = await claimInvite(code);
    if (result === "invalid") setInviteClaimError("That invite has expired or was already used.");
    if (result === "claimed" || result === "already_active") await loadProfile(userId);
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // The whole site is public now, so this check must never be able to hold
    // the app hostage. It resolves on success, on failure, and on a timeout —
    // a visitor with a flaky connection gets a browsable site as a signed-out
    // guest rather than an endless spinner.
    const settle = setTimeout(() => setLoading(false), 5000);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        if (data.session) {
          void bootstrapProfile(data.session.user.id);
          // Brings back any Pursuits a previous sign-out wiped from this
          // browser (see clearLocalData in signOut, below). Fire-and-forget:
          // the local journal already works with or without this landing.
          void restoreOwnPursuits(data.session.user.id);
        }
      })
      .catch(() => {
        // Unreachable auth server — carry on as a guest.
      })
      .finally(() => {
        clearTimeout(settle);
        setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        void bootstrapProfile(newSession.user.id);
        void restoreOwnPursuits(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signUp: AuthContextType["signUp"] = async (email, password, displayName) => {
    if (!supabase) return { error: "Accounts aren’t set up for this build yet." };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // No #/you hash here: Supabase appends its own auth code/token
        // fragment onto this URL after the redirect, and a URL can't carry
        // two independent hash sections layered on top of each other — a
        // HashRouter path here broke the client's ability to parse the
        // returned code/tokens at all. Landing on the bare origin (the
        // app's default route, signed in) is the correct trade-off.
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    });
    if (error) return { error: error.message };
    // Supabase's "Confirm email" setting is on: the account exists but there's
    // no session yet, and won't be one until they click the link it just
    // mailed. Nothing to sign them into or upsert a profile name for yet.
    if (data.user && !data.session) {
      return { error: null, needsConfirmation: true };
    }
    // The profile row is created automatically by a database trigger with a
    // default name derived from the email; overwrite it with what they typed.
    if (data.user && displayName.trim()) {
      const trimmedName = displayName.trim();
      try {
        // The trigger may not have created the row yet, so a plain update
        // can land first and silently affect zero rows -- which is how
        // people ended up named after their email address. An upsert isn't
        // the fix: its proposed insert row gets validated against every
        // NOT NULL column (username included) even when the row already
        // exists and it never actually inserts, so it fails outright
        // rather than falling through to the update. Retrying the update
        // with the same backoff loadProfile already uses below for this
        // exact race closes the gap without that failure mode.
        for (let attempt = 0; attempt < 4; attempt++) {
          const { data: updated } = await supabase
            .from("profiles")
            .update({ display_name: trimmedName })
            .eq("id", data.user.id)
            .select("id");
          if (updated && updated.length > 0) break;
          await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        }
        // Read it back before returning, so the first screen after signup
        // already has the right name rather than correcting itself later —
        // and, via bootstrapProfile, claims a saved invite code right away
        // if this account is pending (see the arrival page's "Use email").
        await bootstrapProfile(data.user.id, trimmedName);
      } catch {
        // The account exists either way; they can rename themselves in
        // Settings. Failing the whole sign-up over a name would be worse.
      }
    }
    return { error: null };
  };

  const signIn: AuthContextType["signIn"] = async (email, password) => {
    if (!supabase) return { error: "Accounts aren’t set up for this build yet." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  };

  const resendConfirmation: AuthContextType["resendConfirmation"] = async (email) => {
    if (!supabase) return { error: "Accounts aren’t set up for this build yet." };
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
        },
      });
      return { error: error ? error.message : null };
    } catch {
      return { error: OFFLINE_LINE };
    }
  };

  const signInWithGoogle: AuthContextType["signInWithGoogle"] = async () => {
    if (!supabase) return { error: "Accounts aren’t set up for this build yet." };
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Same reasoning as signUp's emailRedirectTo above — no #/you here.
        redirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    });
    return { error: error ? error.message : null };
  };

  /**
   * Sends the reset mail. Deliberately reports success either way at the UI
   * layer, so this can't be used to find out which addresses have accounts.
   */
  const resetPassword: AuthContextType["resetPassword"] = async (email) => {
    if (!supabase) return { error: "Accounts aren’t set up for this build yet." };
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}${window.location.pathname}#/you`,
      });
      return { error: error ? error.message : null };
    } catch {
      return { error: OFFLINE_LINE };
    }
  };

  /** Changing your own password, from Settings, while signed in. */
  const updatePassword: AuthContextType["updatePassword"] = async (next) => {
    if (!supabase) return { error: "Accounts aren’t set up for this build yet." };
    if (next.length < 10) return { error: "Your password needs at least 10 characters." };
    try {
      const { error } = await supabase.auth.updateUser({ password: next });
      return { error: error ? error.message : null };
    } catch {
      return { error: OFFLINE_LINE };
    }
  };

  const signOut = async () => {
    // Clear the browser's copy first, and regardless of whether the network
    // call succeeds. Private logs, saved work and reactions all live in
    // localStorage; leaving them behind meant the next person to sign in on
    // a shared laptop inherited the last person's private reflections.
    clearLocalData();
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
    } catch {
      // Already signed out locally; the session token expires on its own.
    }
  };

  const signOutEverywhere = async () => {
    clearLocalData();
    if (!supabase) return { error: null };
    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      return { error: error ? error.message : null };
    } catch {
      return { error: OFFLINE_LINE };
    }
  };

  const refreshProfile = async () => {
    if (session) await loadProfile(session.user.id);
  };

  const updateProfile: AuthContextType["updateProfile"] = async (fields) => {
    if (!supabase || !session) return { error: "Not signed in." };
    try {
      // A plain update, not an upsert: the row always already exists (the
      // trigger that creates it fires the moment the account is made), and
      // an upsert's ON CONFLICT DO UPDATE still validates the *proposed
      // insert* row against every NOT NULL column first — username and
      // display_name among them — even though it never actually inserts.
      // That silently failed every call here that didn't happen to also
      // pass both of those, onboarding's own finish() included, which then
      // pressed on as if it had worked and left onboarding_completed still
      // false in the database.
      const { error } = await supabase
        .from("profiles")
        .update(fields)
        .eq("id", session.user.id);
      if (error) {
        console.warn("[AuthContext] profile update failed:", error);
        return { error: friendlyError(error) };
      }
      await loadProfile(session.user.id);
      return { error: null };
    } catch {
      return { error: ERROR_LINE };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        loading,
        user: session?.user ?? null,
        profile,
        isConfigured: isSupabaseConfigured,
        signUp,
        signIn,
        signInWithGoogle,
        resendConfirmation,
        resetPassword,
        updatePassword,
        signOut,
        signOutEverywhere,
        refreshProfile,
        updateProfile,
        inviteClaimError,
        clearInviteClaimError: () => setInviteClaimError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
