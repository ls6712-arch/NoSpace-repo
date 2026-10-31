import { useEffect, useState } from "react";
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
  const { user, isConfigured } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const back = params.get("from") === "week" ? "/week" : "/my-space";
  const [windows, setWindows] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let live = true;
    void fetchTaste(user.id).then((t) => {
      if (live && t.windows.length > 0) setWindows((cur) => (cur.length > 0 ? cur : t.windows));
    });
    return () => {
      live = false;
    };
  }, [user]);

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
    if (saving || !user) return;
    setSaving(true);
    setError(null);
    const saved = await savePrivate(user.id, { free_windows: windows.length > 0 ? windows : null });
    setSaving(false);
    if (saved.error) {
      setError(ERROR_LINE);
      return;
    }
    navigate(back, { replace: true });
  };

  return (
    <div className="min-h-viewport">
      <div className="ob-column flex min-h-viewport flex-col px-4">
        <Link to={back} className="ob-icon-button -ml-2 mt-4" aria-label="Back">
          <ArrowLeft className="size-6" strokeWidth={2.5} aria-hidden="true" />
        </Link>
        <section className="flex flex-1 flex-col pb-6">
          <h1 className="mt-8 break-words text-title">When are you usually free?</h1>
          <div className="mt-6 flex flex-col gap-4">
            <TimeGrid windows={windows} onToggle={toggle} />
            <p aria-live="polite" className="ob-label text-body">
              {windowCountLine(windows.length)}
            </p>
          </div>
          <div className="mt-auto flex flex-col gap-3 pt-8">
            {error && (
              <p role="alert" className="ob-label text-small">
                {error}
              </p>
            )}
            <PillButton data-variant="primary" className="ob-button w-full min-h-14" onClick={() => void save()} disabled={saving}>
              Save
            </PillButton>
          </div>
        </section>
      </div>
    </div>
  );
}
