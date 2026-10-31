import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { HalfTicket } from "../../../components/onboarding/HalfTicket";
import { PillButton } from "../../../components/ui/PillButton";
import { useAuth } from "../../../context/AuthContext";
import { downloadIcs } from "../../../lib/calendarFile";
import { clearHalf, readHalf } from "../../../lib/firstPlanHandoff";
import { ERROR_LINE } from "../../../lib/stateCopy";
import { firstName } from "../../../lib/tasteModel";
import { useOnboarding } from "../OnboardingContext";
import { StepStubby } from "../StepStubby";
import { ScreenFrame } from "./ScreenFrame";

/** How long Stubby's tab takes to come off before it settles. */
const TORN_BEAT_MS = 1500;

/** The message that goes with the link: what, when, and that it opens without the app. */
export function shareMessage(title: string, when: string | null): string {
  return `I’m doing ${title}${when ? ` on ${when}` : ""}. Take the other half:`;
}

/**
 * Screen 12: "Who gets the other half?" It shows the half a friend will get
 * (their stamp, "{FirstName} saved you a spot", the plan and when). The link is
 * to the small Pursuit made on the last screen, and it opens in a browser with
 * no app: it lands on the invite arrival screen. Send opens the phone's share
 * sheet (where the contacts and messaging apps are), or copies the link where
 * there is none. After it goes, Stubby tears the tab off and settles, the
 * screen says "Sent. Now it’s a plan." and the only way on is "See my week"
 * (Home). Send and Skip are gone by then. The whole screen is optional.
 */
export function InviteScreen() {
  const { finish, setStubby } = useOnboarding();
  const { user, profile } = useAuth();
  const reduce = useReducedMotion() ?? false;
  const [half] = useState(() => readHalf(user?.id));
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(settle.current), []);
  const from = firstName(profile?.display_name ?? "") || "A friend";

  const leave = () => {
    clearHalf();
    finish("/");
  };

  const afterSend = () => {
    setSent(true);
    setStubby("torn");
    settle.current = setTimeout(() => setStubby("stamped"), reduce ? 0 : TORN_BEAT_MS);
  };

  const send = async () => {
    if (!half) return;
    setError(null);
    const text = shareMessage(half.title, half.when);
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title: half.title, text, url: half.url });
        afterSend();
        return;
      }
      await navigator.clipboard.writeText(`${text} ${half.url}`);
      setCopied(true);
      afterSend();
    } catch (e) {
      // Closing the share sheet is not an error and sends nothing.
      if ((e as { name?: string })?.name === "AbortError") return;
      setError(ERROR_LINE);
    }
  };

  if (sent && half) {
    return (
      <ScreenFrame
        title="Sent. Now it’s a plan."
        hero={<StepStubby size={150} />}
        intro={copied ? "Link copied" : undefined}
        footer={<PillButton data-variant="primary" className="ob-button w-full min-h-14" onClick={leave}>See my week</PillButton>}
      >
        <HalfTicket from={from} title={half.title} when={half.when} />
        {half.startsAt !== null && (
          <button type="button" className="ob-link self-center" onClick={() => downloadIcs({ title: half.title, startsAt: half.startsAt as number, where: half.where })}>
            Add to calendar
          </button>
        )}
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame
      title="Who gets the other half?"
      hero={<StepStubby size={110} />}
      footer={
        <>
          {error && (
            <p role="alert" className="ob-label text-small">
              {error}
            </p>
          )}
          <PillButton data-variant="primary" className="ob-button w-full min-h-14" onClick={() => void send()} disabled={!half}>
            {half ? "Send" : "Nothing to send"}
          </PillButton>
          <PillButton data-variant="plain" className="ob-button w-full min-h-14" variant="outline" onClick={leave}>
            Skip for now
          </PillButton>
        </>
      }
    >
      {half && <HalfTicket from={from} title={half.title} when={half.when} />}
    </ScreenFrame>
  );
}
