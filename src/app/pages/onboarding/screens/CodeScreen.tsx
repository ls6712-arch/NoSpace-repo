import { useEffect } from "react";
import { useNavigate } from "react-router";
import { CodeEntry } from "../../../components/onboarding/CodeEntry";
import { useAuth } from "../../../context/AuthContext";
import { readEmail } from "../../../lib/onboardingProgress";
import { useOnboarding } from "../OnboardingContext";
import { StepStubby } from "../StepStubby";

/** Screen 3: the 6-digit code from the email. Stubby stamps when it is right and shrugs when it is not. */
export function CodeScreen() {
  const { next, react, setStubby, redirectTo } = useOnboarding();
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
      // Thinking while the code is on its way and while it is checked; then a stamp or a shrug, as before.
      onThinking={(thinking) => setStubby(thinking ? "thinking" : "idle")}
      onWrong={() => react("shrug")}
      onVerified={() => next({ stamp: true })}
      // Same stages as log in, without the password: it is the one way in here.
      // Back to the email step with the address filled in and selected, ready to change.
      onDifferentEmail={() => navigate(`/onboarding?step=signup&email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(redirectTo)}`, { replace: true, state: { n: 0 } })}
    />
  );
}
