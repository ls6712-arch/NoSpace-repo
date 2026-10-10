import { Navigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { Landing } from "../landing/Landing";

/**
 * "/" is the signed-out landing page, and nothing else. Anyone signed in goes
 * straight to Home (the feed behind the "Home" nav link, /my-space). Root.tsx
 * has already sent a pending or not-yet-onboarded account to its own screen
 * before this renders.
 */
export function Home() {
  const { user } = useAuth();
  return user ? <Navigate to="/my-space" replace /> : <Landing />;
}
