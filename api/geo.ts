// GET /api/geo: an approximate city for the visitor, from Vercel's own geolocation headers
// (https://vercel.com/docs/headers/request-headers#x-vercel-ip-city). Used once, to prefill the
// city on Stubby's quick-context card, where it can be changed. Returns a city name only: never
// coordinates, never the IP, nothing stored or logged. Not cached (it is per visitor).
export const config = { runtime: "edge" };

export default function handler(req: Request): Response {
  const headers = { "content-type": "application/json", "cache-control": "private, no-store" };
  if (req.method !== "GET") return new Response(JSON.stringify({ city: null }), { status: 405, headers });
  let city: string | null = null;
  try {
    const raw = req.headers.get("x-vercel-ip-city");
    city = raw ? decodeURIComponent(raw) : null;
  } catch {
    city = null;
  }
  // Letters, spaces and a little punctuation; 80 characters at most.
  const clean = city ? city.replace(/[^\p{L}\p{M} '.,-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 80) : "";
  return new Response(JSON.stringify({ city: clean.length >= 2 ? clean : null }), { status: 200, headers });
}
