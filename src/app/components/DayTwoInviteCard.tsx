import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchInviteAsk } from "../lib/invites";
import { OnboardingInviteCard } from "./OnboardingInviteCard";

/**
 * Step 4c · the Day-2 invite ask, on My Space. Shows only when the server
 * says it's time (my_invite_ask(): a day-old account whose first moment has
 * a written thought from someone else, with invites left and none sent yet).
 *
 * "Not now" / "Done" hides it in this browser. Remembering that is a
 * per-viewer convenience, so localStorage is enough; it's wrapped in
 * try/catch and the card works without it. Once they send an invite the
 * server stops asking anyway.
 */
const DISMISS_KEY = (uid: string) => `soosh:day2-invite-dismissed:${uid}`;

function isDismissed(uid: string): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY(uid)) === "1";
  } catch {
    return false;
  }
}

function dismiss(uid: string) {
  try {
    window.localStorage.setItem(DISMISS_KEY(uid), "1");
  } catch {
    // Storage blocked — the card just shows again next visit.
  }
}

export function DayTwoInviteCard() {
  const { user, profile } = useAuth();
  const [invitesLeft, setInvitesLeft] = useState(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!user || profile?.access !== "active" || isDismissed(user.id)) return;
    let cancelled = false;
    void fetchInviteAsk().then((n) => {
      if (!cancelled) setInvitesLeft(n);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, profile?.access]);

  if (!user || hidden || invitesLeft <= 0) return null;

  return (
    <section
      aria-label="Invite someone"
      className="mb-6 rounded-2xl border border-border bg-card p-4 sm:p-5"
    >
      <OnboardingInviteCard
        variant="card"
        invitesLeft={invitesLeft}
        onDone={() => {
          dismiss(user.id);
          setHidden(true);
        }}
      />
    </section>
  );
}
