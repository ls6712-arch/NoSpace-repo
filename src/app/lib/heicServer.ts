import { supabase } from "../../lib/supabase";

/** The most /api/heic takes: Vercel's request body limit is 4.5 MB. */
export const HEIC_MAX_BYTES = 4_400_000;

/**
 * HEIC to JPEG on the server (api/heic.ts). The browser converter it replaces (heic2any) needs
 * 'unsafe-eval', which the Content Security Policy refuses. Signed-in people only (uploads are a
 * member feature anyway). Throws on any failure; convertHeicIfNeeded keeps the original then.
 */
export async function heicToJpegOnServer(file: File): Promise<Blob> {
  if (file.size > HEIC_MAX_BYTES) throw new Error("too large for the converter");
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  const token = data.session?.access_token;
  if (!token) throw new Error("not signed in");
  const res = await fetch("/api/heic", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/octet-stream" },
    body: file,
  });
  if (!res.ok || res.headers.get("content-type") !== "image/jpeg") throw new Error(`converter answered ${res.status}`);
  return res.blob();
}
