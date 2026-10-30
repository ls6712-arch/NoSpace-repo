import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ScreenFrame } from "../../pages/onboarding/screens/ScreenFrame";
import { useAuth } from "../../context/AuthContext";
import { codeWaitLine, TOO_MANY_CODES_LINE, TOO_MANY_CODES_SIGNUP_LINE } from "../../lib/authCopy";
import { formatCountdown } from "../../lib/countdown";
import { TransferButton } from "./TransferButton";
import { TransferField } from "./TransferField";

export const CODE_LENGTH = 6;
/** Seconds before a new code can be asked for, and before the screen offers other ways in. */
export const RESEND_AFTER_S = 30;
export const WRONG_CODE_LINE = "That code didn’t match. Try again or send a new one.";

/**
 * The 6-digit code screen, shared by sign-up (CodeScreen) and log in, in
 * two stages. For the first 30 seconds: "Check your inbox at {email}.",
 * "Codes usually arrive in under a minute." and a countdown to a new code.
 * After that: "Still nothing? Check your spam folder." and equal options to
 * send a new code, log in with a password (log in only) or use a different email.
 *
 * Nothing on it depends on whether the address has an account: a late code
 * must never suggest the person is new, so known and unknown emails see the
 * same words at the same times. The code is checked as soon as the sixth digit
 * is typed. The caller owns what Stubby does and which email call a resend
 * uses: a sign-up code may create the account, a log in code never does.
 */
export function CodeEntry({
  email,
  hero,
  resend,
  onChecking,
  onThinking,
  onWrong,
  onVerified,
  onDifferentEmail,
  onPassword,
  footer,
}: {
  email: string;
  hero: ReactNode;
  resend: (email: string) => Promise<{ error: string | null; retryAfterSeconds?: number; tooMany?: boolean }>;
  onChecking?: (checking: boolean) => void;
  /**
   * Stubby thinks while the person waits for the code to arrive and while a code is being
   * checked: true on open and when a check starts, false when they start typing or the
   * 30 seconds are up. A wrong or right code is the caller's own reaction (shrug, stamp).
   */
  onThinking?: (thinking: boolean) => void;
  onWrong: () => void;
  onVerified: () => void;
  onDifferentEmail: () => void;
  /** Log in only: sign-up has no password. Leave out and the option is not shown. */
  onPassword?: () => void;
  /** Always shown under the screen, from the first second ("New to Soosh? Get started" on log in). */
  footer?: ReactNode;
}) {
  const { verifyEmailCode } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [sentNew, setSentNew] = useState(false);
  const [wait, setWait] = useState(RESEND_AFTER_S);
  const [sending, setSending] = useState(false);
  // Seconds left before another code can be asked for, after the limit was hit. Not an error.
  const [limitWait, setLimitWait] = useState(0);
  // Worded once when the limit is hit, so a screen reader hears it once, not every second.
  const [limitLine, setLimitLine] = useState("");
  // The hourly cap has no time to give, so it is a line with no countdown and no held button.
  const [tooMany, setTooMany] = useState(false);
  const checked = useRef("");
  const late = wait <= 0;

  const think = useRef(onThinking);
  think.current = onThinking;
  // Waiting for the code: thinking from the moment the screen opens.
  useEffect(() => {
    think.current?.(true);
  }, []);
  // The 30 seconds are up: no longer "waiting for it to arrive".
  useEffect(() => {
    if (late) think.current?.(false);
  }, [late]);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  useEffect(() => {
    if (limitWait <= 0) return;
    const id = setTimeout(() => setLimitWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [limitWait]);

  const check = useCallback(
    async (digits: string) => {
      if (checking || checked.current === digits) return;
      checked.current = digits;
      setChecking(true);
      onChecking?.(true);
      think.current?.(true);
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
    if (!late || sending || limitWait > 0) return;
    setSending(true);
    setError(null);
    const result = await resend(email);
    setSending(false);
    if (result.retryAfterSeconds) {
      setTooMany(false);
      setLimitLine(codeWaitLine(result.retryAfterSeconds));
      setLimitWait(result.retryAfterSeconds);
      return;
    }
    if (result.tooMany) {
      // No guessed time: say it is too many, and point at the password when there is one.
      setLimitWait(0);
      setLimitLine(onPassword ? TOO_MANY_CODES_LINE : TOO_MANY_CODES_SIGNUP_LINE);
      setTooMany(true);
      return;
    }
    if (result.error) {
      setError(result.error);
      return;
    }
    setCode("");
    checked.current = "";
    setLimitWait(0);
    setTooMany(false);
    setSentNew(true);
    setWait(RESEND_AFTER_S);
  };

  return (
    <ScreenFrame
      title={`Check your inbox at ${email}.`}
      intro={late ? undefined : "Codes usually arrive in under a minute."}
      hero={hero}
      footer={footer}
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
          // They have the code: no longer waiting for it.
          if (code.length === 0 && digits.length > 0 && !late) think.current?.(false);
          setCode(digits);
          setTooMany(false);
          setSentNew(false);
          if (error) setError(null);
          if (digits.length === CODE_LENGTH) void check(digits);
          else checked.current = "";
        }}
        error={error}
        hint={limitWait > 0 || tooMany ? limitLine : sentNew ? "New code sent." : undefined}
      />
      {/* Announced once when the second stage starts; the ticking countdown is outside it on purpose. */}
      <div aria-live="polite">{late && <p className="text-body transfer-muted">Still nothing? Check your spam folder.</p>}</div>
      {late ? (
        <div className="flex flex-col gap-3">
          <TransferButton variant="plain" disabled={sending || limitWait > 0} onClick={() => void sendNew()}>
            Send a new code
          </TransferButton>
          {onPassword && (
            <TransferButton variant="plain" onClick={onPassword}>
              Log in with password
            </TransferButton>
          )}
          <TransferButton variant="plain" onClick={onDifferentEmail}>
            Use a different email
          </TransferButton>
        </div>
      ) : (
        <p className="text-small transfer-muted">{`Send a new code in ${formatCountdown(wait)}`}</p>
      )}
    </ScreenFrame>
  );
}
