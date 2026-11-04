// Isolated PostgreSQL with minimal existing-schema fixtures. Not a live-schema verification.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
process.on("uncaughtException", (error) => {
  console.error(error.message, error.code ?? "", error.where ?? "");
  process.exit(1);
});
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth; create schema private;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table auth.users(id uuid primary key,instance_id uuid,aud text,role text,email text,encrypted_password text,email_confirmed_at timestamptz,created_at timestamptz,updated_at timestamptz,raw_app_meta_data jsonb,raw_user_meta_data jsonb,is_super_admin boolean,is_anonymous boolean);
create table public.profiles(id uuid primary key,access text default 'pending',onboarding_completed boolean default false,paused_at timestamptz,deletion_requested_at timestamptz);
create table public.profile_private(user_id uuid primary key,birthdate date);
create function public.fixture_profile() returns trigger language plpgsql as $$begin insert into public.profiles(id) values(new.id);return new;end$$;
create trigger fixture_profile after insert on auth.users for each row execute function public.fixture_profile();
create table public.blocks(blocker_id uuid,blocked_id uuid);
create function private.is_active(uid uuid) returns boolean language sql stable security definer as $$select exists(select 1 from public.profiles p where p.id=uid and p.access='active' and (p.onboarding_completed is distinct from false or exists(select 1 from public.profile_private pp where pp.user_id=p.id and pp.birthdate is not null)))$$;
create function private.is_member() returns boolean language sql stable security definer as $$select private.is_active(auth.uid()) and exists(select 1 from auth.users u where u.id=auth.uid() and not coalesce(u.is_anonymous,false))$$;
create function private.is_blocked_between(a uuid,b uuid) returns boolean language sql stable security definer as $$select exists(select 1 from public.blocks x where (x.blocker_id=a and x.blocked_id=b) or (x.blocker_id=b and x.blocked_id=a))$$;
create function public.write_blocked() returns boolean language sql stable security definer as $$select exists(select 1 from public.profiles p where p.id=auth.uid() and (p.paused_at is not null or p.deletion_requested_at is not null))$$;
create table public.rate_limit_hits(action text,user_id uuid,created_at timestamptz default now());
create function public.enforce_rate_limit(p_action text,p_max int,p_window interval) returns void language plpgsql security definer as $$begin
  if (select count(*) from public.rate_limit_hits r where r.action=p_action and r.user_id=auth.uid() and r.created_at>now()-p_window)>=p_max then raise exception 'Slow down' using errcode='55000'; end if;
  insert into public.rate_limit_hits(action,user_id) values(p_action,auth.uid());
end$$;
create table public.posts(id bigint primary key,user_id uuid,pursuit_id text);
create table public.pursuits(id text primary key,user_id uuid references auth.users(id),title text,hobby_slug text,sub_hobby text,inspired_by_post_id bigint,shared boolean default false,mode text,measure jsonb,visibility text,started_at timestamptz,finished_at timestamptz,paused_at timestamptz,updated_at timestamptz);
create table public.pursuit_members(pursuit_id text references public.pursuits(id),user_id uuid references auth.users(id),role text,status text,invited_by uuid,primary key(pursuit_id,user_id));
grant select on public.pursuits,public.pursuit_members,public.posts to authenticated;
grant usage on schema public,private,auth to authenticated;grant execute on function auth.uid(),private.is_member(),private.is_blocked_between(uuid,uuid),public.write_blocked() to authenticated;`);
await db.exec(
  fs.readFileSync(
    new URL(
      "../supabase/migrations/20261112000000_pursuit_workflow.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
await db.exec(
  fs.readFileSync(
    new URL(
      "../supabase/migrations/20261112000100_pursuit_workflow_reminders.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
console.log("Migration applied to isolated PostgreSQL");
try {
  await db.exec(
    fs.readFileSync(
      new URL(
        "../supabase/verification/pursuit_workflow_check.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  throw Error("Verification did not roll back");
} catch (e) {
  if (!e.message.startsWith("RESULTS:")) throw e;
  console.log(e.message);
  if (/FAIL|ERROR|NOT APPLIED/.test(e.message)) process.exitCode = 1;
}
await db.exec("rollback");
const counts = await db.query(
  "select count(*)::int as n from public.pursuits where id like 'workflow-check-%'",
);
if (counts.rows[0].n !== 0) throw Error("Fixture rows left behind");
console.log("PASS: no fixture rows remain");
await db.close();
