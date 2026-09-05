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

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
}

interface AuthContextType {
  /** True until the initial session check has resolved. */
  loading: boolean;
  user: User | null;
  profile: Profile | null;
  /** False when Supabase env vars aren't set — accounts are unavailable, not broken. */
  isConfigured: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (next: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  /**
   * Reads the profile row. The row is created by a database trigger the
   * moment an account is made, so right after signup it can be missing, or
   * present with the email-derived placeholder name the trigger sets before
   * our own update lands. Either way the person's first impression used to be
   * the app getting their name wrong, so this retries briefly.
   */
  const loadProfile = async (userId: string, expectName?: string) => {
    if (!supabase) return;
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("id", userId)
        .maybeSingle();
      const row = data as Profile | null;
      if (row) {
        setProfile(row);
        // Settled if we weren't waiting for a particular name, or it arrived.
        if (!expectName || row.display_name?.trim() === expectName.trim()) return;
      }
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
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
        if (data.session) loadProfile(data.session.user.id);
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
        loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signUp: AuthContextType["signUp"] = async (email, password, displayName) => {
    if (!supabase) return { error: "Accounts aren't set up for this build yet." };
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    // The profile row is created automatically by a database trigger with a
    // default name derived from the email; overwrite it with what they typed.
    if (data.user && displayName.trim()) {
      try {
        // The trigger may not have created the row yet, so upsert rather than
        // update — an update against a missing row silently changes nothing,
        // which is how people ended up named after their email address.
        await supabase
          .from("profiles")
          .upsert({ id: data.user.id, display_name: displayName.trim() }, { onConflict: "id" });
        // Read it back before returning, so the first screen after signup
        // already has the right name rather than correcting itself later.
        await loadProfile(data.user.id, displayName.trim());
      } catch {
        // The account exists either way; they can rename themselves in
        // Settings. Failing the whole sign-up over a name would be worse.
      }
    }
    return { error: null };
  };

  const signIn: AuthContextType["signIn"] = async (email, password) => {
    if (!supabase) return { error: "Accounts aren't set up for this build yet." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  };

  /**
   * Sends the reset mail. Deliberately reports success either way at the UI
   * layer, so this can't be used to find out which addresses have accounts.
   */
  const resetPassword: AuthContextType["resetPassword"] = async (email) => {
    if (!supabase) return { error: "Accounts aren't set up for this build yet." };
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}${window.location.pathname}#/you`,
      });
      return { error: error ? error.message : null };
    } catch {
      return { error: "Couldn't reach the server. Try again in a moment." };
    }
  };

  /** Changing your own password, from Settings, while signed in. */
  const updatePassword: AuthContextType["updatePassword"] = async (next) => {
    if (!supabase) return { error: "Accounts aren't set up for this build yet." };
    if (next.length < 8) return { error: "Your password needs at least 8 characters." };
    try {
      const { error } = await supabase.auth.updateUser({ password: next });
      return { error: error ? error.message : null };
    } catch {
      return { error: "Couldn't reach the server. Try again in a moment." };
    }
  };

  const signOut = async () => {
    // Clear the browser's copy first, and regardless of whether the network
    // call succeeds. Private logs, saved work, reactions and joined Circles all
    // live in localStorage; leaving them behind meant the next person to sign
    // in on a shared laptop inherited the last person's private reflections.
    clearLocalData();
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
    } catch {
      // Already signed out locally; the session token expires on its own.
    }
  };

  const refreshProfile = async () => {
    if (session) await loadProfile(session.user.id);
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
        resetPassword,
        updatePassword,
        signOut,
        refreshProfile,
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
