// Supabase Edge Function: the daily clean up of Corner chat's audit copies.
//
//   POST /functions/v1/purge-corner-chat      called every day at 04:25 UTC by the pg_cron job
//                                             purge-corner-message-removals (pg_net, no sign-in)
//
// Deploy WITHOUT gateway JWT verification, because the schedule has no sign-in:
//   supabase functions deploy purge-corner-chat --no-verify-jwt
// It takes no input and returns only two numbers. All it can ever do is remove what is already past 30
// days (the database decides which, in corner_removals_due), so calling it early does nothing.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { purgeDue, type PurgeClient } from "./purge.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const result = await purgeDue(admin as unknown as PurgeClient);
  return new Response(JSON.stringify(result), {
    status: result.error ? 500 : 200,
    headers: { "content-type": "application/json" },
  });
});
