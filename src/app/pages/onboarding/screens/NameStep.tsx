import { useState } from "react";
import { clearPasswordOffer, readPasswordOffer } from "../../../lib/onboardingProgress";
import { NameScreen } from "./NameScreen";
import { PasswordOfferScreen } from "./PasswordOfferScreen";

/**
 * Screen 4. Someone who just came in with an email code is offered a password
 * first (once; this tab only). It lives here, not as a step of its own, so it
 * is never numbered, never saved as progress and never reached by Back.
 */
export function NameStep() {
  const [offering, setOffering] = useState(readPasswordOffer);
  if (offering) {
    return (
      <PasswordOfferScreen
        onDone={() => {
          clearPasswordOffer();
          setOffering(false);
        }}
      />
    );
  }
  return <NameScreen />;
}
