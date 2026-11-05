import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
const db = new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role;create schema private;create schema auth;
create function auth.uid() returns uuid language sql as $$select null::uuid$$;
create table public.profile_private(user_id uuid primary key,free_windows text[] constraint profile_private_free_windows_valid check(free_windows is null or cardinality(free_windows)<=14));
insert into public.profile_private values('00000000-0000-4000-8000-00000000f172',array['mon-day','thu-eve']);`);
const home = fs.readFileSync(
  "supabase/migrations/20261113000100_recommendation_semantics.sql",
  "utf8",
);
await db.exec(
  home.slice(
    home.indexOf("create or replace function public.home_suggestions"),
  ),
);
await db.exec(
  fs.readFileSync(
    "supabase/migrations/20261117000000_weekly_free_hours.sql",
    "utf8",
  ),
);
const before = await db.query(
  "select free_windows from public.profile_private where user_id='00000000-0000-4000-8000-00000000f172'",
);
if (
  JSON.stringify(before.rows[0].free_windows) !==
  JSON.stringify(["mon-day", "thu-eve"])
)
  throw Error("Existing selections changed");
console.log("PASS existing selections unchanged");
try {
  await db.exec(
    fs.readFileSync(
      "supabase/verification/weekly_free_hours_check.sql",
      "utf8",
    ),
  );
  throw Error("Verification must roll back");
} catch (e) {
  if (!e.message.startsWith("RESULTS:") || /FAIL|ERROR/.test(e.message))
    throw e;
  console.log(e.message);
}
await db.exec("rollback");
await db.exec(
  "insert into public.profile_private values('00000000-0000-4000-8000-00000000f173',array['mon@1140-1260'])",
);
try {
  await db.exec(
    "insert into public.profile_private values('00000000-0000-4000-8000-00000000f174',array['mon@1140-1260','mon@1200-1260'])",
  );
  throw Error("Invalid insert accepted");
} catch (e) {
  if (e.code !== "23514") throw e;
  console.log("PASS invalid write refused by constraint");
}
await db.close();
