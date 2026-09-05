import { useAuth } from "../context/AuthContext";
import { Home } from "./Home";
import { MySpace } from "./MySpace";

/**
 * What "/" is depends on whether anyone is home.
 *
 * My Space is a personalised feed, which means nothing to someone who has
 * just arrived — so a visitor gets the landing page that explains what
 * NoSpace is, and a signed-in person gets their own space. The wordmark
 * points here from everywhere, and lands each of them somewhere that makes
 * sense rather than the same page for both.
 *
 * While the session is still resolving, show the landing page rather than an
 * empty feed: it reads as deliberate either way, and a signed-in person sees
 * it for a fraction of a second at most.
 */
export function Start() {
  const { user, loading, isConfigured } = useAuth();

  // No accounts on this build — everyone is a visitor.
  if (!isConfigured) return <Home />;
  if (loading) return <Home />;
  return user ? <MySpace /> : <Home />;
}
