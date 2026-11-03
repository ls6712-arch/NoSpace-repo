import { Link } from "react-router";
import { BottomSheet } from "../ui/BottomSheet";
import { Button } from "../ui/button";
import { GUEST_COPY } from "../../lib/guestCopy";

/** Where "Finish setting up" goes: onboarding, then back to Stubby. */
export const FINISH_SETUP_PATH = `/onboarding?redirect=${encodeURIComponent("/calendar")}`;

/**
 * A Stubby account (signed up from Stubby, onboarding not finished) on anything other than Stubby:
 * what finishing gets them, and the way there. Never an invite prompt. The database refuses these
 * features to them anyway (20261111000050_member_gate.sql); this only says why.
 */
export function FinishSettingUp() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4" data-finish-setting-up="">
      <div className="glass-panel shadow-card w-full max-w-md rounded-card p-8 text-center tab:p-10">
        <h2 className="mb-3 text-title" style={{ fontFamily: "var(--font-serif)" }}>
          {GUEST_COPY.finishTitle}
        </h2>
        <p className="mb-7 text-small leading-relaxed text-muted-foreground">{GUEST_COPY.finishBody}</p>
        <div className="flex flex-col gap-2.5">
          <Link to={FINISH_SETUP_PATH}>
            <Button className="w-full" size="lg">
              {GUEST_COPY.finishButton}
            </Button>
          </Link>
          <Link to="/calendar">
            <Button variant="outline" className="w-full">
              {GUEST_COPY.notNow}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

/** The paths a Stubby account may open: Stubby, onboarding, the account basics and the legal pages. */
export function stubbyAccountMayOpen(pathname: string): boolean {
  return (
    pathname === "/calendar" ||
    pathname === "/onboarding" ||
    pathname === "/login" ||
    pathname === "/reset-password" ||
    pathname === "/terms" ||
    pathname === "/privacy-policy" ||
    pathname === "/settings" ||
    pathname === "/account" ||
    pathname === "/settings/account"
  );
}

/** The same, as a sheet over Stubby: a Stubby account tried Bring someone (an invite is a member feature). */
export function FinishSettingUpSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={GUEST_COPY.finishTitle} description={GUEST_COPY.finishBody}>
      <div className="flex flex-col gap-2.5 pb-2">
        <Link to={FINISH_SETUP_PATH} onClick={() => onOpenChange(false)}>
          <Button className="w-full" size="lg">
            {GUEST_COPY.finishButton}
          </Button>
        </Link>
        <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
          {GUEST_COPY.notNow}
        </Button>
      </div>
    </BottomSheet>
  );
}
