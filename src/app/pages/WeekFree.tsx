import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { SignUpPrompt } from "../components/SignUpPrompt";
import { TimeGrid } from "../components/onboarding/TimeGrid";
import { PillButton } from "../components/ui/PillButton";
import { savePrivate } from "../lib/onboardingRemote";
import { ERROR_LINE } from "../lib/stateCopy";
import { ALL_WINDOWS, windowCountLine } from "../lib/tasteModel";
import { fetchTaste } from "../lib/tasteRemote";
import { WEEK_SIGNED_OUT } from "../lib/homeCopy";

/**
 * /week/free: when you are usually free, as a screen of its own. It is the
 * onboarding question (same grid, same save) for someone who is already in:
 * Save writes `free_windows` and goes back to where it was opened from (the
 * Week view says so with `?from=week`; anything else is Home), nothing else follows.
 */
export function WeekFree() {
  const { user } = useAuth();
  return <FreeEditor key={user?.id ?? "guest"} />;
}

function FreeEditor() {
  const { user, isConfigured } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const back = params.get("from") === "week" ? "/calendar?view=week" : "/my-space";
  const [windows, setWindows] = useState<string[]>([]);
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
      if (live) { setWindows(t.windows); setLoaded(true); }
    }).catch(() => { if (live) setError("Your free times couldn’t load. Try again later."); });
    return () => {
      live = false;
    };
  }, [user?.id, attempt]);

  if (isConfigured && !user) {
    return <SignUpPrompt title={WEEK_SIGNED_OUT.title} body={WEEK_SIGNED_OUT.body} cta={WEEK_SIGNED_OUT.cta} />;
  }

  const toggle = (key: string) => {
    setError(null);
    setWindows((cur) => {
      const on = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
      return ALL_WINDOWS.filter((w) => on.includes(w));
    });
  };

  const save = async () => {
    if (saving || !loaded || !user) return;
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
      <div className="mx-auto flex w-full max-w-xl flex-col px-4 pb-8">
        <Link to={back} className="ob-icon-button -ml-2 mt-4" aria-label="Back">
          <ArrowLeft className="size-6" strokeWidth={2.5} aria-hidden="true" />
        </Link>
        <section className="flex flex-col pb-6" aria-busy={!loaded && !error}>
          <h1 className="mt-8 break-words text-title">When are you usually free?</h1>
          <div className="mt-6 flex flex-col gap-4">
            <fieldset disabled={!loaded || saving}><TimeGrid windows={windows} onToggle={toggle} showTimes /></fieldset>
            <p aria-live="polite" className="ob-label text-body">
              {windowCountLine(windows.length)}
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-3">
            {error && (
              <p role="alert" className="ob-label text-small">
                {error}
              </p>
            )}
            {!loaded && error && <button type="button" className="min-h-11 self-start text-body font-semibold underline" onClick={() => setAttempt((n) => n + 1)}>Retry</button>}
            <PillButton data-variant="primary" className="ob-button w-full min-h-14" onClick={() => void save()} disabled={saving || !loaded}>
              Save
            </PillButton>
          </div>
        </section>
      </div>
    </div>
  );
}
