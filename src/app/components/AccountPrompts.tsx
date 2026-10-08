import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { NamePromptDialog } from "./NamePromptDialog";
import { TermsGateDialog } from "./TermsGateDialog";
import { needsTermsAcceptance } from "../lib/termsAcceptance";

/** The one-time prompts an existing, onboarded account can meet, in order:
 * the Terms checkbox first (it blocks), then the name prompt. They never
 * stack. Accounts still in onboarding get the same Terms checkbox there
 * instead (see Onboarding.tsx). */
export function AccountPrompts() {
  const { user, profile } = useAuth();
  const [status, setStatus] = useState<"checking" | "needed" | "clear">("checking");

  const userId = user?.id;
  const eligible = !!userId && !!profile?.onboarding_completed && profile.access !== "pending";

  useEffect(() => {
    if (!eligible || !userId) return;
    let live = true;
    setStatus("checking");
    void needsTermsAcceptance(userId).then((needed) => live && setStatus(needed ? "needed" : "clear"));
    return () => {
      live = false;
    };
  }, [eligible, userId]);

  if (!eligible) return null;
  return (
    <>
      <TermsGateDialog open={status === "needed"} onAccepted={() => setStatus("clear")} />
      <NamePromptDialog enabled={status === "clear"} />
    </>
  );
}
