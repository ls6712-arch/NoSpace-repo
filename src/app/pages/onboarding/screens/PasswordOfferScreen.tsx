import { useState } from "react";
import { useReducedMotion } from "motion/react";
import { TransferButton } from "../../../components/onboarding/TransferButton";
import { TransferField } from "../../../components/onboarding/TransferField";
import { useAuth } from "../../../context/AuthContext";
import { useOnboarding } from "../OnboardingContext";
import { StepStubby } from "../StepStubby";
import { ScreenFrame } from "./ScreenFrame";

export const PASSWORD_MIN = 10;
/** How long the punch has to land before the name screen takes over. */
const YOURS_BEAT_MS = 900;

/**
 * Optional, one time, right after an email code is accepted: "Want a
 * password too?". It is not one of the numbered screens and has no Back.
 * Both answers are the same size. Google and Apple people never see it.
 */
export function PasswordOfferScreen({ onDone }: { onDone: () => void }) {
  const { updatePassword } = useAuth();
  const { react } = useOnboarding();
  const reduce = useReducedMotion() ?? false;
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (saving) return;
    if (password.length < PASSWORD_MIN) {
      setError(`Your password needs at least ${PASSWORD_MIN} characters.`);
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updatePassword(password);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    // Stubby punches its tab ("yours"); the next screen waits for that to land.
    react("yours");
    if (reduce) onDone();
    else setTimeout(onDone, YOURS_BEAT_MS);
  };

  return (
    <ScreenFrame
      title="Want a password too?"
      intro="Optional. You can always log in with a code."
      hero={<StepStubby size={140} />}
      footer={
        <>
          <TransferButton variant="plain" disabled={saving} onClick={() => void add()}>
            Add a password
          </TransferButton>
          <TransferButton variant="plain" disabled={saving} onClick={onDone}>
            Skip for now
          </TransferButton>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <TransferField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint={`At least ${PASSWORD_MIN} characters.`}
          error={error}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
        />
      </form>
    </ScreenFrame>
  );
}
