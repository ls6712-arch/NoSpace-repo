import { useEffect } from "react";
import { useNavigate } from "react-router";
import { CodeEntry } from "../../../components/onboarding/CodeEntry";
import { useAuth } from "../../../context/AuthContext";
import { readEmail } from "../../../lib/onboardingProgress";
import { useOnboarding } from "../OnboardingContext";
import { StepStubby } from "../StepStubby";

/** Screen 3: the 6-digit code from the email. Stubby stamps when it is right and shrugs when it is not. */
export function CodeScreen() {
  const { next, react, redirectTo } = useOnboarding();
  const { sendEmailCode } = useAuth();
  const navigate = useNavigate();
  const email = readEmail();

  // Typed in a new tab, or after a reload that lost it: start again from the email.
  useEffect(() => {
    if (!email) navigate(`/onboarding?step=signup&redirect=${encodeURIComponent(redirectTo)}`, { replace: true });
  }, [email, navigate, redirectTo]);

  return (
    <CodeEntry
      email={email}
      hero={<StepStubby size={140} />}
      resend={sendEmailCode}
      onWrong={() => react("shrug")}
      onVerified={() => next({ stamp: true })}
    />
  );
}
