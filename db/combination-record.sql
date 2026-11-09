-- Keep original recipes and historical meal snapshots independent.
alter table public.meal_combinations
 add column yield_servings numeric check(yield_servings>0 and yield_servings<=1000),
 add column cooked_weight numeric check(cooked_weight>0 and cooked_weight<=100000);
comment on column public.meal_combinations.yield_servings is 'Confirmed servings for the entire stored ingredient list; null means unknown.';
comment on column public.meal_combinations.cooked_weight is 'Confirmed final cooked batch weight in grams, never inferred from ingredient weights.';

create function ml_food_private.invalidate_combination_weight() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.foods is distinct from old.foods then new.cooked_weight:=null; end if;
 return new;
end $$;
create trigger combination_weight_changed before update on public.meal_combinations
 for each row execute function ml_food_private.invalidate_combination_weight();
create trigger food_memory_generation before insert or update on public.food_memories
 for each row execute function public.ml_record_generation_guard();

create function public.meallog_record_combination(
 p_request uuid,p_combination uuid,p_revision integer,p_day date,p_time timestamptz,
 p_type text,p_mode text,p_quantity numeric,p_overrides jsonb default '[]'::jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 actor uuid:=auth.uid(); combo public.meal_combinations; previous public.meal_change_plans;
 payload jsonb; next_row jsonb; response jsonb; current_foods jsonb;
 denominator numeric:=1; ratio numeric; f jsonb; item jsonb; out_food jsonb;
 result_foods jsonb:='[]'; indexes integer[]:='{}'; idx integer; pos integer:=0; amount numeric; v numeric; k text;
begin
 if actor is null or p_request is null or p_combination is null then raise exception 'invalid_owner'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,6136));
 payload:=jsonb_build_object('combination',p_combination,'revision',p_revision,'day',p_day,'time',p_time,'type',p_type,'mode',p_mode,'quantity',p_quantity,'overrides',p_overrides);
 select * into previous from public.meal_change_plans where id=p_request and user_id=actor for update;
 if found then
  if previous.next_row->'_combination_request' is distinct from payload or previous.applied_at is null then raise exception 'request_reused'; end if;
  select foods into current_foods from public.meals where id=previous.meal_id and user_id=actor;
  if not found then raise exception 'recorded_meal_unavailable'; end if;
  return previous.result||jsonb_build_object('already_saved',true,'changed',current_foods is distinct from previous.next_row->'foods');
 end if;
 if p_day is null or p_day not between date '1900-01-01' and date '2200-12-31' or p_time is null
  or (p_time at time zone 'Asia/Seoul')::date<>p_day or p_type is null or p_type not in ('아침','점심','저녁','간식') then raise exception 'invalid_meal_date'; end if;
 if p_quantity is null or not(p_quantity>0 and p_quantity<=100000) or p_mode is null or p_mode not in ('whole','servings','weight') then raise exception 'invalid_quantity'; end if;
 select * into combo from public.meal_combinations where id=p_combination and user_id=actor and approved_at is not null for share;
 if not found or combo.revision is distinct from p_revision then raise exception 'combination_changed' using errcode='40001'; end if;
 if p_mode='servings' then denominator:=combo.yield_servings;
 elsif p_mode='weight' then denominator:=combo.cooked_weight; end if;
 if denominator is null or denominator<=0 then raise exception 'combination_basis_missing'; end if;
 ratio:=p_quantity/denominator;
 if ratio>100 then raise exception 'invalid_quantity'; end if;
 if jsonb_typeof(p_overrides) is distinct from 'array' or jsonb_array_length(p_overrides)>8 then raise exception 'invalid_overrides'; end if;
 for item in select value from jsonb_array_elements(p_overrides) loop
  if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'index') is distinct from 'number'
   or (item->>'index')::numeric<>trunc((item->>'index')::numeric)
   or exists(select 1 from jsonb_object_keys(item) t(key) where key not in ('index','amount','excluded')) then raise exception 'invalid_overrides'; end if;
  idx:=(item->>'index')::integer;
  if idx<0 or idx>=jsonb_array_length(combo.foods) or idx=any(indexes) then raise exception 'invalid_overrides'; end if;
  indexes:=array_append(indexes,idx);
  if item ? 'excluded' and jsonb_typeof(item->'excluded') is distinct from 'boolean' then raise exception 'invalid_overrides'; end if;
  if coalesce((item->>'excluded')::boolean,false) is not true and (jsonb_typeof(item->'amount') is distinct from 'number' or not((item->>'amount')::numeric between .001 and 100000)) then raise exception 'invalid_overrides'; end if;
 end loop;
 for f in select value from jsonb_array_elements(combo.foods) loop
  item:=null;select value into item from jsonb_array_elements(p_overrides) where (value->>'index')::integer=pos;
  pos:=pos+1;if coalesce((item->>'excluded')::boolean,false) then continue;end if;
  amount:=round(case when item is not null then (item->>'amount')::numeric else (f->>'grams')::numeric*ratio end,4);
  if amount not between .001 and 100000 then raise exception 'invalid_quantity';end if;
  out_food:=jsonb_set(f,'{grams}',to_jsonb(amount));
  foreach k in array array['calories','carbs','protein','fat'] loop
   if f->>'nutritionStatus'='unknown' then out_food:=jsonb_set(out_food,array[k],'null'::jsonb);
   else
    v:=round((f->>k)::numeric*amount/(f->>'grams')::numeric,4);
    if v not between 0 and 1000000 then raise exception 'invalid_nutrition';end if;
    out_food:=jsonb_set(out_food,array[k],to_jsonb(v));
   end if;
  end loop;
  result_foods:=result_foods||jsonb_build_array(out_food);
 end loop;
 if jsonb_array_length(result_foods)=0 then raise exception 'empty_meal'; end if;
 next_row:=jsonb_build_object('meal_date',p_day,'meal_time',p_time,'meal_type',p_type,'foods',result_foods,
  'memo','내 조합: '||combo.name||' · 전체의 '||round(ratio*100,2)||'% · 변경한 재료는 개별 양 적용',
  '_combination_request',payload,'_combination_basis',jsonb_build_object('name',combo.name,'revision',combo.revision,'denominator',denominator,'ratio',ratio));
 insert into public.meal_change_plans(id,user_id,meal_id,expected,next_row) values(p_request,actor,p_request,null,next_row);
 response:=public.meal_apply_plan(p_request,true);
 return response||jsonb_build_object('already_saved',false,'changed',false);
end $$;
revoke all on function public.meallog_record_combination(uuid,uuid,integer,date,timestamptz,text,text,numeric,jsonb) from public,anon;
grant execute on function public.meallog_record_combination(uuid,uuid,integer,date,timestamptz,text,text,numeric,jsonb) to authenticated;
