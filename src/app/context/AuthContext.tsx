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
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = async (userId: string) => {
    if (!supabase) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    setProfile(data as Profile | null);
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
        await supabase
          .from("profiles")
          .update({ display_name: displayName.trim() })
          .eq("id", data.user.id);
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
