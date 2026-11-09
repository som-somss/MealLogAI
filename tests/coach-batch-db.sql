-- Authenticated transaction fixture; runner always rolls back.
do $$
declare
 mid uuid; cid uuid; request_key uuid:=gen_random_uuid(); saved jsonb; replay jsonb;
 foods jsonb:='[{"name":"흰쌀밥","grams":210,"unit":"g","calories":273,"carbs":58.8,"protein":5.6,"fat":0.7},{"name":"마요네즈","grams":3,"unit":"g","calories":22,"carbs":0.1,"protein":0.1,"fat":2.3},{"name":"계란후라이","grams":50,"unit":"g","calories":98,"carbs":0.4,"protein":6.8,"fat":7.5},{"name":"영양 미상","grams":10,"unit":"g","nutritionStatus":"unknown","calories":null,"carbs":null,"protein":null,"fat":null}]';
 cucumber jsonb:='{"name":"오이","grams":100,"unit":"g","calories":15,"carbs":3.6,"protein":0.7,"fat":0.1}';
 boiled jsonb:='{"name":"삶은 계란","grams":50,"unit":"g","calories":77.5,"carbs":0.55,"protein":6.3,"fat":5.3}';
 combo_foods jsonb; meal_ops jsonb; combo_ops jsonb; edit jsonb; next_meal jsonb; next_combo jsonb; result jsonb; original_headers text;
