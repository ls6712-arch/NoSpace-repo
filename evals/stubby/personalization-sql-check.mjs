import { emptyPersonalization, preferenceScore, priceMaximum } from "../../supabase/functions/_shared/personalization.ts";
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
 create table public.personal_picks(id bigint primary key,user_id uuid,title text,kind text);
 insert into public.personal_picks values(1,'${alice}','Drawing','idea'),(2,'${bob}','Guitar','idea');
 grant select on public.personal_picks to authenticated;`);
 const guestSQL=read('supabase/migrations/20261111000100_stubby_guests.sql');
 await db.exec(guestSQL.slice(guestSQL.indexOf('create table public.stubby_feedback'),guestSQL.indexOf('-- 5. The member gate')));
 await db.exec(read('supabase/migrations/20261112000000_stubby_capabilities.sql'));
 await db.exec(read('supabase/migrations/20261113000000_clean_personalization.sql'));
 await db.exec(read('evals/stubby/home-sql-fixture.sql'));
 await db.exec(read('supabase/migrations/20261113000100_recommendation_semantics.sql'));
 for(const price of ['Free','$10–$30','$10–30','$20 class, $10 materials','$10 + $5 materials','Free supplies with a $20 class','From $10',null]){
  const actual=(await db.query('select private.recommendation_price_max($1) as cost',[price])).rows[0].cost;
  assert.equal(actual===null ? null : Number(actual),priceMaximum(price));
 }
 const preferenceFixtures=[
  [emptyPersonalization(),{motivations:['make'],durationMinutes:10,beginner:true},'art-creative/drawing'],
  [{...emptyPersonalization(),motivations:['make'],rhythm:['small'],durationMax:30,interests:[{key:'art-creative/drawing',relationship:'returning',experience:'beginner'}]},{motivations:['make'],durationMinutes:10,beginner:true},'art-creative/drawing'],
  [{...emptyPersonalization(),interests:[{key:'music/guitar',relationship:'try',experience:'unspecified'}]},{motivations:['learn'],durationMinutes:null,beginner:null},'music/guitar'],
 ];
 for(const [preferences,facts,key] of preferenceFixtures){
  const actual=(await db.query('select private.personalization_score($1::jsonb,$2::jsonb,$3) as score',[JSON.stringify(preferences),JSON.stringify(facts),key])).rows[0].score;
  assert.equal(Number(actual),preferenceScore(preferences,facts,key));
 }

 try {await db.exec(read('supabase/verification/recommendation_semantics_check.sql'));throw new Error('Expected rollback');}
 catch(e){assert.match(e.message,/RESULTS:/);assert.doesNotMatch(e.message,/FAIL|ERROR|BLOCKED/);await db.exec('rollback');}
 await db.exec(read('supabase/migrations/20261113000200_personalization_editor.sql'));
 try {await db.exec(read('supabase/verification/personalization_editor_check.sql'));throw new Error('Expected rollback');}
 catch(e){assert.match(e.message,/RESULTS:/);assert.doesNotMatch(e.message,/FAIL|ERROR|BLOCKED/);await db.exec('rollback');}
 await db.exec(read('supabase/migrations/20261113000300_feedback_details.sql'));
 try {await db.exec(read('supabase/verification/feedback_details_check.sql'));throw new Error('Expected rollback');}
 catch(e){assert.match(e.message,/RESULTS:/);assert.doesNotMatch(e.message,/FAIL|ERROR|BLOCKED/);await db.exec('rollback');}
 await login(alice);
 await db.query("select public.record_stubby_feedback(1,'down','today','request')");
 await assert.rejects(db.query("select public.record_stubby_feedback(2,'down','price','request')"),e=>e.code==='42501');
 await assert.rejects(db.query("select public.record_stubby_feedback(1,'down','activity','usual')"),e=>e.code==='42501');
 await assert.rejects(db.query("select public.record_stubby_feedback(1,'down','today','usual')"),e=>e.code==='22023');
 await db.query("select public.record_stubby_feedback(1,'down','time','request')");
 assert.equal((await db.query('select count(*)::integer as count from public.stubby_feedback')).rows[0].count,1);
 assert.equal((await db.query('select reason from public.stubby_feedback')).rows[0].reason,'time');
 const snapshot=(await db.query('select public.read_personalization($1) as result',[alice])).rows[0].result;assert.equal(snapshot.revision,0);assert.deepEqual(snapshot.taste.picks,[]);
 await assert.rejects(db.query('select public.read_personalization($1)',[bob]),e=>e.code==='42501');
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
 result=await save(alice,3,{motivations:[]});assert.equal(result.value.answerStates.motivations,'removed');
 await db.query("update public.profile_private set picks=ARRAY['music/piano'] where user_id=$1",[alice]);
 await assert.rejects(save(alice,result.revision,{rhythm:['weekend']}),e=>e.code==='40001');
 const legacy=(await db.query('select personalization from public.stubby_capabilities where user_id=$1',[alice])).rows[0].personalization;assert.equal(legacy.interests[0].key,'music/piano');assert.equal(legacy.interests[0].experience,'unspecified');
 await db.query("update public.stubby_capabilities set profile=jsonb_set(profile,'{consent,feedback}','true') where user_id=$1",[alice]);
 await db.query("select public.record_stubby_feedback(1,'down','activity','usual')");
 await db.query("insert into public.stubby_feedback(pick_id,signal) values(1,'up')");
 assert.equal((await db.query("select scope from public.stubby_feedback where signal='up'")).rows[0].scope,'usual');
 await login(bob);assert.equal((await db.query('select * from public.stubby_capabilities')).rows.length,0);
 await assert.rejects(save(alice,3,{}),e=>e.code==='42501');
 await assert.rejects(save(bob,0,{extra:'bad'}),e=>e.code==='22023');
 assert.equal((await db.query('select * from public.stubby_capabilities')).rows.length,0);
 await login(alice,true);await assert.rejects(save(alice,3,{}),e=>e.code==='42501');
 await db.exec('reset role');
 try {await db.exec(read('supabase/verification/clean_personalization_check.sql'));throw new Error('Expected rollback');}
 catch(e){assert.match(e.message,/RESULTS:/);assert.doesNotMatch(e.message,/FAIL|ERROR|BLOCKED/);await db.exec('rollback');}
 await login(alice);
 await db.query("update public.profile_private set monthly_budget=0 where user_id=$1",[alice]);
 let home=(await db.query('select * from public.home_suggestions(20)')).rows;
 assert.deepEqual(home.map(h=>h.ref_id),['1']);
 await db.query("update public.stubby_capabilities set profile=jsonb_set(profile,'{perActivityBudget}','20') where user_id=$1",[alice]);
 home=(await db.query('select * from public.home_suggestions(20)')).rows;
 assert.deepEqual(home.map(h=>h.ref_id).sort(),['1','3']);
 await login(alice,true);assert.equal((await db.query('select * from public.home_suggestions(20)')).rows.length,0);
 await login(alice);await db.query('select public.forget_stubby_memory($1)',[alice]);
 assert.equal((await db.query('select * from public.stubby_capabilities')).rows.length,0);
 await db.exec('reset role');await db.exec(read('supabase/migrations/rollback_20261113000300_feedback_details.sql'));await db.exec(read('supabase/migrations/rollback_20261113000200_personalization_editor.sql'));await db.exec(read('supabase/migrations/rollback_20261113000100_recommendation_semantics.sql'));await db.exec(read('supabase/migrations/rollback_20261113000000_clean_personalization.sql'));
 console.log('PASS: owner snapshots/RLS, atomic saves and rollback, legacy compatibility, stale edits, guest denial, scoped feedback/opt-in, Home cost filters, deletion and migration rollback');
} finally { await db.close(); }
