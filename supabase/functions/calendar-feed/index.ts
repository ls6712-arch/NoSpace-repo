// Supabase Edge Function: the private .ics feed behind "Copy subscribe link".
//
//   GET /functions/v1/calendar-feed?token=<43 character token>
//
// Deploy WITHOUT JWT verification (a calendar app cannot send one; the token is the key):
//   supabase functions deploy calendar-feed --no-verify-jwt
// Secrets: SITE_URL (the app's address, for the link back in each event). SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase. See README.md.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleFeed } from "./handler.ts";
import { loadPlans } from "./plans.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const siteUrl = Deno.env.get("SITE_URL") ?? undefined;

Deno.serve((req) =>
  handleFeed(req, {
    userForTokenHash: async (hash) => {
      const { data, error } = await admin.from("calendar_feed_tokens").select("user_id").eq("token_hash", hash).is("revoked_at", null).maybeSingle();
      if (error) throw error;
      return (data as { user_id: string } | null)?.user_id ?? null;
    },
    plansFor: (userId, fromMs, toMs) => loadPlans(admin, userId, fromMs, toMs, siteUrl),
  }),
);
