import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "./ui/button";
import { convertHeicIfNeeded, isHeicFile } from "../lib/heicConversion";
import { UPLOAD_COPY } from "../lib/stateCopy";
import { ImageWithFallback } from "./ImageWithFallback";

/**
 * A small, reusable "attach a photo or video" control — the same picked
 * file can be a photo riding along with a reply (Thoughts, when allowMedia
 * is on), or Onboarding's own first-Moment prompt. Owns nothing beyond the
 * local preview; the caller decides what happens to the file.
 *
 * Runs convertHeicIfNeeded() before handing the file back — this was the
 * gap that let HEIC uploads look "still broken" after
 * heicConversion.ts shipped: that fix was wired into CameraCapture.tsx,
 * Log.tsx's "add more" tile, and the Pursuit detail form, but this
 * component is a separate file-input path all three of its callers share,
 * and none of them called convertHeicIfNeeded themselves. Fixed once here
 * so every caller gets it, rather than three times at each call site.
 *
 * A real HEIC file that heic2any's WASM decoder can't handle (a known
 * limitation of that library, not the same thing as this sandbox's own
 * synthetic-bytes test file) comes back from convertHeicIfNeeded() still
 * HEIC-shaped — isHeicFile() catches that and rejects the pick with a
 * message, rather than silently handing the caller a file that will never
 * render for anyone but a Safari user.
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
  const [heicWarning, setHeicWarning] = useState<string | null>(null);

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
      <div className="relative inline-block overflow-hidden rounded-card border border-border">
        {isVideo ? (
          <video src={previewUrl} className="h-24 w-24 object-cover" muted />
        ) : (
          <ImageWithFallback src={previewUrl} alt="" className="h-24 w-24" />
        )}
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Remove attachment"
          className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-control bg-scrim-solid/70 text-on-media"
        >
          <X className="size-3" />
        </button>
      </div>
    );
  }

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    e.target.value = "";
    setHeicWarning(null);
    if (!picked) {
      onChange(null);
      return;
    }
    setConverting(true);
    const converted = await convertHeicIfNeeded(picked);
    setConverting(false);
    // Still HEIC-shaped means conversion failed — don't hand back a file
    // nothing but Safari can ever render; say so instead.
    if (isHeicFile(converted)) {
      setHeicWarning(UPLOAD_COPY.heic);
      return;
    }
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
      {heicWarning && (
        <p className="mt-1.5 max-w-[16rem] text-caption leading-relaxed text-[var(--coral-text)]">
          {heicWarning}
        </p>
      )}
    </>
  );
}
