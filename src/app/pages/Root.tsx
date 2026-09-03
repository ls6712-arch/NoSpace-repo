import { Outlet } from "react-router";
import { useAuth } from "../context/AuthContext";
import { Header } from "../components/Header";
import { CartDrawer } from "../components/CartDrawer";
import { BadgeUnlockToast } from "../components/BadgeUnlockToast";
import { Login } from "./Login";

export function Root() {
  const { user, loading, isConfigured } = useAuth();

  // Accounts are the front door now: nothing renders — not even the
  // marketing homepage — until you're signed in. (When accounts aren't
  // configured on this build at all, there's no way to sign in, so this
  // step is skipped rather than locking the app with no way through.)
  if (isConfigured && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="size-8 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
      </div>
    );
  }

  if (isConfigured && !user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Outlet />
      </main>
      <CartDrawer />
      <BadgeUnlockToast />
    </div>
  );
}
