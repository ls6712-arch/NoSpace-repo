import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../../../lib/supabase";
import { forgetGuest, guestSession, revokeSession } from "../../../lib/guestSupabase";
import { useAuth } from "../../context/AuthContext";
import { track } from "../../lib/analytics";
import { GUEST_COPY } from "../../lib/guestCopy";
import { linkErrorInUrl, peekReturn, saveResume, takeReturn } from "../../lib/signUpReturn";
import { notify } from "../ui/toaster";

/**
 * After a guest signs up from Stubby (any trigger, any method), on whichever page the browser lands:
 * back to Stubby, the same picks (same user id), the ask they had typed back in the field and sent
 * if the limit had stopped it, and a short "You're in." The guest's old session is ended and
 * forgotten on this device.
 *
 * If the Google or Apple account already had its own Soosh account, linking fails; they are logged
 * in to that account instead, and the guest's picks are not merged into it (founder, Nov 2, 2026).
 */
export function SignUpReturnEffect() {
  const { user, isConfigured } = useAuth();
  const navigate = useNavigate();
  const done = useRef(false);
  const fellBack = useRef(false);

  // Linking failed because the login already has an account: log in to that one instead.
  useEffect(() => {
    if (!isConfigured || user || fellBack.current || !supabase) return;
    const r = peekReturn();
    if (!r || r.method === "email" || linkErrorInUrl() !== "identity_already_exists") return;
    fellBack.current = true;
    void supabase.auth.signInWithOAuth({ provider: r.method, options: { redirectTo: `${window.location.origin}${window.location.pathname}` } });
  }, [isConfigured, user]);

  useEffect(() => {
    if (!user || done.current) return;
    const r = takeReturn();
    if (!r) return;
    done.current = true;
    void (async () => {
      // Google or Apple: the guest's own session ends now; the account has a new one from the
      // redirect (no session fixation). Email moved the new session over already and ended the
      // old one in the sheet, so the guest client's session here is the account's: left alone.
      if (r.method !== "email") {
        const old = await guestSession();
        if (old) await revokeSession(old.access_token);
      }
      forgetGuest();
    })();
    saveResume(r.draft, r.blocked);
    track({ name: "signup_completed", trigger: r.trigger, method: r.method, guestMessages: r.guestMessages });
    navigate(r.path, { replace: true });
    notify(GUEST_COPY.signedUp);
  }, [user, navigate]);

  return null;
}
