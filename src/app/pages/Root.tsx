import { Outlet } from "react-router";
import { useAuth } from "../context/AuthContext";
import { Header } from "../components/Header";
import { CartDrawer } from "../components/CartDrawer";
import { BadgeUnlockToast } from "../components/BadgeUnlockToast";
import { BottomTabBar } from "../components/BottomTabBar";

export function Root() {
  const { loading, isConfigured } = useAuth();

  // Everything worth looking at is open: the spaces, every hobby, Discover,
  // the marketplace, and anyone's public profile. An account is asked for at
  // the point it's actually needed — logging a session, or opening your own
  // profile — because a wall at the front door asks people to commit before
  // they know what they're committing to.
  //
  // Still waits for the initial session check, so the header doesn't flash
  // "Log in" at someone who is in fact already signed in.
  if (isConfigured && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="size-8 rounded-full border-2 border-border border-t-white/70 animate-spin" />
      </div>
    );
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
