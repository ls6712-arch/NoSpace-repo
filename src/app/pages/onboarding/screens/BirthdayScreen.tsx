import { useState } from "react";
import { useNavigate } from "react-router";
import { PillButton } from "../../../components/ui/PillButton";
import { OnboardingField } from "../../../components/onboarding/OnboardingField";
import { useAuth } from "../../../context/AuthContext";
import { MIN_AGE, checkBirthdate } from "../../../lib/age";
import { removeUnderageAccount, savePrivate } from "../../../lib/onboardingRemote";
import { ERROR_LINE } from "../../../lib/stateCopy";
import { useOnboarding } from "../OnboardingContext";
import { StepStubby } from "../StepStubby";
import { ScreenFrame } from "./ScreenFrame";

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Screen 5: a date of birth, never shown to anyone. Under the minimum age
 * the screen becomes a calm stop: nothing is saved, the account is removed by
 * the next nightly purge (no grace period) and the person is signed out.
 */
export function BirthdayScreen() {
  const { next, setStubby } = useOnboarding();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [birthdate, setBirthdate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const stop = () => {
    setBlocked(true);
    setStubby("tilt");
  };

  const check = birthdate ? checkBirthdate(birthdate) : null;

  const save = async () => {
    if (saving || !birthdate) return;
    const result = checkBirthdate(birthdate);
    if (result === "invalid") {
      setError("That date doesn’t look right.");
      return;
    }
    if (result === "under") {
      stop();
      return;
    }
    setError(null);
    if (!user) {
      next();
      return;
    }
    setSaving(true);
    const saved = await savePrivate(user.id, { birthdate });
    setSaving(false);
    if (saved.underAge) {
      stop();
      return;
    }
    if (saved.error) {
      setError(ERROR_LINE);
      return;
    }
    next();
  };

  const leave = async () => {
    // Nothing about this person was saved but the account itself. The database
    // marks it for the nightly purge, which erases it on its next run, then
    // the person is signed out.
    if (user) await removeUnderageAccount();
    await signOut();
    navigate("/", { replace: true });
  };

  if (blocked) {
    return (
      <ScreenFrame
        title={`Soosh is for people ${MIN_AGE} and over for now.`}
        hero={<StepStubby size={160} />}
        footer={<PillButton data-variant="primary" className="ob-button w-full min-h-14" onClick={() => void leave()}>Log out</PillButton>}
      />
    );
  }

  return (
    <ScreenFrame
      title="When’s your birthday?"
      hero={<StepStubby size={140} />}
      footer={
        <>
          {error && (
            <p role="alert" className="ob-label text-small">
              {error}
            </p>
          )}
          <PillButton data-variant="primary" className="ob-button w-full min-h-14" onClick={() => void save()} disabled={saving || !birthdate}>
            {birthdate ? "Next" : "Add your birthday"}
          </PillButton>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <OnboardingField
          label="Date of birth"
          type="date"
          autoComplete="bday"
          min="1900-01-01"
          max={todayIso()}
          value={birthdate}
          onChange={(e) => {
            setBirthdate(e.target.value);
            setError(null);
          }}
          error={check === "invalid" ? "That date doesn’t look right." : null}
          hint="Never shown to anyone."
        />
      </form>
    </ScreenFrame>
  );
}
