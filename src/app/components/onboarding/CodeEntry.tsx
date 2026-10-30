import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ScreenFrame } from "../../pages/onboarding/screens/ScreenFrame";
import { useAuth } from "../../context/AuthContext";
import { plural } from "../../lib/plural";
import { TransferField } from "./TransferField";

export const CODE_LENGTH = 6;
const RESEND_AFTER_S = 30;
export const WRONG_CODE_LINE = "That code didn’t match. Try again or send a new one.";

/**
 * The 6-digit code screen, shared by sign-up (CodeScreen) and log in. It
 * checks the code as soon as the sixth digit is typed. The caller owns what
 * Stubby does (`onWrong`, `onVerified`) and which email call a resend uses: a
 * sign-up code may create the account, a log in code never does.
 */
export function CodeEntry({
  email,
  hero,
  resend,
  onChecking,
  onWrong,
  onVerified,
}: {
  email: string;
  hero: ReactNode;
  resend: (email: string) => Promise<{ error: string | null }>;
  onChecking?: (checking: boolean) => void;
  onWrong: () => void;
  onVerified: () => void;
}) {
  const { verifyEmailCode } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [sentNew, setSentNew] = useState(false);
  const [wait, setWait] = useState(RESEND_AFTER_S);
  const checked = useRef("");

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
      onChecking?.(true);
      setError(null);
      const result = await verifyEmailCode(email, digits);
      setChecking(false);
      onChecking?.(false);
      if (!result.error) {
        onVerified();
        return;
      }
      onWrong();
      setError(result.wrong ? WRONG_CODE_LINE : result.error);
    },
    [checking, verifyEmailCode, email, onChecking, onVerified, onWrong],
  );

  const sendNew = async () => {
    if (wait > 0) return;
    setError(null);
    const result = await resend(email);
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
    <ScreenFrame title="Check your email" intro={`We sent a ${CODE_LENGTH}-digit code to ${email}.`} hero={hero}>
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
      <button type="button" className="transfer-link self-start" disabled={wait > 0} onClick={() => void sendNew()}>
        {wait > 0 ? `Send a new code in ${plural(wait, "second")}` : "Send a new code"}
      </button>
    </ScreenFrame>
  );
}
