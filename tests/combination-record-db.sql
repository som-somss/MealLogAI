-- Run inside a transaction as authenticated with a test subject and its reset
-- generation header set by the caller. Always ROLLBACK the enclosing transaction.
do $test$
declare
 actor uuid:=auth.uid(); cid uuid:=gen_random_uuid(); first_id uuid:=gen_random_uuid(); second_id uuid:=gen_random_uuid();
 custom_id uuid:=gen_random_uuid(); rejected_id uuid:=gen_random_uuid(); memory_id uuid:=gen_random_uuid();
 f jsonb:='[{"name":"검증용 DB밥","grams":400,"unit":"g","calories":520,"carbs":116,"protein":12,"fat":0},{"name":"검증용 DB계란","grams":100,"unit":"g","calories":196,"carbs":1.6,"protein":14,"fat":15}]';
 result jsonb; actual jsonb; original jsonb; stamp timestamptz:='2026-11-08 12:00:00+09';
begin
 if actor is null then raise exception 'test subject required'; end if;
 insert into public.meal_combinations(id,user_id,name,meal_type,foods,approved_at,revision,yield_servings,cooked_weight)
 values(cid,actor,'검증용 DB조합','점심',f,now(),0,2,800);
 result:=public.meallog_record_combination(first_id,cid,0,'2026-11-08',stamp,'점심','servings',.5,'[]');
 if result->>'meal_id'<>first_id::text then raise exception 'wrong record id'; end if;
 select foods into actual from public.meals where id=first_id;
 if (actual#>>'{0,grams}')::numeric<>100 or (actual#>>'{1,grams}')::numeric<>25 or (actual#>>'{1,calories}')::numeric<>49 then raise exception 'quarter serving calculation failed'; end if;
 original:=actual;
 result:=public.meallog_record_combination(first_id,cid,0,'2026-11-08',stamp,'점심','servings',.5,'[]');
 if result->>'already_saved'<>'true' or (select count(*) from public.meals where id=first_id)<>1 then raise exception 'duplicate retry'; end if;
 result:=public.meallog_record_combination(second_id,cid,0,'2026-11-08',stamp,'점심','weight',200,'[]');
 if (select foods from public.meals where id=second_id)<>original then raise exception 'cooked weight mismatch'; end if;
 result:=public.meallog_record_combination(custom_id,cid,0,'2026-11-08',stamp,'점심','whole',1,'[{"index":0,"excluded":true},{"index":1,"amount":50}]');
 select foods into actual from public.meals where id=custom_id;
 if jsonb_array_length(actual)<>1 or (actual#>>'{0,grams}')::numeric<>50 or (actual#>>'{0,calories}')::numeric<>98 then raise exception 'custom portion failed'; end if;
 if (select foods from public.meal_combinations where id=cid)<>f then raise exception 'recipe overwritten'; end if;
 begin perform public.meallog_record_combination(first_id,cid,0,'2026-11-08',stamp,'점심','whole',1,'[]');raise exception 'FAIL_reused_request';exception when others then if sqlerrm<>'request_reused' then raise;end if;end;
 begin perform public.meallog_record_combination(rejected_id,cid,0,'2026-11-08',stamp,'점심','whole',1,'[{"index":0,"excluded":true},{"index":1,"excluded":true}]');raise exception 'FAIL_empty';exception when others then if sqlerrm<>'empty_meal' then raise;end if;end;
 begin perform public.meallog_record_combination(rejected_id,cid,0,'2026-11-08',stamp,'점심','whole',1,'[{"index":0,"amount":"50"}]');raise exception 'FAIL_string';exception when others then if sqlerrm<>'invalid_overrides' then raise;end if;end;
 begin perform public.meallog_record_combination(rejected_id,cid,0,'2026-11-08',stamp,'점심','whole',1,'[{"index":0,"amount":50},{"index":0,"amount":20}]');raise exception 'FAIL_duplicate';exception when others then if sqlerrm<>'invalid_overrides' then raise;end if;end;
 begin perform public.meallog_record_combination(rejected_id,cid,0,'2026-11-09',stamp,'점심','whole',1,'[]');raise exception 'FAIL_date';exception when others then if sqlerrm<>'invalid_meal_date' then raise;end if;end;
 begin perform public.meallog_record_combination(rejected_id,gen_random_uuid(),0,'2026-11-08',stamp,'점심','whole',1,'[]');raise exception 'FAIL_foreign';exception when sqlstate '40001' then null;end;
 if exists(select 1 from public.meals where id=rejected_id) or exists(select 1 from public.meal_change_plans where id=rejected_id) then raise exception 'partial failed write'; end if;
 update public.meal_combinations set foods=jsonb_set(foods,'{0,grams}','401'),revision=1 where id=cid;
 if (select cooked_weight from public.meal_combinations where id=cid) is not null then raise exception 'stale cooked weight retained';end if;
 if (select yield_servings from public.meal_combinations where id=cid)<>2 or (select foods from public.meals where id=first_id)<>original then raise exception 'historical meal changed';end if;
 begin perform public.meallog_record_combination(rejected_id,cid,0,'2026-11-08',stamp,'점심','whole',1,'[]');raise exception 'FAIL_stale';exception when sqlstate '40001' then null;end;
 begin perform public.meallog_record_combination(rejected_id,cid,1,'2026-11-08',stamp,'점심','weight',200,'[]');raise exception 'FAIL_unknown_weight';exception when others then if sqlerrm<>'combination_basis_missing' then raise;end if;end;
 update public.meals set foods=jsonb_set(foods,'{0,grams}','90') where id=first_id;
 result:=public.meallog_record_combination(first_id,cid,0,'2026-11-08',stamp,'점심','servings',.5,'[]');
 if result->>'changed'<>'true' then raise exception 'changed saved meal not identified';end if;
 insert into public.food_memories(id,user_id,food,brand,portion_label,approved_at,revision) values(memory_id,actor,f->1,'','한 알',now(),0);
 update public.food_memories set food=jsonb_set(food,'{grams}','50'),revision=1 where id=memory_id and user_id=actor and revision=0;
 if (select (food->>'grams')::numeric from public.food_memories where id=memory_id)<>50 then raise exception 'portion persistence failed';end if;
 if exists(select 1 from public.food_memories where user_id<>actor) then raise exception 'memory RLS leak';end if;
 begin insert into public.food_memories(user_id,food,portion_label,approved_at) values(gen_random_uuid(),f->1,'한 알',now());raise exception 'FAIL_owner';exception when insufficient_privilege then null;end;
 update public.meal_combinations set foods='[{"name":"검증용 미입력","grams":100,"unit":"g","nutritionStatus":"unknown","calories":null,"carbs":null,"protein":null,"fat":null}]',revision=2 where id=cid;
 result:=public.meallog_record_combination(rejected_id,cid,2,'2026-11-08',stamp,'점심','whole',.5,'[]');
 select foods into actual from public.meals where id=rejected_id;
 if actual#>'{0,calories}'<>'null'::jsonb or (actual#>>'{0,grams}')::numeric<>50 then raise exception 'unknown nutrition lost';end if;
end $test$;
