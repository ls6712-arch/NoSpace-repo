import heic2any from "heic2any";

/** Exported so a caller can re-check a post-conversion result: if it's
 * still HEIC-shaped, conversion silently failed (see convertHeicIfNeeded's
 * own comment on why that's worth telling the user about, not just
 * swallowing). */
export function isHeicFile(file: File): boolean {
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
 * `<img>`/`<video>` preview or a real upload thumbnail. Every place a fresh
 * file enters the composer runs it through this first, so a HEIC pick
 * behaves exactly like any other photo from here on rather than silently
 * failing to preview.
 *
 * Not HEIC: returned as-is, untouched, no conversion work done. HEIC:
 * converted client-side to a real JPEG File with the same base name.
 *
 * A conversion failure (a corrupt file, or — the one that actually matters
 * here — a real-world HEIC variant heic2any's bundled libheif-js WASM build
 * doesn't support; this library is old (0.0.4) and known to reject some
 * newer-iPhone HEIC encodings, not just deliberately-broken input) returns
 * the original file rather than throwing, so a pick never hard-crashes —
 * but that original file is still just as unrenderable as it was before
 * this function ran. Silently pretending that's a fine outcome was the bug
 * in this function's first version: the failure never surfaced anywhere,
 * so a photo could go all the way through to a saved Moment and just never
 * show up, with nothing in the UI or the console pointing at why. isHeicFile()
 * is exported so a caller can check whether what came back is still
 * HEIC-shaped and tell the person their photo didn't make it, instead of
 * quietly shipping a broken image.
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
  } catch (err) {
    // Logged, not swallowed silently — this is the one piece of evidence
    // that a real decode failure (vs. this sandbox's own fake-bytes test
    // fixture) leaves behind. A caller still gets the original file back
    // and decides what to do with it via isHeicFile().
    console.error("HEIC conversion failed, falling back to the original file:", err);
    return file;
  }
}

/** convertHeicIfNeeded over a whole picked batch — the shape the caption
 * screen's multi-photo picker and "add more" tile actually work with. */
export async function convertHeicFiles(files: File[]): Promise<File[]> {
  return Promise.all(files.map(convertHeicIfNeeded));
}
