import heic2any from "heic2any";

function isHeicFile(file: File): boolean {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    file.name.toLowerCase().endsWith(".heic") ||
    file.name.toLowerCase().endsWith(".heif")
  );
}

/**
 * An iPhone set to its default camera format hands the file picker a .heic
 * (or .heif) file — which no browser except Safari can decode into an
 * `<img>`/`<video>` preview or a real upload thumbnail. Every place Log.tsx
 * accepts a picked file (the camera screen's library picker, the caption
 * screen's "add more" tile, the Pursuit detail form's single-file input)
 * runs it through this first, so a HEIC pick behaves exactly like any other
 * photo from here on rather than silently failing to preview.
 *
 * Not HEIC: returned as-is, untouched, no conversion work done. HEIC:
 * converted client-side to a real JPEG File with the same base name. A
 * conversion failure (a corrupt file, a HEIC variant the decoder doesn't
 * support) falls back to the original file rather than blocking the pick —
 * it'll very likely fail to preview or upload too, but that's the existing
 * failure mode for any unrenderable file, not a new one this introduces.
 *
 * heic2any is a static import, not a dynamic one: this build sets
 * rollupOptions.output.inlineDynamicImports (vite.config.ts) so the app
 * stays a single IIFE that works opened straight from file://, which means
 * a dynamic import() here would just get inlined right back into that same
 * bundle anyway — no actual deferral, just misdirection about where the
 * weight comes from. heic2any's WASM HEIC/HEIF decoder (~340KB gzipped) is
 * therefore part of every visitor's load from here on, confirmed and
 * accepted rather than worked around.
 */
export async function convertHeicIfNeeded(file: File): Promise<File> {
  if (!isHeicFile(file)) return file;

  try {
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    // heic2any returns an array only for a multi-image HEIC container
    // (a burst or a Live Photo saved as HEIC); a Moment's own picker keeps
    // one file per pick either way, so only the first frame is kept — the
    // same "whichever one was actually picked" rule pickFiles() already
    // applies in Log.tsx.
    const blob = Array.isArray(converted) ? converted[0] : converted;
    const newName = file.name.replace(/\.(heic|heif)$/i, ".jpg");
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** convertHeicIfNeeded over a whole picked batch — the shape the caption
 * screen's multi-photo picker and "add more" tile actually work with. */
export async function convertHeicFiles(files: File[]): Promise<File[]> {
  return Promise.all(files.map(convertHeicIfNeeded));
}
