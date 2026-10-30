import { useState } from "react";
import { TransferButton } from "../../../components/onboarding/TransferButton";
import { useAuth } from "../../../context/AuthContext";
import { clearHalf, readHalf } from "../../../lib/firstPlanHandoff";
import { ERROR_LINE } from "../../../lib/stateCopy";
import { useOnboarding } from "../OnboardingContext";
import { StepStubby } from "../StepStubby";
import { ScreenFrame } from "./ScreenFrame";

/** The message that goes with the link: what, when, and that it opens without the app. */
export function shareMessage(title: string, when: string | null): string {
  return `I’m doing ${title}${when ? ` on ${when}` : ""}. Take the other half:`;
}

/**
 * Screen 12: "Who gets the other half?" The link is to the small Pursuit made
 * on the last screen, and it opens in a browser with no app: it lands on the
 * invite arrival screen. Send opens the phone's share sheet (where the
 * contacts and messaging apps are), or copies the link when there is none.
 * Stubby tears the tab off on send. The whole screen is optional.
 */
export function InviteScreen() {
  const { next } = useOnboarding();
  const { user } = useAuth();
  const [half] = useState(() => readHalf(user?.id));
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = (sent: boolean) => {
    clearHalf();
    next(sent ? { reaction: "torn" } : undefined);
  };

  const send = async () => {
    if (!half) return;
    setError(null);
    const text = shareMessage(half.title, half.when);
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title: half.title, text, url: half.url });
        finish(true);
        return;
      }
      await navigator.clipboard.writeText(`${text} ${half.url}`);
      setCopied(true);
      finish(true);
    } catch (e) {
      // Closing the share sheet is not an error and sends nothing.
      if ((e as { name?: string })?.name === "AbortError") return;
      setError(ERROR_LINE);
    }
  };

  return (
    <ScreenFrame
      title="Who gets the other half?"
      hero={<StepStubby size={140} />}
      intro={half ? `${half.title}${half.when ? `, ${half.when}` : ""}` : undefined}
      footer={
        <>
          {error && (
            <p role="alert" className="transfer-label text-small">
              {error}
            </p>
          )}
          <p aria-live="polite" className={copied ? "transfer-label text-small" : "sr-only"}>
            {copied ? "Link copied" : ""}
          </p>
          <TransferButton onClick={() => void send()} disabled={!half}>
            {half ? "Send" : "Nothing to send"}
          </TransferButton>
          <TransferButton variant="plain" onClick={() => finish(false)}>
            Skip for now
          </TransferButton>
        </>
      }
    />
  );
}
