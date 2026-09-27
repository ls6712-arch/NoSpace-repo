import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "./AuthContext";
import {
  circleInvitesEnabled,
  isCategoryMuted,
  NotificationPreferences,
  withCircleInvitesEnabled,
  withMutedCategory,
} from "../lib/notificationPreferences";

export type DefaultVisibility = "private" | "public";

/** The four Phase 5 mutable categories stored as category NAMES (not raw
 * notification kinds) in profile_settings.notification_preferences.muted
 * — see supabase/migrations/20261007000000_communication_phase5_
 * notifications.sql for the category->kind mapping this mirrors exactly.
 * Circle invitations is deliberately NOT here — it reuses the existing
 * `circle_invites` boolean instead (see circleInviteNotificationsEnabled
 * below), not a fifth array entry. */
export type NotificationCategory =
  | "thoughts"
  | "pursuit_activity"
  | "make_together_explore_together"
  | "message_requests";

const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  "thoughts",
  "pursuit_activity",
  "make_together_explore_together",
  "message_requests",
];

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
  /** Phase 5: which mutable bell categories are currently OFF (muted).
   * Reads `notification_preferences.muted` (a jsonb array of category
   * names) — a missing settings row, or a missing `muted` key, means
   * nothing is muted, same default the database's own
   * private.notification_kind_muted() uses. */
  mutedNotificationCategories: Record<NotificationCategory, boolean>;
  setNotificationCategoryMuted: (category: NotificationCategory, muted: boolean) => Promise<{ error: string | null }>;
  /** Circle invitations reuse the existing `circle_invites` boolean
   * (shipped before Phase 5, defaulted true) rather than a second entry
   * in `muted` — true unless explicitly set to false, same "missing means
   * on" rule the database's own mute check uses for this one key. */
  circleInviteNotificationsEnabled: boolean;
  setCircleInviteNotificationsEnabled: (enabled: boolean) => Promise<{ error: string | null }>;
  notificationPrefsLoaded: boolean;
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
  // The full notification_preferences object, kept as-is (not just the
  // fields this app currently reads) so every write below can merge into
  // it without ever clobbering a key it doesn't know about yet (weekly_
  // digest, product_news, circle_updates_joined, replies_to_my_moments —
  // Phase 6 email prefs, untouched here).
  const [notificationPreferences, setNotificationPreferencesState] = useState<NotificationPreferences>({});
  const [notificationPrefsLoaded, setNotificationPrefsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!supabase || !user) {
      setDefaultVisibilityState("private");
      setDefaultVisibilityLoaded(true);
      setReadReceiptsState(true);
      setReadReceiptsLoaded(true);
      setNotificationPreferencesState({});
      setNotificationPrefsLoaded(true);
      return;
    }
    setDefaultVisibilityLoaded(false);
    setReadReceiptsLoaded(false);
    setNotificationPrefsLoaded(false);
    supabase
      .from("profile_settings")
      .select("default_visibility, read_receipts, notification_preferences")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const row = data as {
          default_visibility?: string;
          read_receipts?: boolean;
          notification_preferences?: NotificationPreferences;
        } | null;
        setDefaultVisibilityState(row?.default_visibility === "public" ? "public" : "private");
        setDefaultVisibilityLoaded(true);
        // A missing row (read_receipts column not there yet, or no row at
        // all) means the default — on — same rule the database itself uses.
        setReadReceiptsState(row?.read_receipts !== false);
        setReadReceiptsLoaded(true);
        setNotificationPreferencesState(row?.notification_preferences ?? {});
        setNotificationPrefsLoaded(true);
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

  // Every write below sends the FULL notification_preferences object back
  // (spread from the last-loaded/last-written one), never just the one
  // changed key — a plain upsert replaces the jsonb column wholesale, it
  // doesn't merge, so sending only `{ muted: [...] }` would silently wipe
  // circle_invites and the Phase 6 email keys the very first time anyone
  // touched a Phase 5 switch.
  const writeNotificationPreferences = async (next: NotificationPreferences) => {
    if (!supabase || !user) return { error: "Not signed in." };
    const prev = notificationPreferences;
    setNotificationPreferencesState(next);
    const { error } = await supabase
      .from("profile_settings")
      .upsert({ user_id: user.id, notification_preferences: next }, { onConflict: "user_id" });
    if (error) {
      setNotificationPreferencesState(prev);
      return { error: error.message };
    }
    return { error: null };
  };

  const mutedNotificationCategories = Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((c) => [c, isCategoryMuted(notificationPreferences, c)]),
  ) as Record<NotificationCategory, boolean>;

  const setNotificationCategoryMuted = async (category: NotificationCategory, muted: boolean) => {
    return writeNotificationPreferences(withMutedCategory(notificationPreferences, category, muted));
  };

  const circleInviteNotificationsEnabled = circleInvitesEnabled(notificationPreferences);

  const setCircleInviteNotificationsEnabled = async (enabled: boolean) => {
    return writeNotificationPreferences(withCircleInvitesEnabled(notificationPreferences, enabled));
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
        mutedNotificationCategories,
        setNotificationCategoryMuted,
        circleInviteNotificationsEnabled,
        setCircleInviteNotificationsEnabled,
        notificationPrefsLoaded,
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
