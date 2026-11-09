-- Run as authenticated inside a transaction; the runner always rolls back.
do $$
declare
 mid uuid; cid uuid; request_key uuid:=gen_random_uuid(); saved jsonb; replay jsonb;
 foods jsonb:='[{"name":"검증 밥","grams":200,"unit":"g","calories":260,"carbs":56,"protein":5,"fat":1},{"name":"계란후라이","grams":50,"unit":"g","calories":98,"carbs":0.4,"protein":6.8,"fat":7.5}]';
 replacement jsonb:='{"name":"오이","grams":100,"unit":"g","calories":15,"carbs":3.6,"protein":0.7,"fat":0.1,"manualBrand":""}';
 edit jsonb; next_foods jsonb; original_headers text;
begin
 insert into public.meals(user_id,meal_date,meal_type,meal_time,foods,memo)
 values(auth.uid(),'2000-01-05','점심','2000-01-05T12:00:00+09:00',foods,'preserve replacement memo') returning id into mid;
 insert into public.meal_combinations(user_id,name,meal_type,foods,approved_at)
 values(auth.uid(),'__coach_replace_'||gen_random_uuid()::text,'점심',jsonb_build_array(foods->1,foods->0),now()) returning id into cid;
 edit:=jsonb_build_object('operation','replace','food',replacement,'meal',jsonb_build_object('id',mid,'expected',foods,'index',1),'combination',jsonb_build_object('id',cid,'expected',jsonb_build_array(foods->1,foods->0),'revision',0,'index',0));
 saved:=public.meallog_coach_change_foods(null,request_key,'음식 교체 테스트',edit);
 assert saved#>>'{record_edit,status}'='updated','replace not applied';
 assert saved#>>'{record_edit,operation}'='replace','wrong operation';
 next_foods:=jsonb_set(foods,'{1}',replacement,false);
 assert (select m.foods from public.meals m where id=mid)=next_foods,'meal replacement or order incorrect';
 assert (select c.foods from public.meal_combinations c where id=cid)=jsonb_build_array(replacement,foods->0),'combo replacement or order incorrect';
 assert saved#>>'{record_edit,changes,0,before_food,name}'='계란후라이','old food absent from receipt';
 assert saved#>>'{record_edit,changes,0,after_food,name}'='오이','new food absent from receipt';
 assert (select sum((f->>'calories')::numeric) from public.meals m,jsonb_array_elements(m.foods) f where m.id=mid)=275,'new nutrition not used';
 assert (select memo from public.meals where id=mid)='preserve replacement memo','memo changed';
 assert (select revision from public.meal_combinations where id=cid)=1,'revision missing';
 assert (select count(*) from public.ai_coach_messages where user_id=auth.uid() and request_id=request_key)=2,'receipt missing';
 replay:=public.meallog_coach_change_foods(null,request_key,'음식 교체 테스트',edit);
 assert replay=saved,'retry changed response';
 assert (select revision from public.meal_combinations where id=cid)=1,'retry changed revision';

 edit:=jsonb_set(jsonb_set(jsonb_set(edit,'{meal,expected}',next_foods),'{combination,expected}',jsonb_build_array(replacement,foods->0)),'{combination,revision}','1');
 saved:=public.meallog_coach_change_foods(null,gen_random_uuid(),'같은 음식과 양',edit);
 assert saved#>>'{record_edit,status}'='unchanged','identical replacement not a no-op';
 assert (select revision from public.meal_combinations where id=cid)=1,'no-op changed revision';

 saved:=public.meallog_coach_change_foods(null,gen_random_uuid(),'오래된 조합 상태',jsonb_set(jsonb_set(edit,'{food}',foods->1),'{combination,revision}','0'));
 assert saved#>>'{record_edit,status}'='conflict','stale combo accepted';
 assert (select m.foods from public.meals m where id=mid)=next_foods,'partial replacement on conflict';
 saved:=public.meallog_coach_change_foods(null,gen_random_uuid(),'없는 조합',jsonb_set(edit,'{combination,id}',to_jsonb(gen_random_uuid())));
 assert saved#>>'{record_edit,status}'='conflict','unavailable combo accepted';
 begin
   perform public.meallog_coach_change_foods(gen_random_uuid(),gen_random_uuid(),'없는 대화',edit);
   raise exception 'expected ownership failure';
 exception when others then if sqlerrm<>'conversation unavailable' then raise; end if; end;
 begin
   perform public.meallog_coach_change_foods(null,gen_random_uuid(),'잘못된 두번째 교체 항목',jsonb_set(jsonb_set(edit,'{food}',foods->1),'{combination,index}','99'));
   raise exception 'expected index failure';
 exception when others then if sqlerrm<>'invalid food index' then raise; end if; end;
 assert (select m.foods from public.meals m where id=mid)=next_foods,'invalid second index partly changed meal';

 original_headers:=current_setting('request.headers',true);
 if public.ml_record_reset_state()->>'generation' is not null then
   perform set_config('request.headers','{}',true);
   begin
     perform public.meallog_coach_change_foods(null,gen_random_uuid(),'초기화 보호',jsonb_set(edit,'{food}',foods->1));
     raise exception 'expected generation failure';
   exception when others then if sqlerrm<>'record_reset_reload_required' then raise; end if; end;
   perform set_config('request.headers',original_headers,true);
 end if;
 assert public.meallog_change_foods(jsonb_build_array(foods->1),'replace',0,replacement)=jsonb_build_array(replacement),'single food replacement failed';
 assert public.meallog_change_foods('[{"name":"영양 미상","grams":30,"nutritionStatus":"unknown","calories":null},{"name":"교체 대상","grams":10}]','replace',1,replacement)->0='{"name":"영양 미상","grams":30,"nutritionStatus":"unknown","calories":null}'::jsonb,'other nutrition invented';
 begin
   perform public.meallog_change_foods(foods,'replace',1,jsonb_set(replacement,'{calories}','null'));
   raise exception 'expected nutrition failure';
 exception when others then if sqlerrm<>'invalid added nutrition' then raise; end if; end;
 -- A full saved combination can be replaced in-place without add/remove steps.
 update public.meal_combinations set foods=(select jsonb_agg(next_foods->0) from generate_series(1,8)),revision=2 where id=cid;
 select jsonb_build_object('operation','replace','food',replacement,'combination',jsonb_build_object('id',cid,'expected',c.foods,'revision',2,'index',7)) into edit from public.meal_combinations c where id=cid;
 saved:=public.meallog_coach_change_foods(null,gen_random_uuid(),'가득 찬 조합 교체',edit);
 assert saved#>>'{record_edit,status}'='updated','full combo failed';
 assert (select jsonb_array_length(c.foods) from public.meal_combinations c where id=cid)=8,'replacement changed count';
 assert (select c.foods->7 from public.meal_combinations c where id=cid)=replacement,'last index replacement failed';
end $$;
