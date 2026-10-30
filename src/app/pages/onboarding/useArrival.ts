import { useEffect, useState } from "react";
import { fetchInvitePreview } from "../../lib/invites";
import { joinTokenFrom } from "../../lib/joinToken";
import { saveInviteCode } from "../../lib/inviteCode";
import { fetchInvitePreview as fetchPursuitInvite } from "../../lib/pursuitsRemote";
import { fetchInviteCorner } from "../../lib/tasteRemote";

/** A friend whose half the person is arriving with, from `?invite=CODE` or `?redirect=/join/TOKEN`. */
export interface Arrival {
  name: string;
  avatar: string | null;
  /** A line the friend wrote with the invite, if any. */
  note: string | null;
  /** The Corner of the friend's Pursuit ("space/slug"), when the link is for one and the person is signed in to ask. */
  cornerKey?: string;
}

/**
 * Looks the friend up once. An invite that is invalid, used or expired is no
 * arrival: the person just sees the ordinary welcome. A valid invite code is
 * saved so it can still be claimed after sign-in.
 */
export function useArrival(inviteCode: string | null, redirectTo: string): Arrival | null {
  const joinToken = joinTokenFrom(redirectTo);
  const [arrival, setArrival] = useState<Arrival | null>(null);

  useEffect(() => {
    let live = true;
    setArrival(null);
    if (inviteCode) {
      void fetchInvitePreview(inviteCode).then((p) => {
        if (!live || !p.isValid || !p.inviterName) return;
        saveInviteCode(inviteCode);
        setArrival({ name: p.inviterName.slice(0, 60), avatar: p.inviterAvatar, note: p.note });
      });
    } else if (joinToken) {
      void fetchPursuitInvite(joinToken).then(async (p) => {
        if (!live || !p) return;
        const cornerKey = (await fetchInviteCorner(joinToken)) ?? undefined;
        if (!live) return;
        setArrival({ name: p.ownerName.slice(0, 60), avatar: p.ownerAvatar ?? null, note: null, cornerKey });
      });
    }
    return () => {
      live = false;
    };
  }, [inviteCode, joinToken]);

  return arrival;
}
