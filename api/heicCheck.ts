// The checks /api/heic makes before converting anything. Pure, so they are tested
// (src/app/lib/heicApi.test.ts) without Node, Vercel or Supabase.

export const HEIC_LIMIT = 4_400_000;

/** HEIF brands at bytes 8 to 11, after "ftyp" at bytes 4 to 7. */
const BRANDS = new Set(["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"]);

export function looksLikeHeif(b: Uint8Array): boolean {
  if (b.length < 12) return false;
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  return ascii(4, 8) === "ftyp" && BRANDS.has(ascii(8, 12));
}

/** A refusal before the body is read, or null to go on. */
export function checkHeicRequest(h: Headers): { status: number; error: string } | null {
  if (!/^Bearer\s+\S+/i.test(h.get("authorization") ?? "")) return { status: 401, error: "Sign in first." };
  const length = Number(h.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > HEIC_LIMIT) return { status: 413, error: "Too large." };
  // Not a form post from another site: the app always sends raw bytes.
  const type = h.get("content-type") ?? "";
  if (!/^(application\/octet-stream|image\/hei[cf])/i.test(type)) return { status: 415, error: "Send the photo's bytes." };
  return null;
}
