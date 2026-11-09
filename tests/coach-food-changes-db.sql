-- Runner sets authenticated identity/generation in a transaction and rolls back.
do $$
declare
 mid uuid; cid uuid; request_key uuid:=gen_random_uuid(); saved jsonb; replay jsonb;
 foods jsonb:='[{"name":"검증 밥","grams":200,"unit":"g","calories":260,"carbs":56,"protein":5,"fat":1},{"name":"계란후라이","grams":50,"unit":"g","calories":98,"carbs":0.4,"protein":6.8,"fat":7.5}]';
 added jsonb:='{"name":"오이","grams":100,"unit":"g","calories":15,"carbs":3.6,"protein":0.7,"fat":0.1,"manualBrand":""}';
 edit jsonb; next_foods jsonb; full_foods jsonb; original_headers text;
begin
 insert into public.meals(user_id,meal_date,meal_type,meal_time,foods,memo)
 values(auth.uid(),'2000-01-04','점심','2000-01-04T12:00:00+09:00',foods,'preserve memo') returning id into mid;
 insert into public.meal_combinations(user_id,name,meal_type,foods,approved_at)
 values(auth.uid(),'__coach_food_change_'||gen_random_uuid()::text,'점심',foods,now()) returning id into cid;
 edit:=jsonb_build_object('operation','add','food',added,'meal',jsonb_build_object('id',mid,'expected',foods),'combination',jsonb_build_object('id',cid,'expected',foods,'revision',0));
 saved:=public.meallog_coach_change_foods(null,request_key,'음식 추가 테스트',edit);
 assert saved#>>'{record_edit,status}'='updated','add not applied';
 next_foods:=foods||jsonb_build_array(added);
 assert (select m.foods from public.meals m where id=mid)=next_foods,'meal add incorrect';
 assert (select c.foods from public.meal_combinations c where id=cid)=next_foods,'combo add incorrect';
 assert (select revision from public.meal_combinations where id=cid)=1,'revision missing';
 assert (select memo from public.meals where id=mid)='preserve memo','memo changed';
 assert (select count(*) from public.ai_coach_messages where user_id=auth.uid() and request_id=request_key)=2,'receipt missing';
 replay:=public.meallog_coach_change_foods(null,request_key,'음식 추가 테스트',edit);
 assert replay=saved,'retry changed response';
 assert (select m.foods from public.meals m where id=mid)=next_foods,'retry duplicated food';

 edit:=jsonb_build_object('operation','remove','meal',jsonb_build_object('id',mid,'expected',next_foods,'index',2),'combination',jsonb_build_object('id',cid,'expected',next_foods,'revision',1,'index',2));
 saved:=public.meallog_coach_change_foods(null,gen_random_uuid(),'음식 빼기 테스트',edit);
 assert saved#>>'{record_edit,operation}'='remove','remove receipt incorrect';
 assert (select m.foods from public.meals m where id=mid)=foods,'remove did not preserve other meal foods';
 assert (select c.foods from public.meal_combinations c where id=cid)=foods,'remove did not preserve other combo foods';
 assert (select revision from public.meal_combinations where id=cid)=2,'remove revision missing';

 edit:=jsonb_build_object('operation','add','food',added,'meal',jsonb_build_object('id',mid,'expected',foods),'combination',jsonb_build_object('id',cid,'expected',foods,'revision',1));
 saved:=public.meallog_coach_change_foods(null,gen_random_uuid(),'오래된 revision',edit);
 assert saved#>>'{record_edit,status}'='conflict','stale revision accepted';
 assert (select m.foods from public.meals m where id=mid)=foods,'partial write on conflict';
 saved:=public.meallog_coach_change_foods(null,gen_random_uuid(),'없는 조합',jsonb_set(edit,'{combination,id}',to_jsonb(gen_random_uuid())));
 assert saved#>>'{record_edit,status}'='conflict','unavailable target accepted';
 assert (select m.foods from public.meals m where id=mid)=foods,'partial write on missing combo';
 begin
   perform public.meallog_coach_change_foods(gen_random_uuid(),gen_random_uuid(),'없는 대화',edit);
   raise exception 'expected ownership failure';
 exception when others then if sqlerrm<>'conversation unavailable' then raise; end if; end;

 -- Combo validation fails AFTER meal update; both data and receipt roll back.
 select jsonb_agg(added) into full_foods from generate_series(1,8);
 update public.meal_combinations set foods=full_foods,revision=3 where id=cid;
 edit:=jsonb_set(jsonb_set(edit,'{combination,expected}',full_foods),'{combination,revision}','3');
 request_key:=gen_random_uuid();
 begin
   perform public.meallog_coach_change_foods(null,request_key,'조합이 가득 찬 경우',edit);
   raise exception 'expected combo limit failure';
 exception when others then if sqlerrm<>'invalid_combination' then raise; end if; end;
 assert (select m.foods from public.meals m where id=mid)=foods,'first update survived second failure';
 assert (select revision from public.meal_combinations where id=cid)=3,'failed add changed revision';
 assert not exists(select 1 from public.ai_coach_messages where user_id=auth.uid() and request_id=request_key),'failure saved success receipt';

 -- Last item cannot be removed, even through a direct RPC call.
 update public.meal_combinations set foods=jsonb_build_array(added),revision=4 where id=cid;
 edit:=jsonb_build_object('operation','remove','meal',jsonb_build_object('id',mid,'expected',foods,'index',1),'combination',jsonb_build_object('id',cid,'expected',jsonb_build_array(added),'revision',4,'index',0));
 begin
   perform public.meallog_coach_change_foods(null,gen_random_uuid(),'마지막 음식 제거',edit);
   raise exception 'expected last food failure';
 exception when others then if sqlerrm<>'cannot remove last food' then raise; end if; end;
 assert (select m.foods from public.meals m where id=mid)=foods,'last food guard partly removed meal';

 original_headers:=current_setting('request.headers',true);
 if public.ml_record_reset_state()->>'generation' is not null then
   perform set_config('request.headers','{}',true);
   begin
     perform public.meallog_coach_change_foods(null,gen_random_uuid(),'초기화 보호',jsonb_build_object('operation','add','food',added,'meal',edit->'meal'));
     raise exception 'expected generation failure';
   exception when others then if sqlerrm<>'record_reset_reload_required' then raise; end if; end;
   perform set_config('request.headers',original_headers,true);
 end if;
 begin
   perform public.meallog_change_foods(foods,'add',null,jsonb_set(added,'{grams}','-1'));
   raise exception 'expected invalid amount failure';
 exception when others then if sqlerrm<>'invalid added food' then raise; end if; end;
 begin
   perform public.meallog_change_foods(foods,'remove',99,null);
   raise exception 'expected invalid index failure';
 exception when others then if sqlerrm<>'invalid food index' then raise; end if; end;
 assert public.meallog_change_foods('[{"name":"영양 미상","grams":30,"nutritionStatus":"unknown","calories":null},{"name":"제외 대상","grams":10}]','remove',1,null)='[{"name":"영양 미상","grams":30,"nutritionStatus":"unknown","calories":null}]'::jsonb,'unknown nutrition altered';
end $$;
