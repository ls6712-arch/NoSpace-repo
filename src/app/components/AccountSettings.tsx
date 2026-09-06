import { useEffect, useState } from "react";
import { Check, Settings } from "lucide-react";
import { Link } from "react-router";
import { useAuth } from "../context/AuthContext";
import { useCategories } from "../context/CategoriesContext";
import { supabase } from "../../lib/supabase";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

/**
 * The parts of an account a person can actually change.
 *
 * There was previously no way to fix a display name, and no way to change a
 * password once you had one — which combined badly with a signup that could
 * derive your name from your email address. Email itself is left alone on
 * purpose: changing it needs a confirmation round-trip to both addresses, and
 * a half-built version of that is worse than none.
 */
export function AccountSettings() {
  const { user, profile, updatePassword, refreshProfile } = useAuth();
  const { isAdmin, pendingCount } = useCategories();

  const [name, setName] = useState(profile?.display_name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameDone, setNameDone] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwDone, setPwDone] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Keep the field in step with the profile until the person starts typing.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched && profile?.display_name) setName(profile.display_name);
  }, [profile?.display_name, touched]);

  if (!user) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-1 flex items-center gap-2 text-sm">
          <Settings className="size-4 text-muted-foreground" />
          Account
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          You're browsing without an account. Nothing here is saved beyond this
          browser.
        </p>
      </div>
    );
  }

  const saveName = async () => {
    const next = name.trim();
    if (!next || savingName) return;
    setSavingName(true);
    setNameError(null);
    setNameDone(false);
    try {
      const { error } = await supabase!
        .from("profiles")
        .update({ display_name: next })
        .eq("id", user.id);
      if (error) setNameError(error.message);
      else {
        await refreshProfile();
        setNameDone(true);
        setTouched(false);
      }
    } catch {
      setNameError("Couldn't reach the server. Try again in a moment.");
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async () => {
    if (!password || savingPw) return;
    setSavingPw(true);
    setPwError(null);
    setPwDone(false);
    const res = await updatePassword(password);
    setSavingPw(false);
    if (res.error) setPwError(res.error);
    else {
      setPwDone(true);
      setPassword("");
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm">
          <Settings className="size-4 text-muted-foreground" />
          Account
        </div>

        <Label htmlFor="acct-name" className="mb-1.5 block text-xs">
          Your name
        </Label>
        <div className="flex gap-2">
          <Input
            id="acct-name"
            value={name}
            maxLength={60}
            onChange={(e) => {
              setTouched(true);
              setName(e.target.value);
              setNameDone(false);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={savingName || !name.trim() || name.trim() === profile?.display_name}
            onClick={saveName}
          >
            {savingName ? "Saving…" : nameDone ? <Check className="size-4" /> : "Save"}
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          This is what people see on your work. {user.email}
        </p>
        {nameError && <p className="mt-1.5 text-[11px] text-[var(--coral-text)]">{nameError}</p>}
        {nameDone && <p className="mt-1.5 text-[11px] text-muted-foreground">Name updated.</p>}
      </div>

      {/* Only visible to whoever reviews suggestions — nobody, until the
          is_admin flag is granted by hand in SQL. */}
      {isAdmin && (
        <Link
          to="/admin/categories"
          className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-sm transition-colors hover:border-[var(--coral-deep)]"
        >
          <span>
            Review category suggestions
            {pendingCount > 0 && (
              <span className="ml-2 text-xs text-[var(--coral-text)]">
                {pendingCount} waiting
              </span>
            )}
          </span>
          <span className="text-muted-foreground">→</span>
        </Link>
      )}

      <div className="rounded-2xl border border-border bg-card p-4">
        <Label htmlFor="acct-pw" className="mb-1.5 block text-xs">
          New password
        </Label>
        <div className="flex gap-2">
          <Input
            id="acct-pw"
            type="password"
            value={password}
            autoComplete="new-password"
            onChange={(e) => {
              setPassword(e.target.value);
              setPwDone(false);
            }}
            placeholder="At least 8 characters"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={savingPw || password.length < 8}
            onClick={savePassword}
          >
            {savingPw ? "Saving…" : "Change"}
          </Button>
        </div>
        {pwError && <p className="mt-1.5 text-[11px] text-[var(--coral-text)]">{pwError}</p>}
        {pwDone && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Password changed. You'll stay signed in here.
          </p>
        )}
      </div>
    </div>
  );
}
