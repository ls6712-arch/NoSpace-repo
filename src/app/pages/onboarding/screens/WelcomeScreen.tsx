import { useEffect } from "react";
import { useNavigate } from "react-router";
import { PillButton } from "../../../components/ui/PillButton";
import { PersonAvatar } from "../../CreatePursuit";
import { useOnboarding } from "../OnboardingContext";
import { StepStubby } from "../StepStubby";
import { useArrival } from "../useArrival";
import { ScreenFrame } from "./ScreenFrame";

/**
 * Screen 1. Nothing is asked. From an invite link it becomes the arrival:
 * the friend's half slides in on Stubby and the one button takes it.
 */
export function WelcomeScreen() {
  const { next, inviteCode, redirectTo, setStubby } = useOnboarding();
  const navigate = useNavigate();
  const arrival = useArrival(inviteCode, redirectTo);

  useEffect(() => {
    if (arrival) setStubby("arrived");
  }, [arrival, setStubby]);

  if (arrival) {
    return (
      <ScreenFrame
        title={`${arrival.name} saved you a spot`}
        intro={arrival.note ? `“${arrival.note.slice(0, 200)}”` : undefined}
        hero={
          <div className="flex flex-col items-center gap-6">
            <StepStubby size={240} followPointer />
            <PersonAvatar name={arrival.name} src={arrival.avatar ?? undefined} size="size-14" />
          </div>
        }
        footer={<PillButton data-variant="primary" className="ob-button w-full min-h-14" onClick={() => next()}>Take my half</PillButton>}
      />
    );
  }

  return (
    <ScreenFrame
      display
      title="Stop saying you’ll do it."
      hero={<StepStubby size={260} followPointer />}
      footer={
        <>
          <PillButton data-variant="primary" className="ob-button w-full min-h-14" onClick={() => next()}>Get started</PillButton>
          <button type="button" className="ob-link self-center" onClick={() => navigate("/login?mode=signin")}>
            I already have an account
          </button>
        </>
      }
    />
  );
}
