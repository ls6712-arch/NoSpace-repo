import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { SignUpPrompt } from "../components/SignUpPrompt";
import { WeeklyHoursEditor } from "../components/calendar/WeeklyHoursEditor";
import { draftWindows, hourDrafts, type HourDraft } from "../lib/weeklyHours";
import { PillButton } from "../components/ui/PillButton";
import { savePrivate } from "../lib/onboardingRemote";
import { ERROR_LINE } from "../lib/stateCopy";

import { fetchTaste } from "../lib/tasteRemote";
import { WEEK_SIGNED_OUT } from "../lib/homeCopy";

/** Owner-only exact weekly hours. Loading must succeed before an explicit
 * save changes free_windows; Calendar, onboarding and Settings share the model.
 */
export function WeekFree() {
  const { user } = useAuth();
  return <FreeEditor key={user?.id ?? "guest"} />;
}

function FreeEditor() {
  const { user, isConfigured } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const back = params.get("from") === "week" ? "/calendar?view=week" : params.get("from") === "settings" ? "/settings" : "/my-space";
  const [ranges, setRanges] = useState<HourDraft[]>([]);
  const [legacy, setLegacy] = useState(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let live = true;
    setLoaded(false);
    setError(null);
    void fetchTaste(user.id, { strict: true }).then((t) => {
      if (live) { setRanges(hourDrafts(t.windows)); setLegacy(t.windows.some(w=>w.includes("-day") || w.includes("-eve"))); setLoaded(true); }
    }).catch(() => { if (live) setError("Your free times couldn’t load. Try again later."); });
    return () => {
      live = false;
    };
  }, [user?.id, attempt]);

  if (isConfigured && !user) {
    return <SignUpPrompt title={WEEK_SIGNED_OUT.title} body={WEEK_SIGNED_OUT.body} cta={WEEK_SIGNED_OUT.cta} />;
  }

  const save = async () => {
    if (saving || !loaded || !user) return;
    const {windows,error:issue}=draftWindows(ranges);
    if(issue){setError(issue);return;}
    setSaving(true);
    setError(null);
    try {
      // [] is an explicit empty usual week; null means the question was skipped.
      const saved = await savePrivate(user.id, { free_windows: windows });
      if (!active.current) return;
      if (saved.error) { setError(ERROR_LINE); return; }
      navigate(back, { replace: true });
    } catch {
      if (active.current) setError(ERROR_LINE);
    } finally {
      if (active.current) setSaving(false);
    }
  };

  return (
    <div className="min-h-viewport">
      <div className="ob-column flex w-full flex-col px-4 pb-8">
        <Link to={back} className="ob-icon-button -ml-2 mt-4" aria-label="Back">
          <ArrowLeft className="size-6" strokeWidth={2.5} aria-hidden="true" />
        </Link>
        <section className="flex flex-col pb-6" aria-busy={!loaded && !error}>
          <h1 className="mt-8 break-words text-title">When are you usually free?</h1>
          <div className="mt-6 flex flex-col gap-4">
            <p className="text-small text-muted-foreground">Choose your usual hours. Only you see this.</p>
            <p className="text-caption text-muted-foreground">Times shown in New York.</p>
            {legacy && <p className="text-small text-muted-foreground">Your earlier daytime and evening choices are shown below. Adjust them before saving.</p>}
            <WeeklyHoursEditor ranges={ranges} disabled={!loaded || saving} onChange={next=>{setRanges(next);setError(null);}} />
          </div>
          <div className="sticky bottom-20 z-10 mt-6 flex flex-col gap-3 rounded-card bg-background py-3 tab:bottom-4">
            {error && (
              <p role="alert" className="ob-label text-small">
                {error}
              </p>
            )}
            {!loaded && error && <button type="button" className="min-h-11 self-start text-body font-semibold underline" onClick={() => setAttempt((n) => n + 1)}>Retry</button>}
            <PillButton data-variant="primary" className="ob-button w-full min-h-14" onClick={() => void save()} disabled={saving || !loaded || !!draftWindows(ranges).error}>
              Save
            </PillButton>
          </div>
        </section>
      </div>
    </div>
  );
}
