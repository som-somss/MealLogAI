-- Execute inside a transaction as authenticated with request.jwt.claim.sub and
-- the current x-meallog-generation set by the test runner. Always ROLLBACK.
do $$
declare
 mid uuid; cid uuid; request_key uuid:=gen_random_uuid(); title text:='__coach_resize_test_'||gen_random_uuid()::text;
 foods jsonb:='[{"name":"검증용 밥","grams":200,"unit":"g","calories":260,"carbs":56,"protein":5,"fat":1},{"name":"계란후라이","grams":100,"unit":"g","calories":196,"carbs":0.8,"protein":13.6,"fat":15}]';
 edit jsonb; saved jsonb; replay jsonb; current_meal jsonb; current_combo jsonb; original_headers text;
begin
 insert into public.meals(user_id,meal_date,meal_type,meal_time,foods,memo)
 values(auth.uid(),'2000-01-03','점심','2000-01-03T12:00:00+09:00',foods,'preserve fixture memo') returning id into mid;
 insert into public.meal_combinations(user_id,name,meal_type,foods,approved_at)
 values(auth.uid(),title,'점심',foods,now()) returning id into cid;
 edit:=jsonb_build_object('meal',jsonb_build_object('id',mid,'index',1,'amount',50,'expected',foods),
   'combination',jsonb_build_object('id',cid,'index',1,'amount',50,'expected',foods,'revision',0));
 saved:=public.meallog_coach_resize(null,request_key,'검증용 계란후라이 50g 수정',edit);
 assert saved#>>'{record_edit,status}'='updated','both targets not updated';
 select m.foods into current_meal from public.meals m where id=mid;
 select c.foods into current_combo from public.meal_combinations c where id=cid;
 assert current_meal=current_combo,'meal and combination differ';
 assert current_meal#>>'{1,grams}'='50','wrong egg amount';
 assert (current_meal#>>'{1,calories}')::numeric=98,'calories not scaled';
 assert (current_meal#>>'{1,protein}')::numeric=6.8,'protein not scaled';
 assert current_meal->0=foods->0,'other food changed';
 assert (select memo from public.meals where id=mid)='preserve fixture memo','memo changed';
 assert (select revision from public.meal_combinations where id=cid)=1,'revision not incremented';
 assert (select count(*) from public.ai_coach_messages where user_id=auth.uid() and request_id=request_key and conversation_id=(saved->>'conversation_id')::uuid)=2,'chat receipt missing';
 replay:=public.meallog_coach_resize(null,request_key,'검증용 계란후라이 50g 수정',edit);
 assert replay=saved,'request replay differs';
 assert (select revision from public.meal_combinations where id=cid)=1,'replay mutated data';

 edit:=jsonb_set(edit,'{meal,expected}',current_meal);
 edit:=jsonb_set(edit,'{combination,expected}',current_combo);
 edit:=jsonb_set(edit,'{combination,revision}','1');
 replay:=public.meallog_coach_resize(null,gen_random_uuid(),'이미 같은 양 수정',edit);
 assert replay#>>'{record_edit,status}'='unchanged','same amount not a no-op';
 assert (select revision from public.meal_combinations where id=cid)=1,'no-op changed revision';

 replay:=public.meallog_coach_resize(null,gen_random_uuid(),'오래된 조합 상태 검증',jsonb_set(jsonb_set(edit,'{meal,amount}','25'),'{combination,revision}','0'));
 assert replay#>>'{record_edit,status}'='conflict','stale revision accepted';
 assert (select m.foods from public.meals m where id=mid)=current_meal,'meal partly changed on conflict';
 replay:=public.meallog_coach_resize(null,gen_random_uuid(),'접근 불가 조합 검증',jsonb_set(jsonb_set(edit,'{meal,amount}','25'),'{combination,id}',to_jsonb(gen_random_uuid())));
 assert replay#>>'{record_edit,status}'='conflict','unknown owner/id accepted';
 assert (select m.foods from public.meals m where id=mid)=current_meal,'meal changed before ownership failure';
 begin
   perform public.meallog_coach_resize(gen_random_uuid(),gen_random_uuid(),'다른 대화 검증',edit);
   raise exception 'ownership check failed';
 exception when others then if sqlerrm<>'conversation unavailable' then raise; end if; end;

 -- A second-target trigger failure must roll back the first-target UPDATE.
 update public.meal_combinations set foods=jsonb_set(current_combo,'{1,calories}','1000000'),revision=2 where id=cid;
 select c.foods into current_combo from public.meal_combinations c where id=cid;
 edit:=jsonb_set(jsonb_set(jsonb_set(jsonb_set(edit,'{combination,expected}',current_combo),'{combination,revision}','2'),'{combination,amount}','100'),'{meal,amount}','25');
 begin
   perform public.meallog_coach_resize(null,gen_random_uuid(),'두번째 저장 실패 롤백 검증',edit);
   raise exception 'expected validation failure';
 exception when others then if sqlerrm<>'invalid_combination_nutrition' then raise; end if; end;
 assert (select m.foods from public.meals m where id=mid)=current_meal,'partial update survived';
 assert (select revision from public.meal_combinations where id=cid)=2,'failed edit changed revision';

 original_headers:=current_setting('request.headers',true);
 if public.ml_record_reset_state()->>'generation' is not null then
   perform set_config('request.headers','{}',true);
   begin
     perform public.meallog_coach_resize(null,gen_random_uuid(),'초기화 보호 검증',jsonb_build_object('meal',edit->'meal'));
     raise exception 'expected generation failure';
   exception when others then if sqlerrm<>'record_reset_reload_required' then raise; end if; end;
   perform set_config('request.headers',original_headers,true);
   assert (select m.foods from public.meals m where id=mid)=current_meal,'reset guard allowed stale write';
 end if;
 assert public.meallog_resize_foods('[{"name":"미입력 음식","grams":100,"nutritionStatus":"unknown","calories":null,"carbs":null,"protein":null,"fat":null}]',0,50)#>'{0,calories}'='null'::jsonb,'unknown nutrition invented';
 assert public.meallog_resize_foods('[{"name":"정밀 수치","grams":50,"calories":10.1234567}]',0,50)='[{"name":"정밀 수치","grams":50,"calories":10.1234567}]'::jsonb,'no-op changed original precision';
end $$;
