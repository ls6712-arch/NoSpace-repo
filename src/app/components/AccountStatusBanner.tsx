import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  cancelAccountDeletion,
  deletionDate,
  unpauseAccount,
} from "../lib/accountStatus";
import { formatDate } from "../lib/dates";
import { notify, notifyError } from "./ui/toaster";

/**
 * Shown to the owner of a paused account, or one set to be deleted, after
 * they log back in. While either is set the database blocks new Moments and
 * edits, so this says why and gives the one-tap way back.
 */
export function AccountStatusBanner() {
  const { user, profile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!user || !profile) return null;

  const leavingAt = profile.deletion_requested_at;
  const pausedAt = profile.paused_at;
  if (!leavingAt && !pausedAt) return null;

  const undo = async () => {
    setBusy(true);
    const { error } = leavingAt
      ? await cancelAccountDeletion(user.id)
      : await unpauseAccount(user.id);
    setBusy(false);
    if (error) return notifyError(error, undo);
    await refreshProfile();
    notify(
      leavingAt
        ? "Your account is staying. Nothing was deleted."
        : "Welcome back. Your account is visible again.",
    );
  };

  const line = leavingAt
    ? `Your account will be deleted on ${formatDate(deletionDate(leavingAt), { year: true })}.`
    : "Your account is paused. No one else can see it.";

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-border bg-surface-muted px-4 py-2 text-center text-caption text-foreground"
    >
      <span>{line}</span>
      <button
        type="button"
        onClick={() => void undo()}
        disabled={busy}
        className="font-medium underline underline-offset-2 disabled:opacity-60"
      >
        {leavingAt ? "Keep my account" : "Resume"}
      </button>
    </div>
  );
}
