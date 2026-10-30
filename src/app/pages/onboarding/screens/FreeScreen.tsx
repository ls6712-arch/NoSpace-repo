import { useEffect, useState } from "react";
import { TimeGrid } from "../../../components/onboarding/TimeGrid";
import { TransferButton } from "../../../components/onboarding/TransferButton";
import { useAuth } from "../../../context/AuthContext";
import { savePrivate } from "../../../lib/onboardingRemote";
import { ERROR_LINE } from "../../../lib/stateCopy";
import { ALL_WINDOWS, windowCountLine } from "../../../lib/tasteModel";
import { fetchTaste } from "../../../lib/tasteRemote";
import { useOnboarding } from "../OnboardingContext";
import { ScreenFrame } from "./ScreenFrame";

/**
 * Screen 8: "When are you usually free?" Fourteen windows (daytime and evening
 * by seven days). Skippable: Skip saves nothing and Stubby shrugs. Connecting
 * a calendar is not built, so that row is shown as coming soon and does nothing.
 */
export function FreeScreen() {
  const { next } = useOnboarding();
  const { user } = useAuth();
  const [windows, setWindows] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    if (user) {
      void fetchTaste(user.id).then((t) => {
        if (live && t.windows.length > 0) setWindows((cur) => (cur.length > 0 ? cur : t.windows));
      });
    }
    return () => {
      live = false;
    };
  }, [user]);

  const toggle = (key: string) => {
    setError(null);
    setWindows((cur) => {
      const on = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
      return ALL_WINDOWS.filter((w) => on.includes(w));
    });
  };

  const done = async (value: string[] | null, reaction?: "shrug") => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const saved = user ? await savePrivate(user.id, { free_windows: value }) : { error: null };
    setSaving(false);
    if (saved.error) {
      setError(ERROR_LINE);
      return;
    }
    next(reaction ? { reaction } : undefined);
  };

  return (
    <ScreenFrame
      title="When are you usually free?"
      footer={
        <>
          {error && (
            <p role="alert" className="transfer-label text-small">
              {error}
            </p>
          )}
          <TransferButton onClick={() => void done(windows)} disabled={saving || windows.length === 0}>
            {windows.length === 0 ? "Pick a time" : "Next"}
          </TransferButton>
          <TransferButton variant="plain" onClick={() => void done(null, "shrug")} disabled={saving}>
            Skip for now
          </TransferButton>
        </>
      }
    >
      <TimeGrid windows={windows} onToggle={toggle} />
      <p aria-live="polite" className="transfer-label text-body">
        {windowCountLine(windows.length)}
      </p>
      <button type="button" className="transfer-chip" disabled aria-disabled="true" style={{ opacity: 0.7, cursor: "default" }}>
        <span className="transfer-chip-dot" aria-hidden="true" />
        <span>
          Connect a calendar
          <span className="transfer-chip-sub">Coming soon</span>
        </span>
      </button>
    </ScreenFrame>
  );
}