begin
 combo_foods:=jsonb_build_array(foods->2,foods->3,foods->0,foods->1);
 insert into public.meals(user_id,meal_date,meal_type,meal_time,foods,memo) values(auth.uid(),'2000-01-06','점심','2000-01-06T12:00:00+09:00',foods,'preserve batch memo') returning id into mid;
 insert into public.meal_combinations(user_id,name,meal_type,foods,approved_at) values(auth.uid(),'__coach_batch_'||gen_random_uuid()::text,'점심',combo_foods,now()) returning id into cid;
 meal_ops:=jsonb_build_array(jsonb_build_object('operation','add','food',cucumber),jsonb_build_object('operation','remove','index',1),jsonb_build_object('operation','replace','index',2,'food',boiled),jsonb_build_object('operation','resize','index',0,'amount',100));
 combo_ops:=jsonb_set(jsonb_set(jsonb_set(meal_ops,'{1,index}','3'),'{2,index}','0'),'{3,index}','2');
 edit:=jsonb_build_object('meal',jsonb_build_object('id',mid,'expected',foods,'operations',meal_ops),'combination',jsonb_build_object('id',cid,'expected',combo_foods,'revision',0,'operations',combo_ops));
 saved:=public.meallog_coach_batch_edit(null,request_key,'복합 변경 검증',edit);
 assert saved#>>'{record_edit,status}'='updated','batch not saved';
 select m.foods into next_meal from public.meals m where id=mid;
 select c.foods into next_combo from public.meal_combinations c where id=cid;
 assert jsonb_array_length(next_meal)=4 and jsonb_array_length(next_combo)=4,'wrong final count';
 assert next_meal->1=boiled and next_combo->0=boiled,'replacement index shifted by removal';
 assert next_meal->2=foods->3 and next_combo->1=foods->3,'untouched unknown food changed';
 assert next_meal->3=cucumber and next_combo->3=cucumber,'additions missing';
 assert (next_meal#>>'{0,grams}')::numeric=100 and (next_combo#>>'{2,grams}')::numeric=100,'resize missing';
 assert (next_meal#>>'{0,calories}')::numeric=130,'resize nutrition wrong';
 assert (select revision from public.meal_combinations where id=cid)=1,'revision must increment once';
 assert (select memo from public.meals where id=mid)='preserve batch memo','memo changed';
 assert jsonb_array_length(saved#>'{record_edit,changes}')=8,'receipt lost operations';
 assert (select count(*) from public.ai_coach_messages where user_id=auth.uid() and request_id=request_key)=2,'receipt not atomic';
 replay:=public.meallog_coach_batch_edit(null,request_key,'복합 변경 검증',edit);
 assert replay=saved,'retry response changed';
 assert (select revision from public.meal_combinations where id=cid)=1,'retry reapplied batch';

 edit:=jsonb_set(jsonb_set(jsonb_set(edit,'{meal,expected}',next_meal),'{combination,expected}',next_combo),'{combination,revision}','0');
 saved:=public.meallog_coach_batch_edit(null,gen_random_uuid(),'조합 충돌',edit);
 assert saved#>>'{record_edit,status}'='conflict','stale combination accepted';
 assert (select m.foods from public.meals m where id=mid)=next_meal,'partial batch on conflict';
 saved:=public.meallog_coach_batch_edit(null,gen_random_uuid(),'없는 조합',jsonb_set(edit,'{combination,id}',to_jsonb(gen_random_uuid())));
 assert saved#>>'{record_edit,status}'='conflict','unavailable target accepted';
 begin
   perform public.meallog_coach_batch_edit(gen_random_uuid(),gen_random_uuid(),'없는 대화',edit);
   raise exception 'expected ownership failure';
 exception when others then if sqlerrm<>'conversation unavailable' then raise; end if; end;

 -- Invalid final operation must not leave any earlier operation persisted.
 begin
   perform public.meallog_coach_batch_edit(null,gen_random_uuid(),'잘못된 마지막 항목',jsonb_build_object('meal',jsonb_build_object('id',mid,'expected',next_meal,'operations',jsonb_build_array(jsonb_build_object('operation','add','food',cucumber),jsonb_build_object('operation','remove','index',99)))));
   raise exception 'expected final operation failure';
 exception when others then if sqlerrm<>'invalid food index' then raise; end if; end;
 assert (select m.foods from public.meals m where id=mid)=next_meal,'earlier operation survived';

 -- A second UPDATE trigger failure rolls back the first UPDATE and receipt.
 update public.meal_combinations set foods=jsonb_set(next_combo,'{0,calories}','1000000'),revision=2 where id=cid;
 select c.foods into combo_foods from public.meal_combinations c where id=cid;
 edit:=jsonb_build_object('meal',jsonb_build_object('id',mid,'expected',next_meal,'operations',jsonb_build_array(jsonb_build_object('operation','resize','index',0,'amount',50),jsonb_build_object('operation','add','food',cucumber))),
   'combination',jsonb_build_object('id',cid,'expected',combo_foods,'revision',2,'operations',jsonb_build_array(jsonb_build_object('operation','resize','index',0,'amount',100),jsonb_build_object('operation','add','food',cucumber))));
 request_key:=gen_random_uuid();
 begin
   perform public.meallog_coach_batch_edit(null,request_key,'두번째 저장 실패',edit);
   raise exception 'expected second update failure';
 exception when others then if sqlerrm<>'invalid_combination_nutrition' then raise; end if; end;
 assert (select m.foods from public.meals m where id=mid)=next_meal,'first UPDATE survived';
 assert (select revision from public.meal_combinations where id=cid)=2,'failed batch changed revision';
 assert not exists(select 1 from public.ai_coach_messages where user_id=auth.uid() and request_id=request_key),'failed batch saved success';

 original_headers:=current_setting('request.headers',true);
 if public.ml_record_reset_state()->>'generation' is not null then
   perform set_config('request.headers','{}',true);
   begin
     perform public.meallog_coach_batch_edit(null,gen_random_uuid(),'초기화 보호',jsonb_build_object('meal',edit->'meal'));
     raise exception 'expected generation failure';
   exception when others then if sqlerrm<>'record_reset_reload_required' then raise; end if; end;
   perform set_config('request.headers',original_headers,true);
 end if;
 begin
   perform public.meallog_apply_food_batch(foods,'[{"operation":"remove","index":1},{"operation":"resize","index":1,"amount":2}]',8);
   raise exception 'expected duplicate failure';
 exception when others then if sqlerrm<>'duplicate food target' then raise; end if; end;
 result:=public.meallog_apply_food_batch(jsonb_build_array(foods->1),jsonb_build_array(jsonb_build_object('operation','remove','index',0),jsonb_build_object('operation','add','food',cucumber)),8);
 assert result->'foods'=jsonb_build_array(cucumber),'remove-last/add should use final count';
 select jsonb_agg(cucumber) into combo_foods from generate_series(1,8);
 result:=public.meallog_apply_food_batch(combo_foods,jsonb_build_array(jsonb_build_object('operation','add','food',boiled),jsonb_build_object('operation','remove','index',0)),8);
 assert jsonb_array_length(result->'foods')=8 and result#>'{foods,7}'=boiled,'full combination swap failed';
 begin
   perform public.meallog_apply_food_batch(combo_foods,jsonb_build_array(jsonb_build_object('operation','add','food',boiled)),8);
   raise exception 'expected final count failure';
 exception when others then if sqlerrm<>'invalid final food count' then raise; end if; end;
 -- An unchanged multi-operation request does not rewrite rows.
 saved:=public.meallog_coach_batch_edit(null,gen_random_uuid(),'같은 양 유지',jsonb_build_object('meal',jsonb_build_object('id',mid,'expected',next_meal,'operations','[{"operation":"resize","index":0,"amount":100},{"operation":"resize","index":1,"amount":50}]'::jsonb)));
 assert saved#>>'{record_edit,status}'='unchanged','no-op batch rewritten';
end $$;
