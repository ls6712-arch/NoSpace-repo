import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { SettingsRow, SavedFlash, useSavedFlash } from "./SettingsRow";

/**
 * A text value shown with an Edit button that expands into an
 * input/textarea with Save/Cancel. Save only enables once the draft
 * actually differs from the saved value; an error stays under the field
 * and the typed draft is kept (never reset) so a failed save doesn't throw
 * away what was typed.
 */
export function EditableTextRow({
  label,
  description,
  value,
  placeholder,
  multiline = false,
  maxLength,
  required = false,
  emptyLabel = "Not set",
  onSave,
}: {
  label: string;
  description?: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  /** Save disabled on an empty draft — used for display name, not bio. */
  required?: boolean;
  /** Shown in the collapsed row when value is empty. */
  emptyLabel?: string;
  onSave: (next: string) => Promise<{ error: string | null }>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { saved, flash } = useSavedFlash();

  // Only follow external updates while not mid-edit, so a save elsewhere
  // (or a refresh) doesn't clobber what's being typed here.
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const startEdit = () => {
    setDraft(value);
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setDraft(value);
    setError(null);
    setEditing(false);
  };

  const save = async () => {
    if (saving) return;
    const next = draft.trim();
    if (required && !next) {
      setError("This can't be empty.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await onSave(next);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    flash();
  };

  const trimmedDraft = draft.trim();
  const unchanged = trimmedDraft === value.trim();
  const canSave = !saving && (!required || !!trimmedDraft) && !unchanged;

  if (!editing) {
    return (
      <SettingsRow label={label} description={description}>
        <div className="flex items-center justify-end gap-3">
          {saved && <SavedFlash show />}
          <span className="max-w-[16rem] truncate text-sm text-muted-foreground sm:max-w-xs">
            {value.trim() || <span className="italic">{emptyLabel}</span>}
          </span>
          <Button variant="outline" size="sm" onClick={startEdit}>
            Edit
          </Button>
        </div>
      </SettingsRow>
    );
  }

  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="mb-2">
        <div className="text-sm">{label}</div>
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {multiline ? (
        <Textarea
          autoFocus
          value={draft}
          maxLength={maxLength}
          placeholder={placeholder}
          className="min-h-24 border-input"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
          }}
        />
      ) : (
        <Input
          autoFocus
          value={draft}
          maxLength={maxLength}
          placeholder={placeholder}
          className="border-input"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
            if (e.key === "Escape") cancel();
          }}
        />
      )}
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {maxLength && (
            <span className="text-[11px] text-muted-foreground">
              {draft.length}/{maxLength}
            </span>
          )}
          {error && <span className="text-[11px] text-destructive">{error}</span>}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={cancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={!canSave}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
