import { useEffect, useRef, useState } from "react";
import { ChoiceChip } from "../../../components/onboarding/ChoiceChip";
import { PillButton } from "../../../components/ui/PillButton";
import { OnboardingField } from "../../../components/onboarding/OnboardingField";
import { useAuth } from "../../../context/AuthContext";
import { savePrivate } from "../../../lib/onboardingRemote";
import { ERROR_LINE } from "../../../lib/stateCopy";
import { BUDGETS, budgetLabel, newPass, PASS_KINDS, PLACE_MAX, type Budget, type Pass, type PassKind } from "../../../lib/tasteModel";
import { fetchPasses, fetchTaste, newPassId, savePasses } from "../../../lib/tasteRemote";
import { useOnboarding } from "../OnboardingContext";
import { ScreenFrame } from "./ScreenFrame";

/**
 * Screen 9: "What’s already yours?" Passes and gear (a kind, and optionally
 * where), then "A month for doing things". One pass per kind; tapping the kind
 * again takes it off. Skip sits in the budget row at the same weight as the
 * amounts: it saves no budget, and Stubby shrugs. Nothing here says what a pass
 * saves; that is not known yet.
 */
export function YoursScreen() {
  const { next, react } = useOnboarding();
  const { user } = useAuth();
  const [passes, setPasses] = useState<Pass[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedIds = useRef<string[]>([]);
  const touched = useRef(false);

  useEffect(() => {
    let live = true;
    if (user) {
      void Promise.all([fetchPasses(user.id), fetchTaste(user.id)]).then(([saved, taste]) => {
        if (!live || touched.current) return;
        savedIds.current = saved.map((p) => p.id);
        setPasses(saved);
        setBudget(taste.budget);
      });
    }
    return () => {
      live = false;
    };
  }, [user]);

  const toggleKind = (kind: PassKind) => {
    touched.current = true;
    setError(null);
    const has = passes.some((p) => p.kind === kind);
    if (has) {
      setPasses(passes.filter((p) => p.kind !== kind));
    } else {
      setPasses([...passes, newPass(kind, newPassId())]);
      react("yours");
    }
  };
  const setPlace = (id: string, place: string) => {
    touched.current = true;
    setPasses(passes.map((p) => (p.id === id ? { ...p, place: place.slice(0, PLACE_MAX) } : p)));
  };
  const pickBudget = (b: Budget) => {
    touched.current = true;
    setError(null);
    setSkipped(false);
    setBudget(budget === b ? null : b);
  };
  const skipBudget = () => {
    touched.current = true;
    setError(null);
    if (skipped) {
      setSkipped(false);
      return;
    }
    setSkipped(true);
    setBudget(null);
    react("shrug");
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    let failed = false;
    if (user) {
      const [a, b] = await Promise.all([
        savePrivate(user.id, { monthly_budget: skipped ? null : budget }),
        savePasses(user.id, passes, savedIds.current),
      ]);
      failed = !!a.error || !!b.error;
      if (!failed) savedIds.current = passes.map((p) => p.id);
    }
    setSaving(false);
    if (failed) {
      setError(ERROR_LINE);
      return;
    }
    next({ stamp: true });
  };

  return (
    <ScreenFrame
      title="What’s already yours?"
      footer={
        <>
          {error && (
            <p role="alert" className="ob-label text-small">
              {error}
            </p>
          )}
          <PillButton data-variant="primary" className="ob-button w-full min-h-14" onClick={() => void save()} disabled={saving}>
            Next
          </PillButton>
        </>
      }
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="ob-label mb-2 text-small">Passes and gear</legend>
        <ul className="grid grid-cols-2 gap-2">
          {PASS_KINDS.map((k) => (
            <li key={k.kind}>
              <ChoiceChip pressed={passes.some((p) => p.kind === k.kind)} onToggle={() => toggleKind(k.kind)}>
                {k.label}
              </ChoiceChip>
            </li>
          ))}
        </ul>
      </fieldset>
      {passes.map((p) => (
        <OnboardingField
          key={p.id}
          label={`${p.label} place (optional)`}
          autoComplete="off"
          maxLength={PLACE_MAX}
          value={p.place}
          onChange={(e) => setPlace(p.id, e.target.value)}
        />
      ))}
      <fieldset className="flex flex-col gap-2">
        <legend className="ob-label text-body">A month for doing things</legend>
        <p className="mb-1 text-small ob-muted">Only you see this.</p>
        <ul className="grid grid-cols-2 gap-2">
          {BUDGETS.map((b) => (
            <li key={b}>
              <ChoiceChip pressed={!skipped && budget === b} onToggle={() => pickBudget(b)}>
                {budgetLabel(b)}
              </ChoiceChip>
            </li>
          ))}
          <li>
            <ChoiceChip pressed={skipped} onToggle={skipBudget}>
              Skip
            </ChoiceChip>
          </li>
        </ul>
        <p aria-live="polite" className={skipped ? "text-small ob-muted" : "sr-only"}>
          {skipped ? "Your first plan will use free things and what your passes cover." : ""}
        </p>
      </fieldset>
    </ScreenFrame>
  );
}
