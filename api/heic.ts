// POST /api/heic: one HEIC or HEIF photo in, a JPEG out (its first frame for a burst).
//
// Replaces the browser converter (heic2any), which evaluated strings: the Content Security Policy
// in vercel.json refuses 'unsafe-eval'. Here the conversion runs in Node with heic-convert.
//
// Who: a signed-in person with a real login (an anonymous guest is refused), checked against
// Supabase Auth with their own token. What: at most 4.4 MB (Vercel's body limit is 4.5 MB), and
// only bytes that start like a HEIF file. Nothing is stored or logged; the reply is never cached.
import convert from "heic-convert";
import { checkHeicRequest, HEIC_LIMIT, looksLikeHeif } from "./heicCheck";

export const config = { runtime: "nodejs", maxDuration: 30 };

const json = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function userOf(token: string): Promise<{ id: string; is_anonymous?: boolean } | null> {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return (await res.json()) as { id: string; is_anonymous?: boolean };
  } catch {
    return null;
  }
}

export async function POST(req: Request): Promise<Response> {
  const first = checkHeicRequest(req.headers);
  if (first) return json(first.status, first.error);
  const user = await userOf((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim());
  if (!user?.id || user.is_anonymous) return json(401, "Sign in first.");

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length === 0 || bytes.length > HEIC_LIMIT) return json(413, "Too large.");
  if (!looksLikeHeif(bytes)) return json(415, "Not a HEIC photo.");
  try {
    const out = await convert({ buffer: Buffer.from(bytes), format: "JPEG", quality: 0.9 });
    return new Response(new Uint8Array(out), { status: 200, headers: { "content-type": "image/jpeg", "cache-control": "private, no-store" } });
  } catch {
    return json(422, "This photo couldn't be converted.");
  }
}
