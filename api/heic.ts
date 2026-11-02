// POST /api/heic: one HEIC or HEIF photo in, a JPEG out (its first frame for a burst).
//
// Replaces the browser converter (heic2any), which evaluated strings: the Content Security Policy
// in vercel.json refuses 'unsafe-eval'. Every rule (who, how big, how many, how long) is in
// heicCheck.ts and tested there; this file only wires in Supabase and heic-convert.
// Nothing is stored or logged. Members only: claim_heic_conversion() needs migration
// 20261111000050_member_gate.sql; until it is applied every request is refused.
import convert from "heic-convert";
import { handleHeic, type Claim } from "./heicCheck";

// The platform stops the function at 10 seconds too, if the converter never yields. Vercel reads
// this object without running the file, so it must stay literal values (heicApi.test.ts checks
// that it matches TIMEOUT_MS).
export const config = { runtime: "nodejs", maxDuration: 10 };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

export function POST(req: Request): Promise<Response> {
  return handleHeic(req, {
    // Supabase Auth verifies the JWT (signature and expiry) and says who it is.
    async getUser(token) {
      if (!SUPABASE_URL || !ANON_KEY) return null;
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, authorization: `Bearer ${token}` } });
      return res.ok ? ((await res.json()) as { id: string; is_anonymous?: boolean }) : null;
    },
    // As the person: the RPC gate refuses a non-member (403); the function counts and limits.
    async claim(token): Promise<Claim> {
      if (!SUPABASE_URL || !ANON_KEY) return "error";
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/claim_heic_conversion`, {
        method: "POST",
        headers: { apikey: ANON_KEY, authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: "{}",
      });
      if (res.status === 401 || res.status === 403) return "not_member";
      if (!res.ok) return "error";
      const v = (await res.json()) as unknown;
      return v === "ok" || v === "not_signed_in" || v === "not_member" || v === "rate_limited" ? v : "error";
    },
    async convert(bytes) {
      const out = await convert({ buffer: Buffer.from(bytes), format: "JPEG", quality: 0.9 });
      return new Uint8Array(out);
    },
  });
}
