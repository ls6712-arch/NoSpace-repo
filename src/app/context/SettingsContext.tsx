import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "./AuthContext";

export type DefaultVisibility = "private" | "public";

interface SettingsContextType {
  /** Whether your joined Circles show on your public work (Studio/Shelf).
   * Local-only preference — profile_settings has no column for this yet,
   * so it's kept in localStorage rather than adding one (Settings redesign
   * Stage 1 takes no migrations). */
  circlesVisible: boolean;
  setCirclesVisible: (next: boolean) => void;
  /** profiles_settings.default_visibility — the audience a new Moment
   * starts with in the composer. True database default is 'private'; any
   * other stored value (e.g. 'circle', set some other way) falls back to
   * 'private' here since the Privacy section only ever offers Only you /
   * Everyone as a choice. */
  defaultVisibility: DefaultVisibility;
  setDefaultVisibility: (next: DefaultVisibility) => Promise<{ error: string | null }>;
  defaultVisibilityLoaded: boolean;
  /** profile_settings.read_receipts (Phase 3) — on by default. Off works
   * both ways: turning it off stops others from seeing when you've read
   * their messages, and stops you from seeing when they've read yours
   * (enforced by thread_seen_at() in the database, not just hidden here). */
  readReceipts: boolean;
  setReadReceipts: (next: boolean) => Promise<{ error: string | null }>;
  readReceiptsLoaded: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const CIRCLES_VISIBLE_KEY = "sushii-circles-visible";

function readCirclesVisible(): boolean {
  try {
    const v = localStorage.getItem(CIRCLES_VISIBLE_KEY);
    if (v === "false") return false;
  } catch {
    // Private mode / blocked storage — default to visible.
  }
  return true;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [circlesVisible, setCirclesVisibleState] = useState<boolean>(readCirclesVisible);
  const [defaultVisibility, setDefaultVisibilityState] = useState<DefaultVisibility>("private");
  const [defaultVisibilityLoaded, setDefaultVisibilityLoaded] = useState(false);
  const [readReceipts, setReadReceiptsState] = useState(true);
  const [readReceiptsLoaded, setReadReceiptsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!supabase || !user) {
      setDefaultVisibilityState("private");
      setDefaultVisibilityLoaded(true);
      setReadReceiptsState(true);
      setReadReceiptsLoaded(true);
      return;
    }
    setDefaultVisibilityLoaded(false);
    setReadReceiptsLoaded(false);
    supabase
      .from("profile_settings")
      .select("default_visibility, read_receipts")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const row = data as { default_visibility?: string; read_receipts?: boolean } | null;
        setDefaultVisibilityState(row?.default_visibility === "public" ? "public" : "private");
        setDefaultVisibilityLoaded(true);
        // A missing row (read_receipts column not there yet, or no row at
        // all) means the default — on — same rule the database itself uses.
        setReadReceiptsState(row?.read_receipts !== false);
        setReadReceiptsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const setCirclesVisible = (next: boolean) => {
    setCirclesVisibleState(next);
    try {
      localStorage.setItem(CIRCLES_VISIBLE_KEY, String(next));
    } catch {
      // Preference still applies for this visit even if it can't persist.
    }
  };

  const setDefaultVisibility = async (next: DefaultVisibility) => {
    if (!supabase || !user) return { error: "Not signed in." };
    const prev = defaultVisibility;
    setDefaultVisibilityState(next);
    // profile_settings has no row-creating trigger the way profiles does
    // (see docs/ticket-username-editing.md's note on the table's other
    // unused columns) — upsert rather than update so the first-ever write
    // creates the row instead of silently affecting zero.
    const { error } = await supabase
      .from("profile_settings")
      .upsert({ user_id: user.id, default_visibility: next }, { onConflict: "user_id" });
    if (error) {
      setDefaultVisibilityState(prev);
      return { error: error.message };
    }
    return { error: null };
  };

  const setReadReceipts = async (next: boolean) => {
    if (!supabase || !user) return { error: "Not signed in." };
    const prev = readReceipts;
    setReadReceiptsState(next);
    const { error } = await supabase
      .from("profile_settings")
      .upsert({ user_id: user.id, read_receipts: next }, { onConflict: "user_id" });
    if (error) {
      setReadReceiptsState(prev);
      return { error: error.message };
    }
    return { error: null };
  };

  return (
    <SettingsContext.Provider
      value={{
        circlesVisible,
        setCirclesVisible,
        defaultVisibility,
        setDefaultVisibility,
        defaultVisibilityLoaded,
        readReceipts,
        setReadReceipts,
        readReceiptsLoaded,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}
