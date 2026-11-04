-- Read-only comparisons; transaction rolls back unconditionally.
begin;
do $$
declare results text[]:='{}'; score double precision;
begin
  results:=array_append(results,case when private.recommendation_price_max('Free supplies with a $20 class')=20 and private.recommendation_price_max('From $10') is null and private.recommendation_price_max('Free')=0 and private.recommendation_price_max('$10 + $5 materials') is null then 'PASS: conservative cost' else 'FAIL: cost' end);
  score:=private.personalization_score('{"motivations":["make"],"rhythm":["small"],"interests":[],"durationMax":null}', '{"motivations":["make"],"durationMinutes":10,"beginner":true}','art-creative/drawing');
  results:=array_append(results,case when score=6 then 'PASS: SQL preference parity' else 'FAIL: score' end);
  results:=array_append(results,case when exists(select 1 from public.app_config as a where a.key='recommendation_traits_v1' and jsonb_typeof(a.value)='object') then 'PASS: public catalog loaded' else 'FAIL: catalog' end);
  results:=array_append(results,case when private.personalization_interest_key('food-cooking/home-coffee')='food-cooking/coffee' then 'PASS: legacy alias parity' else 'FAIL: aliases' end);
  raise exception 'RESULTS: %',array_to_string(results,', ');
end $$;
rollback;
