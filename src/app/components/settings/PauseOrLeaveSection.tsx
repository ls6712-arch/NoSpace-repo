import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { SectionHeader } from "../ui/section-header";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { notify, notifyError } from "../ui/toaster";
import { SettingsPanel, SettingsRow } from "./SettingsRow";
import {
  DELETION_GRACE_DAYS,
  cancelAccountDeletion,
  deletionDate,
  pauseAccount,
  requestAccountDeletion,
  unpauseAccount,
} from "../../lib/accountStatus";
import { formatDate } from "../../lib/dates";

export function PauseOrLeaveSection() {
  const { user, profile, signOut, signOutEverywhere, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [pauseOpen, setPauseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paused = !!profile?.paused_at;
  const leaving = !!profile?.deletion_requested_at;
  // Typing the username is the confirmation; fall back to the word "delete"
  // for an account that somehow has no username yet.
  const confirmWord = profile?.username || "delete";
  const canDelete = confirmText.trim().toLowerCase() === confirmWord.toLowerCase();

  const leaveApp = async (message: string) => {
    // Every device, not just this one: a paused or leaving account
    // shouldn't stay signed in anywhere.
    const { error: outError } = await signOutEverywhere();
    if (outError) await signOut();
    notify(message);
    navigate("/", { replace: true });
  };

  const onPause = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    const { error: e } = await pauseAccount(user.id);
    if (e) {
      setError(e);
      setBusy(false);
      return;
    }
    setPauseOpen(false);
    setBusy(false);
    await leaveApp("Your account is paused. Log back in any time to come back.");
  };

  const onDelete = async () => {
    if (!user || !canDelete) return;
    setBusy(true);
    setError(null);
    const { error: e } = await requestAccountDeletion(user.id);
    if (e) {
      setError(e);
      setBusy(false);
      return;
    }
    setDeleteOpen(false);
    setBusy(false);
    await leaveApp(
      `Your account will be deleted in ${DELETION_GRACE_DAYS} days. Log back in before then to keep it.`,
    );
  };

  const onUnpause = async () => {
    if (!user) return;
    setBusy(true);
    const { error: e } = await unpauseAccount(user.id);
    setBusy(false);
    if (e) return notifyError(e, onUnpause);
    await refreshProfile();
    notify("Welcome back. Your account is visible again.");
  };

  const onKeep = async () => {
    if (!user) return;
    setBusy(true);
    const { error: e } = await cancelAccountDeletion(user.id);
    setBusy(false);
    if (e) return notifyError(e, onKeep);
    await refreshProfile();
    notify("Your account is staying. Nothing was deleted.");
  };

  const openDelete = () => {
    setConfirmText("");
    setError(null);
    setDeleteOpen(true);
  };

  return (
    <section>
      <SectionHeader n={7} eyebrow="Pause or leave" title="Pause or leave" />
      <p className="mb-4 text-small text-muted-foreground">
        Step back for a while, or leave for good.
      </p>
      <SettingsPanel>
        {user && (
          <SettingsRow
            label={paused ? "Your account is paused" : "Pause your account"}
            description={
              paused
                ? "No one else can see your profile or Moments. Resume to post and be seen again."
                : "Hide your profile and Moments from everyone until you come back."
            }
          >
            {paused ? (
              <Button size="sm" onClick={() => void onUnpause()} disabled={busy}>
                Resume
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null);
                  setPauseOpen(true);
                }}
                disabled={leaving}
              >
                Pause
              </Button>
            )}
          </SettingsRow>
        )}
        {user && (
          <SettingsRow
            label={leaving ? "Your account is set to be deleted" : "Delete your account"}
            description={
              leaving && profile?.deletion_requested_at
                ? `It will be removed for good on ${formatDate(deletionDate(profile.deletion_requested_at), { year: true })}.`
                : "Permanently remove your account and your Moments."
            }
          >
            {leaving ? (
              <Button size="sm" onClick={() => void onKeep()} disabled={busy}>
                Keep my account
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={openDelete}>
                Delete
              </Button>
            )}
          </SettingsRow>
        )}
        {user && (
          <SettingsRow label="Log out" description="Ends your session on this device.">
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              Log out
            </Button>
          </SettingsRow>
        )}
      </SettingsPanel>

      <Dialog open={pauseOpen} onOpenChange={(o) => !busy && setPauseOpen(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>Pause your account?</DialogTitle>
            <DialogDescription>
              Your profile, Moments and Pursuits are hidden from everyone, and you're logged out on
              every device. Nothing is deleted. Log back in any time and choose Resume to come back.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-small text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPauseOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void onPause()} disabled={busy}>
              {busy ? "Pausing…" : "Pause my account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={(o) => !busy && setDeleteOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>Delete your account?</DialogTitle>
            <DialogDescription>
              Your profile, Moments, Pursuits, reactions and Space memberships will be
              removed. You're hidden from everyone right away and logged out on every device.
            </DialogDescription>
          </DialogHeader>
          <p className="text-small text-muted-foreground">
            You have {DELETION_GRACE_DAYS} days to change your mind: log back in and choose Keep
            my account. After that it can't be undone.
          </p>
          <label className="block text-small">
            Type <span className="font-medium">{confirmWord}</span> to confirm
            <Input
              className="mt-2"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-describedby={error ? "delete-account-error" : undefined}
            />
          </label>
          {error && (
            <p id="delete-account-error" role="alert" className="text-small text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void onDelete()} disabled={!canDelete || busy}>
              {busy ? "Deleting…" : "Delete my account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
