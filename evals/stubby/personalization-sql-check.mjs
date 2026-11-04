import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const db=new PGlite();
const alice="00000000-0000-4000-8000-000000000001",bob="00000000-0000-4000-8000-000000000002";
const read=p=>readFileSync(new URL(`../../${p}`,import.meta.url),"utf8");
const login=async(id,anonymous=false)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,role:"authenticated",is_anonymous:anonymous})]);await db.exec('set role authenticated');};
const save=async(id,revision,changes)=> (await db.query('select public.save_personalization($1,$2,$3::jsonb) as result',[id,revision,JSON.stringify(changes)])).rows[0].result;
try {
 await db.exec(`create schema private;create schema auth;create table public.app_config(key text primary key,value jsonb);create role authenticated;create role anon;
 create table private.access_allowlist(kind text,name text,reason text,primary key(kind,name));
 create table auth.users(id uuid primary key,is_anonymous boolean default false);
 insert into auth.users(id) values('${alice}'),('${bob}');
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb $$;
 create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
 grant usage on schema auth,private to authenticated,anon;grant execute on function auth.uid(),auth.jwt() to authenticated,anon;
 create table public.profile_private(user_id uuid primary key references auth.users(id),picks text[],updated_at timestamptz, onboarding_step text,
 constraint profile_private_onboarding_step_known check(onboarding_step is null or onboarding_step<>'review'),constraint mirror_test check(not ('bad/fail'=any(picks))));
 alter table public.profile_private enable row level security;grant select,insert,update on public.profile_private to authenticated;
 create policy own_profile on public.profile_private for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
 create table public.stubby_feedback(user_id uuid references auth.users(id),title text);
 alter table public.stubby_feedback enable row level security;grant select,delete on public.stubby_feedback to authenticated;
 create policy own_feedback on public.stubby_feedback for all to authenticated using(user_id=auth.uid());`);
 await db.exec(read('supabase/migrations/20261112000000_stubby_capabilities.sql'));
 await db.exec(read('supabase/migrations/20261113000000_clean_personalization.sql'));
 await db.exec(read('supabase/migrations/20261113000100_recommendation_semantics.sql'));
 try {await db.exec(read('supabase/verification/recommendation_semantics_check.sql'));throw new Error('Expected rollback');}
 catch(e){assert.match(e.message,/RESULTS:/);assert.doesNotMatch(e.message,/FAIL|ERROR|BLOCKED/);await db.exec('rollback');}
 await login(alice);
 let result=await save(alice,0,{motivations:['make'],interests:[{key:'music/guitar',relationship:'returning',experience:'beginner'}]});
 assert.equal(result.revision,1);assert.ok(result.value.confirmedAt);
 assert.deepEqual((await db.query('select picks from public.profile_private where user_id=$1',[alice])).rows[0].picks,['music/guitar']);
 await assert.rejects(save(alice,0,{rhythm:['small']}),e=>e.code==='40001');
 await assert.rejects(save(alice,1,{motivations:['unknown']}),e=>e.code==='22023');
 await assert.rejects(save(alice,1,{interests:[{key:'bad/fail',relationship:'try',experience:'unspecified'}]}),e=>e.code==='23514');
 assert.equal((await db.query('select revision from public.stubby_capabilities where user_id=$1',[alice])).rows[0].revision,1);
 // An old client's profile update preserves the independent new data, but invalidates stale editors.
 await db.query("update public.stubby_capabilities set profile=jsonb_set(profile,'{equipment}','[\"guitar\"]') where user_id=$1",[alice]);
 await assert.rejects(save(alice,1,{rhythm:['small']}),e=>e.code==='40001');
 result=await save(alice,2,{rhythm:['small']});assert.deepEqual(result.value.motivations,['make']);assert.equal(result.revision,3);
 await login(bob);assert.equal((await db.query('select * from public.stubby_capabilities')).rows.length,0);
 await assert.rejects(save(alice,3,{}),e=>e.code==='42501');
 await assert.rejects(save(bob,0,{extra:'bad'}),e=>e.code==='22023');
 assert.equal((await db.query('select * from public.stubby_capabilities')).rows.length,0);
 await login(alice,true);await assert.rejects(save(alice,3,{}),e=>e.code==='42501');
 await db.exec('reset role');
 try {await db.exec(read('supabase/verification/clean_personalization_check.sql'));throw new Error('Expected rollback');}
 catch(e){assert.match(e.message,/RESULTS:/);assert.doesNotMatch(e.message,/FAIL|ERROR|BLOCKED/);await db.exec('rollback');}
 await login(alice);await db.query('select public.forget_stubby_memory($1)',[alice]);
 assert.equal((await db.query('select * from public.stubby_capabilities')).rows.length,0);
 await db.exec('reset role');await db.exec(read('supabase/migrations/rollback_20261113000100_recommendation_semantics.sql'));await db.exec(read('supabase/migrations/rollback_20261113000000_clean_personalization.sql'));
 console.log('PASS: owner/RLS, atomic mirror rollback, invalid data, old client preservation, stale revisions, guest denial, deletion and SQL rollback');
} finally { await db.close(); }
