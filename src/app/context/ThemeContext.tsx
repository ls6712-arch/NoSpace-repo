import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { APP_NAME } from "../config";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
  /** Screens that are designed dark first (Discover, Corner pages) turn this on
   * while they are open. It only matters when the person's preference is
   * "system" (the default): an explicit Light or Dark always wins. */
  setDarkByDefault: (on: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Same key the no-flash script in index.html reads before React mounts.
const STORAGE_KEY = `${APP_NAME.toLowerCase()}-theme-preference`;
// Pre-rename key ("sushii-theme-preference") — read once, below, so an
// existing saved theme survives the rename instead of silently resetting
// to "system". index.html's own inline script runs the same migration,
// since it reads the preference before this file (or React) ever loads.
const LEGACY_STORAGE_KEY = "sushii-theme-preference";

function readStoredPreference(): ThemePreference {
  try {
    let v = localStorage.getItem(STORAGE_KEY);
    if (v === null) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy !== null) {
        localStorage.setItem(STORAGE_KEY, legacy);
        v = legacy;
      }
    }
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // Private mode / blocked storage — fall through to the default.
  }
  return "system";
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function resolve(pref: ThemePreference): ResolvedTheme {
  return pref === "system" ? (systemPrefersDark() ? "dark" : "light") : pref;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function applyToDom(resolved: ResolvedTheme, animate: boolean) {
  const root = document.documentElement;
  if (animate && !prefersReducedMotion()) {
    root.classList.add("theme-transition");
    // design-token-ignore: waits out the 400ms .theme-transition cross-fade in theme.css
    window.setTimeout(() => root.classList.remove("theme-transition"), 420);
  }
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { profile, updateProfile } = useAuth();
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolve(readStoredPreference()),
  );
  // The inline script in index.html already set the right class before
  // React mounted — the first effect run here must not re-announce that as
  // a "change" and cross-fade into the state it's already in.
  const isFirstApply = useRef(true);
  const [darkByDefault, setDarkByDefault] = useState(false);
  const resolveNow = (pref: ThemePreference): ResolvedTheme =>
    pref === "system" && darkByDefault ? "dark" : resolve(pref);
  // Only ever take the server's value once per sign-in, not on every profile
  // refresh — otherwise a local change made right after loading would keep
  // getting overwritten back to the last-saved server value.
  const tookServerPreference = useRef(false);

  const lastPreference = useRef(preference);
  // A layout effect, so a dark-first screen never paints one light frame.
  useLayoutEffect(() => {
    const next = resolveNow(preference);
    setResolvedTheme(next);
    // Only the person changing their preference cross-fades. Moving to or from
    // a dark-first screen is a navigation, not a theme change.
    const changedByPerson = lastPreference.current !== preference;
    lastPreference.current = preference;
    applyToDom(next, !isFirstApply.current && changedByPerson);
    isFirstApply.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preference, darkByDefault]);

  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = resolveNow("system");
      setResolvedTheme(next);
      applyToDom(next, true);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preference, darkByDefault]);

  useEffect(() => {
    if (tookServerPreference.current) return;
    const server = profile?.theme_preference;
    if (server !== "system" && server !== "light" && server !== "dark") return;
    tookServerPreference.current = true;
    try {
      localStorage.setItem(STORAGE_KEY, server);
    } catch {
      // Fine — the in-memory preference below still takes effect this visit.
    }
    if (server !== preference) setPreferenceState(server);
    // preference is deliberately left out: this effect only ever fires the
    // one time it finds a profile, not every time preference changes too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Signing out should let the NEXT sign-in's server value win again.
  useEffect(() => {
    if (!profile) tookServerPreference.current = false;
  }, [profile]);

  const setPreference = (pref: ThemePreference) => {
    setPreferenceState(pref);
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // Preference still applies for this visit even if it can't persist.
    }
    if (profile) void updateProfile({ theme_preference: pref });
  };

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setPreference, setDarkByDefault }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

/** Call from a screen designed dark first. Dark while it is open, unless the
 * person has chosen Light (or Dark) themselves. */
export function useDarkByDefault() {
  const { setDarkByDefault } = useTheme();
  useLayoutEffect(() => {
    setDarkByDefault(true);
    return () => setDarkByDefault(false);
  }, [setDarkByDefault]);
}
