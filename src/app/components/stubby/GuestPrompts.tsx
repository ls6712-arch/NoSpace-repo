import { X } from "lucide-react";
import { Button } from "../ui/button";
import { useStubbyAccess } from "../../context/StubbyAccess";
import { formatTime } from "../../lib/dates";
import { GUEST_COPY } from "../../lib/guestCopy";

/** The small Sign up button in Stubby's header, for guests only. Not a prompt: it never covers anything. */
export function GuestSignUpButton() {
  const access = useStubbyAccess();
  if (!access.guest) return null;
  return (
    <Button size="sm" variant="outline" data-guest-signup="" onClick={() => access.openSignUp("header")}>
      {GUEST_COPY.signUp}
    </Button>
  );
}

/**
 * After the guest's 3rd ask, under Stubby's reply: a small card with what they gain. Once a
 * session at most; dismissed, not again for 7 days (StubbyAccess). Never covers anything.
 */
export function InlineSignUpCard({ perDay }: { perDay: number }) {
  const access = useStubbyAccess();
  if (access.prompt?.kind !== "inline_card") return null;
  return (
    <div role="region" aria-label={GUEST_COPY.signUp} data-inline-signup="" className="mt-4 flex items-start gap-3 rounded-card border border-border bg-card p-4">
      <p className="min-w-0 flex-1 text-small">{GUEST_COPY.inlineCard(perDay)}</p>
      <Button size="sm" onClick={() => access.openSignUp("inline_card")}>
        {GUEST_COPY.signUp}
      </Button>
      <button type="button" aria-label={GUEST_COPY.notNow} onClick={access.dismiss} className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground">
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * In place of the field when the guest's day is used up, or guests are paused: what they gain by
 * signing up, and when they can ask again. Everything already found stays readable above it.
 */
export function LimitPanel({ perDay, accountPerDay, onSignUp }: { perDay: number; accountPerDay: number; onSignUp?: () => void }) {
  const access = useStubbyAccess();
  if (access.prompt?.kind !== "limit") return null;
  const { limit } = access.prompt;
  const busy = limit.code === "GUEST_GLOBAL_CAP" || limit.code === "GLOBAL_CAP";
  const line = busy
    ? GUEST_COPY.busy
    : GUEST_COPY.limit(Math.max(1, accountPerDay - perDay), formatTime(limit.resetsAt ?? Date.now() + 24 * 3_600_000));
  return (
    <div data-limit-panel="" className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
      <p className="text-small" aria-live="polite">
        {line}
      </p>
      <Button
        size="lg"
        className="w-full tab:w-auto"
        onClick={() => {
          onSignUp?.();
          access.openSignUp("limit");
        }}
      >
        {GUEST_COPY.signUp}
      </Button>
    </div>
  );
}
