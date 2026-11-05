import { useEffect, useState } from "react";
import { WeeklyHoursEditor } from "../../../components/calendar/WeeklyHoursEditor";
import { hourDrafts, draftWindows, type HourDraft } from "../../../lib/weeklyHours";
import { PillButton } from "../../../components/ui/PillButton";
import { useAuth } from "../../../context/AuthContext";
import { savePrivate } from "../../../lib/onboardingRemote";
import { ERROR_LINE } from "../../../lib/stateCopy";

import { fetchTaste } from "../../../lib/tasteRemote";
import { useOnboarding } from "../OnboardingContext";
import { ScreenFrame } from "./ScreenFrame";

/** Screen 8 shares the exact-hours editor with Calendar. Skip changes no
 * saved hours; connecting an external calendar remains unavailable.
 */
export function FreeScreen() {
  const { next } = useOnboarding();
  const { user } = useAuth();
  const [ranges, setRanges] = useState<HourDraft[]>([]);
  const {windows,error:rangeError}=draftWindows(ranges);
  const [loaded,setLoaded]=useState(!user);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;setLoaded(!user);
    if (user) {
      void fetchTaste(user.id,{strict:true}).then((t) => {
        if (live) {setRanges(hourDrafts(t.windows));setLoaded(true);}
      }).catch(()=>{if(live)setError("Your free times couldn’t load. Try again later.");});
    }
    return () => {
      live = false;
    };
  }, [user?.id]);

  const done = async (value: string[] | null, reaction?: "shrug") => {
    if (saving || !loaded || rangeError) return;
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
          <PillButton data-variant="primary" className="ob-button w-full min-h-14" onClick={() => void done(windows)} disabled={saving || !loaded || !!rangeError || windows.length === 0}>
            {windows.length === 0 ? "Pick a time" : "Next"}
          </PillButton>
          <PillButton data-variant="plain" className="ob-button w-full min-h-14" variant="outline" onClick={() => next({ reaction: "shrug" })} disabled={saving}>
            Skip for now
          </PillButton>
        </>
      }
    >
      <p className="text-small text-muted-foreground">Choose your usual hours. Only you see this.</p>
      <p className="text-caption text-muted-foreground">Times shown in New York.</p>
      <WeeklyHoursEditor ranges={ranges} onChange={setRanges} disabled={!loaded || saving} />
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
