import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { DISPLAY_NAME_MAX, isEmailPrefixName, nameDismissKey, validateDisplayName } from "../lib/displayName";
import { ERROR_LINE, OFFLINE_LINE } from "../lib/stateCopy";

/** One-time prompt for accounts whose display name is just their email
 * prefix. It never rewrites the stored name on its own: the name changes
 * only if the person edits it and saves. Saving as-is confirms it. Closing
 * the dialog any way also counts as seen, so it never comes back. */
export function NamePromptDialog() {
  const { user, profile, updateProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const userId = user?.id;
  const stored = profile?.display_name ?? "";
  const eligible =
    !!userId && !!profile?.onboarding_completed && isEmailPrefixName(stored, user?.email);

  useEffect(() => {
    if (!eligible || !userId) return;
    let seen = false;
    try {
      seen = localStorage.getItem(nameDismissKey(userId)) === "1";
    } catch {
      // Storage blocked: ask again next visit rather than never.
    }
    if (!seen) {
      setValue(stored);
      setOpen(true);
    }
  }, [eligible, userId]);

  const markSeen = () => {
    if (!userId) return;
    try {
      localStorage.setItem(nameDismissKey(userId), "1");
    } catch {
      // Fine: it just asks again next visit.
    }
  };

  const close = () => {
    markSeen();
    setOpen(false);
  };

  const save = async () => {
    if (saving) return;
    const checked = validateDisplayName(value);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setError(null);
    // Unchanged means the person confirmed it: nothing to write.
    if (checked.name === stored.trim()) {
      close();
      return;
    }
    setSaving(true);
    try {
      const { error: err } = await updateProfile({ display_name: checked.name });
      if (err) {
        setError(ERROR_LINE);
        return;
      }
      close();
    } catch {
      setError(OFFLINE_LINE);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="text-left">
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>
            Is this how you’d like to be known?
          </DialogTitle>
          <DialogDescription className="text-small text-muted-foreground">
            Your name is currently taken from your email. This is how it shows on your Shelf.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div>
            <Label htmlFor="name-prompt" className="mb-2 block">
              Name
            </Label>
            <Input
              id="name-prompt"
              value={value}
              maxLength={DISPLAY_NAME_MAX}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              autoComplete="name"
            />
            {error && <p className="mt-2 text-caption text-[var(--coral-text)]">{error}</p>}
          </div>
          <Button busy={saving} type="submit" variant="coral" className="w-full" disabled={saving}>
            Save name
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
