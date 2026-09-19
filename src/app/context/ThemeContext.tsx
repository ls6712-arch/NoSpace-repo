import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { useAuth } from "./AuthContext";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Same key the no-flash script in index.html reads before React mounts.
const STORAGE_KEY = "sushii-theme-preference";

function readStoredPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
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
  // Only ever take the server's value once per sign-in, not on every profile
  // refresh — otherwise a local change made right after loading would keep
  // getting overwritten back to the last-saved server value.
  const tookServerPreference = useRef(false);

  useEffect(() => {
    const next = resolve(preference);
    setResolvedTheme(next);
    applyToDom(next, !isFirstApply.current);
    isFirstApply.current = false;
  }, [preference]);

  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = resolve("system");
      setResolvedTheme(next);
      applyToDom(next, true);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

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
    <ThemeContext.Provider value={{ preference, resolvedTheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
