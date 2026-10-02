import { useState } from "react";
import { ImageOff } from "lucide-react";
import { Project, setProjectCoverImage } from "../lib/journal";
import { mirrorPursuitCoverImage } from "../lib/pursuitsRemote";
import { uploadMomentFile } from "../lib/momentMedia";
import { useAuth } from "../context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { MediaAttachPicker } from "./MediaAttachPicker";
import { Button } from "./ui/button";
import { UPLOAD_COPY } from "../lib/stateCopy";

const MAX_COVER_BYTES = 8 * 1024 * 1024;

/**
 * A Pursuit's cover: a custom upload, or — left unset — a real photo from
 * the Pursuit's own Moments (the first ever logged, or the latest; see
 * PursuitItem.tsx's own resolution order). Client-side checks only: a real
 * image type and a size cap. Nothing here resizes, crops, or moderates the
 * file — it's uploaded as picked, same as every other photo in this app
 * (MediaAttachPicker's own HEIC conversion aside).
 */
export function CoverImageDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
}) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preference, setPreference] = useState<"first" | "last">(project?.coverImagePreference ?? "last");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!project) return null;

  const pick = (picked: File | null) => {
    setError(null);
    if (picked && !picked.type.startsWith("image/")) {
      setError("That file isn’t a photo — pick an image instead.");
      return;
    }
    if (picked && picked.size > MAX_COVER_BYTES) {
      setError(UPLOAD_COPY.tooBig(8));
      return;
    }
    setFile(picked);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    let path: string | null | undefined = undefined; // undefined = leave the existing custom cover untouched
    if (file) {
      if (!user) {
        setError("Sign in to upload a cover photo.");
        setSaving(false);
        return;
      }
      const { path: uploaded, error: uploadError } = await uploadMomentFile(user.id, file);
      if (uploadError || !uploaded) {
        setError(uploadError || "That upload didn’t go through — try again.");
        setSaving(false);
        return;
      }
      path = uploaded;
    }
    setProjectCoverImage(project.id, {
      ...(path !== undefined ? { coverImagePath: path } : {}),
      coverImagePreference: preference,
    });
    void mirrorPursuitCoverImage(
      project.id,
      path !== undefined ? path : (project.coverImagePath ?? null),
      preference,
    );
    setSaving(false);
    setFile(null);
    onOpenChange(false);
  };

  const removeCustom = () => {
    setProjectCoverImage(project.id, { coverImagePath: null, coverImagePreference: preference });
    void mirrorPursuitCoverImage(project.id, null, preference);
    setFile(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>Cover photo</DialogTitle>
          <DialogDescription>For “{project.title}”. Optional — skip anytime.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs">Custom photo</p>
            <MediaAttachPicker file={file} onChange={pick} label="Upload a photo" />
            {error && <p className="mt-1.5 text-[11px] text-destructive">{error}</p>}
          </div>

          <div>
            <p className="mb-1.5 text-xs">Without a custom photo, use</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPreference("first")}
                className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                  preference === "first"
                    ? "border-[var(--coral-deep)] bg-surface-muted"
                    : "border-border hover:border-foreground/30"
                }`}
              >
                <span className="block font-medium">First Moment</span>
                <span className="block text-muted-foreground">Where it started</span>
              </button>
              <button
                type="button"
                onClick={() => setPreference("last")}
                className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                  preference === "last"
                    ? "border-[var(--coral-deep)] bg-surface-muted"
                    : "border-border hover:border-foreground/30"
                }`}
              >
                <span className="block font-medium">Latest Moment</span>
                <span className="block text-muted-foreground">Where it’s at now</span>
              </button>
            </div>
          </div>

          <Button busy={saving} variant="coral" className="w-full" disabled={saving} onClick={save}>
            Save
          </Button>

          {project.coverImagePath && (
            <button
              type="button"
              onClick={removeCustom}
              disabled={saving}
              className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ImageOff className="size-3.5" />
              Remove custom photo
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
