import { useState } from "react";
import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useCategories } from "../../context/CategoriesContext";
import { supabase } from "../../../lib/supabase";
import { SectionHeader } from "../ui/section-header";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ConfirmDialog } from "../ConfirmDialog";
import { SettingsPanel, SettingsRow, SavedFlash, useSavedFlash } from "./SettingsRow";

function PasswordChangeRow() {
  const { updatePassword, user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { saved, flash } = useSavedFlash();

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
    setEditing(false);
  };

  const save = async () => {
    if (saving) return;
    if (!current) {
      setError("Enter your current password.");
      return;
    }
    if (next.length < 10) {
      setError("Your new password needs at least 10 characters.");
      return;
    }
    if (next !== confirm) {
      setError("Those two don't match.");
      return;
    }
    setSaving(true);
    setError(null);
    // updateUser() doesn't check the current password on its own — it just
    // sets a new one for whoever already holds a valid session — so the
    // "current password" field is verified here first, by re-authenticating
    // with it, before actually changing anything.
    const { error: verifyError } = await supabase!.auth.signInWithPassword({
      email: user!.email!,
      password: current,
    });
    if (verifyError) {
      setSaving(false);
      setError("That current password isn't right.");
      return;
    }
    const result = await updatePassword(next);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    reset();
    flash();
  };

  if (!editing) {
    return (
      <SettingsRow label="Password" description="Change your password.">
        <div className="flex items-center justify-end gap-3">
          {saved && <SavedFlash show />}
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Change password
          </Button>
        </div>
      </SettingsRow>
    );
  }

  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="mb-3 text-sm">Password</div>
      <div className="grid gap-3 sm:max-w-sm">
        <div>
          <Label htmlFor="pw-current" className="mb-1.5 block text-xs">
            Current password
          </Label>
          <Input
            id="pw-current"
            type="password"
            autoComplete="current-password"
            className="border-input"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="pw-next" className="mb-1.5 block text-xs">
            New password
          </Label>
          <Input
            id="pw-next"
            type="password"
            autoComplete="new-password"
            className="border-input"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="At least 10 characters"
          />
        </div>
        <div>
          <Label htmlFor="pw-confirm" className="mb-1.5 block text-xs">
            Confirm new password
          </Label>
          <Input
            id="pw-confirm"
            type="password"
            autoComplete="new-password"
            className="border-input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button variant="outline" size="sm" onClick={reset} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Change password"}
        </Button>
      </div>
    </div>
  );
}

function AdminLinkRow({ to, label, badge }: { to: string; label: string; badge?: number }) {
  return (
    <Link
      to={to}
      className="flex min-h-11 items-center justify-between gap-3 px-4 py-4 text-sm transition-colors hover:bg-surface-muted sm:px-5"
    >
      <span>
        {label}
        {!!badge && <span className="ml-2 text-xs text-destructive">{badge} waiting</span>}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

export function AccountSection() {
  const { user, signOutEverywhere } = useAuth();
  const { isAdmin, pendingCount } = useCategories();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!user) return null;

  // app_metadata.provider is "email" for a password account, or the OAuth
  // provider name ("google") for a social-login one — social accounts have
  // no password to change here at all.
  const isEmailAccount = user.app_metadata?.provider === "email";

  return (
    <section>
      <SectionHeader n={3} eyebrow="ACCOUNT" title="Account" />
      <p className="mb-4 text-sm text-muted-foreground">
        Your sign-in details, and every device you're signed into.
      </p>
      <SettingsPanel>
        <SettingsRow label="Email" description="Signing in and account notices go here.">
          <span className="text-sm text-muted-foreground">{user.email}</span>
        </SettingsRow>
        {isEmailAccount && <PasswordChangeRow />}
        <SettingsRow
          label="Sign out everywhere"
          description="Ends every session on every device, including this one."
        >
          <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
            Sign out everywhere
          </Button>
        </SettingsRow>
      </SettingsPanel>

      {isAdmin && (
        <>
          <p className="mb-2 mt-6 text-xs uppercase tracking-[0.08em] text-muted-foreground">Site admin</p>
          <SettingsPanel>
            <AdminLinkRow to="/admin/spaces" label="Manage Spaces" />
            <AdminLinkRow to="/admin/circles" label="Manage Circles" />
            <AdminLinkRow to="/admin/categories" label="Review category suggestions" badge={pendingCount} />
          </SettingsPanel>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Sign out everywhere?"
        description="This ends every signed-in session for your account, including the one you're using right now."
        confirmLabel="Sign out everywhere"
        onConfirm={async () => {
          await signOutEverywhere();
          setConfirmOpen(false);
        }}
      />
    </section>
  );
}
