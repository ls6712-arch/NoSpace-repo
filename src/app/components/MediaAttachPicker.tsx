import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "./ui/button";

/**
 * A small, reusable "attach a photo or video" control — the same picked
 * file can be a Circle thread's own attachment (CircleComposer) or a photo
 * riding along with a reply (Thoughts, when allowMedia is on). Owns nothing
 * beyond the local preview; the caller decides what happens to the file.
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

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        <ImagePlus className="size-3.5" />
        {label}
      </Button>
    </>
  );
}
