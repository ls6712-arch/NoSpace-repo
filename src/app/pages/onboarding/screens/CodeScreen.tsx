import { useCallback, useEffect, useRef, useState } from "react";
import { TransferField } from "../../../components/onboarding/TransferField";
import { useAuth } from "../../../context/AuthContext";
import { plural } from "../../../lib/plural";
import { readEmail } from "../../../lib/onboardingProgress";
import { useNavigate } from "react-router";
import { useOnboarding } from "../OnboardingContext";
import { StepStubby } from "../StepStubby";
import { ScreenFrame } from "./ScreenFrame";

export const CODE_LENGTH = 6;
const RESEND_AFTER_S = 30;
export const WRONG_CODE_LINE = "That code didn’t match. Try again or send a new one.";

/** Screen 3: the 6-digit code from the email. Stubby stamps when it is right and shrugs when it is not. */
export function CodeScreen() {
  const { next, react, redirectTo } = useOnboarding();
  const { sendEmailCode, verifyEmailCode } = useAuth();
  const navigate = useNavigate();
  const email = readEmail();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [sentNew, setSentNew] = useState(false);
  const [wait, setWait] = useState(RESEND_AFTER_S);
  const checked = useRef("");

  // Typed in a new tab, or after a reload that lost it: start again from the email.
  useEffect(() => {
    if (!email) navigate(`/onboarding?step=signup&redirect=${encodeURIComponent(redirectTo)}`, { replace: true });
  }, [email, navigate, redirectTo]);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const check = useCallback(
    async (digits: string) => {
      if (checking || checked.current === digits) return;
      checked.current = digits;
      setChecking(true);
      setError(null);
      const result = await verifyEmailCode(email, digits);
      setChecking(false);
      if (!result.error) {
        next({ stamp: true });
        return;
      }
      react("shrug");
      setError(result.wrong ? WRONG_CODE_LINE : result.error);
    },
    [checking, verifyEmailCode, email, next, react],
  );

  const resend = async () => {
    if (wait > 0) return;
    setError(null);
    const result = await sendEmailCode(email);
    if (result.error) {
      setError(result.error);
      return;
    }
    setCode("");
    checked.current = "";
    setSentNew(true);
    setWait(RESEND_AFTER_S);
  };

  return (
    <ScreenFrame
      title="Check your email"
      intro={`We sent a ${CODE_LENGTH}-digit code to ${email}.`}
      hero={<StepStubby size={140} />}
    >
      <TransferField
        label="Code"
        data-code="true"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={CODE_LENGTH}
        autoFocus
        value={code}
        disabled={checking}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
          setCode(digits);
          setSentNew(false);
          if (error) setError(null);
          if (digits.length === CODE_LENGTH) void check(digits);
          else checked.current = "";
        }}
        error={error}
        hint={sentNew ? "New code sent." : undefined}
      />
      <button type="button" className="transfer-link self-start" disabled={wait > 0} onClick={() => void resend()}>
        {wait > 0 ? `Send a new code in ${plural(wait, "second")}` : "Send a new code"}
      </button>
    </ScreenFrame>
  );
}
