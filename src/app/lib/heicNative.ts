/** The longest side a natively decoded photo is drawn at. Keeps a 48 MP photo from exhausting canvas memory on a phone. */
const MAX_SIDE = 4096;

/**
 * HEIC to JPEG in the browser itself, for browsers that can decode HEIC (Safari on iPhone and Mac).
 * No upload, no size or megapixel limit, no server to be down. Throws when the browser can't decode
 * it (Chrome, Firefox) or the canvas gives nothing back; the caller then tries the server instead.
 */
export async function heicToJpegNative(file: File): Promise<Blob> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") throw new Error("no native decoder");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob || blob.type !== "image/jpeg" || blob.size === 0) throw new Error("canvas gave no JPEG");
    return blob;
  } finally {
    bitmap.close?.();
  }
}
