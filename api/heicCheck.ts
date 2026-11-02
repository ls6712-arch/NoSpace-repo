// /api/heic, everything except the converter and the network: pure, so each rule is tested
// (src/app/lib/heicApi.test.ts) without Node, Vercel or Supabase.
//
// Order, cheapest refusal first, nothing decoded until every check has passed:
//   1. a bearer token, the right content type, a declared size under the limit
//   2. the token is a real Supabase session (Auth verifies the JWT), not an anonymous guest
//   3. the database says a member, within 30 conversions an hour (claim_heic_conversion)
//   4. the body, read with a hard cap: reading stops at the limit whatever the header said
//   5. the bytes are a HEIF file (ftyp brand), not whatever the name or type claims
//   6. the image's own declared size (ispe) is at most 40 megapixels, before any decoding
//   7. the conversion, with a 10 second limit
// Nothing is stored or logged; every refusal is a short generic line.

export const HEIC_LIMIT = 4_400_000;
export const MAX_PIXELS = 40_000_000;
export const TIMEOUT_MS = 10_000;

export type Claim = "ok" | "not_signed_in" | "not_member" | "rate_limited" | "error";

export interface HeicDeps {
  /** Supabase Auth's answer for this token (it verifies the JWT), or null. */
  getUser(token: string): Promise<{ id: string; is_anonymous?: boolean } | null>;
  /** claim_heic_conversion(), called as the person. */
  claim(token: string): Promise<Claim>;
  /** HEIC to JPEG. */
  convert(bytes: Uint8Array): Promise<Uint8Array>;
  timeoutMs?: number;
}

/** The only answers a client ever sees. */
export const ERRORS = {
  401: "Sign in first.",
  403: "Not available.",
  413: "Too large.",
  415: "Not a HEIC photo.",
  422: "This photo couldn't be converted.",
  429: "Too many photos for now. Try again later.",
  504: "This photo couldn't be converted.",
  500: "Something went wrong.",
} as const;

const fail = (status: keyof typeof ERRORS) =>
  new Response(JSON.stringify({ error: ERRORS[status] }), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/** HEIF brands at bytes 8 to 11, after "ftyp" at bytes 4 to 7. */
const BRANDS = new Set(["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"]);

export function looksLikeHeif(b: Uint8Array): boolean {
  if (b.length < 12) return false;
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  return ascii(4, 8) === "ftyp" && BRANDS.has(ascii(8, 12));
}

/** A refusal before anything is read, or null to go on. */
export function checkHeicRequest(h: Headers): { status: 401 | 413 | 415; error: string } | null {
  if (!/^Bearer\s+\S+/i.test(h.get("authorization") ?? "")) return { status: 401, error: ERRORS[401] };
  const length = Number(h.get("content-length") ?? "0");
  if (!Number.isFinite(length) || length > HEIC_LIMIT) return { status: 413, error: ERRORS[413] };
  // Not a form post from another site: the app always sends raw bytes.
  if (!/^(application\/octet-stream|image\/hei[cf])(;|$)/i.test(h.get("content-type") ?? "")) return { status: 415, error: ERRORS[415] };
  return null;
}

/** Reads a body, stopping as soon as it passes the limit (a header can lie). Null when too large. */
export async function readCapped(body: ReadableStream<Uint8Array> | null, limit = HEIC_LIMIT): Promise<Uint8Array | null> {
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    parts.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const u32 = (b: Uint8Array, at: number) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
const type = (b: Uint8Array, at: number) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);

/**
 * The largest width x height the file declares in its ispe boxes (meta > iprp > ipco > ispe),
 * read from the box headers only, nothing decoded. Null when there is none or the boxes don't
 * add up: such a file is refused rather than decoded blind.
 */
export function heifPixels(b: Uint8Array): number | null {
  let best: number | null = null;
  const walk = (start: number, end: number, depth: number): boolean => {
    let at = start;
    while (at + 8 <= end) {
      let size = u32(b, at);
      const t = type(b, at + 4);
      let header = 8;
      if (size === 1) {
        if (at + 16 > end) return false;
        // A 64-bit size: anything this large is far past the limit anyway.
        if (u32(b, at + 8) !== 0) return false;
        size = u32(b, at + 12);
        header = 16;
      } else if (size === 0) size = end - at;
      if (size < header || at + size > end) return false;
      const body = at + header;
      if (t === "meta") {
        // A full box: 4 bytes of version and flags before its children.
        if (!walk(body + 4, at + size, depth + 1)) return false;
      } else if (t === "iprp" || t === "ipco") {
        if (!walk(body, at + size, depth + 1)) return false;
      } else if (t === "ispe") {
        if (body + 12 > at + size) return false;
        const w = u32(b, body + 4);
        const h = u32(b, body + 8);
        const px = w * h;
        if (best === null || px > best) best = px;
      }
      at += size;
      if (depth > 8) return false;
    }
    return true;
  };
  return walk(0, b.length, 0) ? best : null;
}

/** Rejects after `ms`; the platform also stops the function at its own maxDuration. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export async function handleHeic(req: Request, deps: HeicDeps): Promise<Response> {
  if (req.method !== "POST") return fail(415);
  const first = checkHeicRequest(req.headers);
  if (first) return fail(first.status);
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

  const user = await deps.getUser(token).catch(() => null);
  if (!user?.id || user.is_anonymous) return fail(401);
  const claim = await deps.claim(token).catch((): Claim => "error");
  if (claim === "not_signed_in") return fail(401);
  if (claim === "not_member") return fail(403);
  if (claim === "rate_limited") return fail(429);
  if (claim !== "ok") return fail(500);

  const bytes = await readCapped(req.body).catch(() => null);
  if (!bytes) return fail(413);
  if (bytes.length === 0 || !looksLikeHeif(bytes)) return fail(415);
  const px = heifPixels(bytes);
  if (px === null) return fail(415);
  if (px > MAX_PIXELS) return fail(413);

  try {
    const out = await withTimeout(deps.convert(bytes), deps.timeoutMs ?? TIMEOUT_MS);
    return new Response(out, { status: 200, headers: { "content-type": "image/jpeg", "cache-control": "private, no-store" } });
  } catch (e) {
    return fail((e as Error)?.message === "timeout" ? 504 : 422);
  }
}
