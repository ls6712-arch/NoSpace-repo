import { Navigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { Landing } from "../landing/Landing";
import { signUpLanding } from "../lib/signUpReturn";

/**
 * "/" is the signed-out landing page, and nothing else. Anyone signed in goes
 * straight to Home (the feed behind the "Home" nav link, /my-space). Root.tsx
 * has already sent a pending or not-yet-onboarded account to its own screen
 * before this renders. Someone who has just signed up from Stubby goes back to Stubby instead
 * (see signUpLanding), so this redirect and SignUpReturnEffect's agree whichever runs last.
 */
export function Home() {
  const { user } = useAuth();
  return user ? <Navigate to={signUpLanding() ?? "/my-space"} replace /> : <Landing />;
}
