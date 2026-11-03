// Who is calling an edge function, and from where. Shared by every function that takes a user's
// token (see supabase/security/access-allowlist.json, "edgeFunctions"). Pure apart from the
// fetches it is handed, so it is tested without a network (src/app/lib/edgeAccess.test.ts).

/** What the database says about the caller (public.my_access(), read as them). */
export interface Access {
  id: string;
  guest: boolean;
  member: boolean;
  /** A birthdate on file at least 21 years ago: the only way to 21+ picks. */
  adult21: boolean;
}

/**
 * The caller behind a bearer token, or null. The token is checked with Supabase Auth first, then
 * public.my_access() is read as the caller, so the database's own definition of a member decides.
 * Nothing in the request body is ever used for this.
 */
export async function accessOf(
  token: string,
  getUser: (token: string) => Promise<{ id: string; is_anonymous?: boolean } | null>,
  myAccess: () => Promise<{ member?: unknown; guest?: unknown; adult21?: unknown } | null>,
): Promise<Access | null> {
  if (!token) return null;
  const user = await getUser(token).catch(() => null);
  if (!user?.id) return null;
  const a = await myAccess().catch(() => null);
  // Fails closed: with no answer from the database (my_access missing, say, because the function
  // was deployed before the migrations), Auth's own flag decides guest or not, and nobody is a
  // member or 21+.
  const guest = user.is_anonymous === true || (a !== null && a.guest !== false);
  const member = !guest && a?.member === true;
  const adult21 = !guest && a?.adult21 === true;
  return { id: user.id, guest, member, adult21 };
}

/**
 * True for "this function or table isn't in the database": PostgREST's PGRST202 (no function) and
 * PGRST205 (no table), Postgres's 42883 and 42P01. That means the migration hasn't been applied
 * yet, which is different from a failure.
 */
export function isMissingInDb(code: unknown): boolean {
  return code === "PGRST202" || code === "PGRST205" || code === "42883" || code === "42P01";
}

/**
 * The member rule before 20261111000050_member_gate.sql (no my_access() yet), from the caller's own
 * my_profile_private() row: an active account that finished onboarding. Slightly stricter than
 * private.is_active() (which also counts a birthdate), never looser. Never 21+: that needs
 * my_access(). Never a guest: Auth's own flag decides that.
 */
export function legacyAccess(row: unknown): { member: boolean; guest: false; adult21: false } {
  const r = (Array.isArray(row) ? row[0] : row) as { access?: unknown; onboarding_completed?: unknown } | null | undefined;
  return { member: r?.access === "active" && r?.onboarding_completed === true, guest: false, adult21: false };
}

/** The allowed origins from ALLOWED_ORIGINS (comma separated), or the live site's. */
export function allowedOrigins(v: string | undefined): string[] {
  const list = (v ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter((s) => /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(s));
  return list.length ? list : ["https://www.onsoosh.com", "https://onsoosh.com"];
}

/**
 * A browser request from another site is refused. A request with no Origin (a server, the morning
 * schedule, curl) goes on to the token and limit checks like any other.
 */
export function originAllowed(origin: string | null, allowed: readonly string[]): boolean {
  return origin === null || allowed.includes(origin.replace(/\/$/, ""));
}

/** CORS headers for an allowed origin; none for anything else. */
export function corsFor(origin: string | null, allowed: readonly string[]): Record<string, string> {
  const base = { "access-control-allow-headers": "authorization, x-client-info, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS", vary: "Origin" };
  return origin && allowed.includes(origin.replace(/\/$/, "")) ? { ...base, "access-control-allow-origin": origin } : base;
}

/** The client's IP as the platform saw it: Cloudflare's header first, then the first forwarded hop. */
export function clientIp(headers: Headers): string | null {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const xff = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return xff;
  return headers.get("x-real-ip")?.trim() || null;
}

/** HMAC-SHA256 of the IP with a secret salt, as 64 hex characters. Null without a salt or an IP: guests are then refused. */
export async function ipHash(ip: string | null, salt: string | undefined): Promise<string | null> {
  if (!ip || !salt || salt.length < 16) return null;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(salt), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
