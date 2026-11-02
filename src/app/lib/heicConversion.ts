import { heicToJpegOnServer } from "./heicServer";
import { UPLOAD_COPY } from "./stateCopy";

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
 * The conversion runs on the server (heicServer.ts, api/heic.ts) since Nov 2, 2026. The
 * browser converter it replaced (heic2any) evaluated strings, which the Content Security
 * Policy in vercel.json refuses; it was also ~340KB gzipped on every visitor's load.
 */
export async function convertHeicIfNeeded(file: File): Promise<File> {
  if (!isHeicFile(file)) return file;

  try {
    // On the server (api/heic.ts): the browser converter needed 'unsafe-eval', which the Content
    // Security Policy refuses. A multi-image HEIC (a burst) comes back as its first frame.
    const blob = await heicToJpegOnServer(file);
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

/**
 * One picked photo, ready to attach: converted if it was HEIC, or an
 * explanation of what to do if conversion failed. Never throws.
 */
export async function preparePickedPhoto(file: File): Promise<{ file: File; error: null } | { file: null; error: string }> {
  const converted = await convertHeicIfNeeded(file).catch(() => file);
  if (isHeicFile(converted)) return { file: null, error: UPLOAD_COPY.heic };
  return { file: converted, error: null };
}
