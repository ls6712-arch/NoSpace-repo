import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext";
import { Header } from "../components/Header";
import { CartDrawer } from "../components/CartDrawer";
import { BadgeUnlockToast } from "../components/BadgeUnlockToast";
import { BottomTabBar } from "../components/BottomTabBar";

// Only the landing page and the login/signup screen are open to a signed-out
// visitor. Everything else — Discover, Spaces, People, a profile, all of it
// — now requires an account, so this is checked before any of it renders.
const PUBLIC_PATHS = new Set(["/", "/login"]);

// You.tsx and HobbyArchive.tsx (its "you/work/:hobbyKey" sub-page) already
// render their own friendly SignUpPrompt ("Your shelf lives here...") when
// signed out — written for an earlier version of this app where only some
// pages needed an account. The blanket redirect above was added later
// (75e4a0c, "Require sign-in for everything except the landing page and
// login") without an exemption for them, which made that prompt permanently
// unreachable dead code: a signed-out tap on the Profile tab, or a shared
// /you/work/:hobbyKey link, silently bounced to the marketing homepage with
// no explanation of why, rather than showing the page's own explanation and
// a way to sign in. Exempting these two restores that intended prompt;
// every other path still has no fallback of its own and keeps redirecting.
// PublicProfile.tsx (/u/:username) is explicitly "open to anyone with the
// link — no account needed to look" by its own docstring, and /u/:username's
// paginated Studio (/u/:username/studio) is the same visitor-facing surface,
// so both need the same exemption — without it a shared Shelf link silently
// bounced a signed-out visitor to the marketing homepage, the exact failure
// this pattern already exists to prevent for /you. The bare /studio route
// (your own Studio) isn't itself visitor-facing, but Studio.tsx already
// renders its own "Sign in to open your own Studio" message when signed out,
// the same self-handling contract as /you.
const HANDLES_SIGNED_OUT_ITSELF = (pathname: string) =>
  pathname === "/you" ||
  pathname.startsWith("/you/") ||
  pathname === "/studio" ||
  pathname.startsWith("/u/");

export function Root() {
  const { user, profile, loading, isConfigured } = useAuth();
  const location = useLocation();

  // Still waits for the initial session check, so a signed-in visitor isn't
  // bounced to the landing page for a moment before their session loads.
  if (isConfigured && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="size-8 rounded-full border-2 border-border border-t-white/70 animate-spin" />
      </div>
    );
  }

  // Only enforced once accounts are actually available — same rule every
  // other auth-aware check in this app follows (Header, You.tsx): with no
  // Supabase project configured there's no way to sign in, so gating
  // everything behind it would just brick the app.
  if (
    isConfigured &&
    !user &&
    !PUBLIC_PATHS.has(location.pathname) &&
    !HANDLES_SIGNED_OUT_ITSELF(location.pathname)
  ) {
    return <Navigate to="/" replace />;
  }

  // Post-signup onboarding (sql/onboarding-v2.sql), enforced here so it
  // can't be dodged by deep-linking straight past it. Only for a signed-in
  // visitor whose profile has actually loaded and confirms it's not done —
  // `profile` starts out null right after sign-in while loadProfile's own
  // retry loop is still running, and treating that transient null as "not
  // onboarded" would flash the gate at an already-onboarded account on
  // every login. Every pre-existing account was backfilled to true by that
  // same migration, so this only ever catches a genuinely brand-new signup.
  if (user && profile && !profile.onboarding_completed && location.pathname !== "/onboarding") {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/onboarding?redirect=${encodeURIComponent(next)}`} replace />;
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Outlet />
      </main>
      <CartDrawer />
      <BadgeUnlockToast />
      <BottomTabBar />
    </div>
  );
}
