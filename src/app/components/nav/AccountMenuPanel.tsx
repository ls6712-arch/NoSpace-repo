import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Flag, LogOut, Settings as SettingsIcon, UserRound } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useCategories } from "../../context/CategoriesContext";
import { useTheme, type ThemePreference } from "../../context/ThemeContext";
import { supabase } from "../../../lib/supabase";
import { formatBadgeCount } from "../../lib/messageSync";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const ITEM = "flex min-h-11 items-center gap-2.5 px-4 py-3 text-small transition-colors hover:bg-surface-muted";

/**
 * What the account menu holds: You (unless it is already on screen as the
 * avatar), Settings, Reports for an admin, the Theme choice and Log out. Used
 * by the caret next to the avatar in the top header and by More on the rail, so
 * the two are the same menu. `onNavigate` closes whatever opened it.
 */
export function AccountMenuPanel({ onNavigate, includeYou = true }: { onNavigate: () => void; includeYou?: boolean }) {
  const { preference, setPreference } = useTheme();
  const { isAdmin } = useCategories();
  const { signOut } = useAuth();
  const [openReportCount, setOpenReportCount] = useState<number | null>(null);

  // Cheap (a HEAD request, no rows) and only for an admin who has opened the menu.
  useEffect(() => {
    if (!isAdmin || !supabase) return;
    let cancelled = false;
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .then(({ count }) => {
        if (!cancelled) setOpenReportCount(count ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  return (
    <>
      {includeYou && (
        <Link to="/you" onClick={onNavigate} className={ITEM}>
          <UserRound className="size-4 text-muted-foreground" aria-hidden="true" />
          You
        </Link>
      )}
      <Link to="/settings" onClick={onNavigate} className={ITEM}>
        <SettingsIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        Settings
      </Link>
      {isAdmin && (
        <Link to="/admin/reports" onClick={onNavigate} className={ITEM}>
          <Flag className="size-4 text-muted-foreground" aria-hidden="true" />
          Reports
          {!!openReportCount && (
            <span
              className="ml-auto flex size-5 items-center justify-center rounded-full [background-color:var(--accent-text)] text-caption text-on-brand tabular-nums"
              aria-label={`${openReportCount} open`}
            >
              {formatBadgeCount(openReportCount)}
            </span>
          )}
        </Link>
      )}
      <div className="border-t border-[var(--hairline)] px-4 py-3">
        <div className="mb-2 text-caption text-muted-foreground">Theme</div>
        <div className="flex gap-1 rounded-control border border-border p-0.5">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={preference === opt.value}
              onClick={() => setPreference(opt.value)}
              className={
                "min-h-8 flex-1 rounded-control px-2 text-caption transition-colors " +
                (preference === opt.value ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          onNavigate();
          void signOut();
        }}
        className="flex min-h-11 w-full items-center gap-2.5 border-t border-[var(--hairline)] px-4 py-3 text-left text-small transition-colors hover:bg-surface-muted"
      >
        <LogOut className="size-4 text-muted-foreground" aria-hidden="true" />
        Log out
      </button>
    </>
  );
}
