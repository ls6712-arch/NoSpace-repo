import { useEffect, useState } from "react";
import { TimeGrid } from "../../../components/onboarding/TimeGrid";
import { PillButton } from "../../../components/ui/PillButton";
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
  const [loaded,setLoaded]=useState(!user);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;setLoaded(!user);
    if (user) {
      void fetchTaste(user.id,{strict:true}).then((t) => {
        if (live) {setWindows(t.windows);setLoaded(true);}
      }).catch(()=>{if(live)setError("Your free times couldn’t load. Try again later.");});
    }
    return () => {
      live = false;
    };
  }, [user?.id]);

  const toggle = (key: string) => {
    setError(null);
    setWindows((cur) => {
      const on = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
      return ALL_WINDOWS.filter((w) => on.includes(w));
    });
  };

  const done = async (value: string[] | null, reaction?: "shrug") => {
    if (saving || !loaded) return;
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
            <p role="alert" className="ob-label text-small">
              {error}
            </p>
          )}
          <PillButton data-variant="primary" className="ob-button w-full min-h-14" onClick={() => void done(windows)} disabled={saving || !loaded || windows.length === 0}>
            {windows.length === 0 ? "Pick a time" : "Next"}
          </PillButton>
          <PillButton data-variant="plain" className="ob-button w-full min-h-14" variant="outline" onClick={() => next({ reaction: "shrug" })} disabled={saving}>
            Skip for now
          </PillButton>
        </>
      }
    >
      <fieldset disabled={!loaded || saving}><TimeGrid windows={windows} onToggle={toggle} /></fieldset>
      <p aria-live="polite" className="ob-label text-body">
        {windowCountLine(windows.length)}
      </p>
      <button type="button" className="ob-chip" disabled aria-disabled="true" style={{ opacity: 0.7, cursor: "default" }}>
        <span className="ob-chip-dot" aria-hidden="true" />
        <span>
          Connect a calendar
          <span className="ob-chip-sub">Coming soon</span>
        </span>
      </button>
    </ScreenFrame>
  );
}
