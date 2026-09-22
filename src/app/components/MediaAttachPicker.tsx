import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "./ui/button";
import { convertHeicIfNeeded } from "../lib/heicConversion";

/**
 * A small, reusable "attach a photo or video" control — the same picked
 * file can be a Circle thread's own attachment (CircleComposer), a photo
 * riding along with a reply (Thoughts, when allowMedia is on), or
 * Onboarding's own first-Moment prompt. Owns nothing beyond the local
 * preview; the caller decides what happens to the file.
 *
 * Runs convertHeicIfNeeded() before handing the file back — this was the
 * gap that let HEIC uploads look "still broken" after
 * heicConversion.ts shipped: that fix was wired into CameraCapture.tsx,
 * Log.tsx's "add more" tile, and the Pursuit detail form, but this
 * component is a separate file-input path all three of its callers share,
 * and none of them called convertHeicIfNeeded themselves. Fixed once here
 * so every caller gets it, rather than three times at each call site.
 */
export function MediaAttachPicker({
  file,
  onChange,
  label = "Add a photo",
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (file && previewUrl) {
    const isVideo = file.type.startsWith("video/");
    return (
      <div className="relative inline-block overflow-hidden rounded-xl border border-border">
        {isVideo ? (
          <video src={previewUrl} className="h-24 w-24 object-cover" muted />
        ) : (
          <img src={previewUrl} alt="" className="h-24 w-24 object-cover" />
        )}
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Remove attachment"
          className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-[var(--void)]/70 text-white"
        >
          <X className="size-3" />
        </button>
      </div>
    );
  }

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!picked) {
      onChange(null);
      return;
    }
    setConverting(true);
    const converted = await convertHeicIfNeeded(picked);
    setConverting(false);
    onChange(converted);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={pick}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={converting}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus className="size-3.5" />
        {converting ? "Preparing…" : label}
      </Button>
    </>
  );
}
