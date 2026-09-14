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

export function Root() {
  const { user, loading, isConfigured } = useAuth();
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
  if (isConfigured && !user && !PUBLIC_PATHS.has(location.pathname)) {
    return <Navigate to="/" replace />;
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
