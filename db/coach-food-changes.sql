-- Append one validated food or remove one identified item. Never accept a
-- replacement array: all other foods and their metadata come from the locked row.
create or replace function public.meallog_change_foods(p_foods jsonb,p_operation text,p_index integer,p_food jsonb)
returns jsonb language plpgsql immutable security invoker set search_path=''
as $$
declare nutrient text;
begin
 if jsonb_typeof(p_foods) is distinct from 'array' or jsonb_array_length(p_foods) not between 1 and 100 then raise exception 'invalid source foods'; end if;
 if p_operation='remove' then
   if p_index is null or p_index<0 or p_index>=jsonb_array_length(p_foods) then raise exception 'invalid food index'; end if;
   if jsonb_array_length(p_foods)<=1 then raise exception 'cannot remove last food'; end if;
   return p_foods-p_index;
 elsif p_operation='add' then
   if jsonb_array_length(p_foods)>=100 then raise exception 'too many foods'; end if;
   if jsonb_typeof(p_food) is distinct from 'object' or pg_column_size(p_food)>4096
      or jsonb_typeof(p_food->'name') is distinct from 'string' or length(btrim(p_food->>'name')) not between 1 and 200
      or jsonb_typeof(p_food->'grams') is distinct from 'number' or (p_food->>'grams')::numeric not between 0.001 and 100000
      or coalesce(p_food->>'unit','') not in ('g','mL','개','인분')
      or exists(select 1 from jsonb_object_keys(p_food) as t(key) where key not in ('name','grams','unit','calories','carbs','protein','fat','manualBrand'))
      or (p_food ? 'manualBrand' and (jsonb_typeof(p_food->'manualBrand') is distinct from 'string' or length(p_food->>'manualBrand')>200)) then raise exception 'invalid added food'; end if;
   foreach nutrient in array array['calories','carbs','protein','fat'] loop
     if jsonb_typeof(p_food->nutrient) is distinct from 'number' or (p_food->>nutrient)::numeric not between 0 and 1000000 then raise exception 'invalid added nutrition'; end if;
   end loop;
   return p_foods||jsonb_build_array(p_food);
 else raise exception 'invalid food operation'; end if;
end $$;
revoke all on function public.meallog_change_foods(jsonb,text,integer,jsonb) from public,anon;
grant execute on function public.meallog_change_foods(jsonb,text,integer,jsonb) to authenticated;

create or replace function public.meallog_coach_change_foods(p_conversation uuid,p_request uuid,p_question text,p_edit jsonb)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare
 actor uuid:=auth.uid(); prior record; cid uuid;
 meal public.meals%rowtype; combo public.meal_combinations%rowtype;
 m jsonb:=nullif(p_edit->'meal','null'::jsonb); c jsonb:=nullif(p_edit->'combination','null'::jsonb);
 operation text:=p_edit->>'operation'; added jsonb:=p_edit->'food';
 meal_next jsonb; combo_next jsonb; mi integer; ci integer; changed_food jsonb;
 reply text:=''; result jsonb; outcome text:='updated'; conflict boolean:=false;
 changes jsonb:='[]'; affected integer;
begin
 if actor is null or p_request is null or p_question is null or length(btrim(p_question)) not between 1 and 1500
    or jsonb_typeof(p_edit) is distinct from 'object' or (m is null and c is null)
    or operation is null or operation not in ('add','remove') then raise exception 'invalid edit request'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_request::text,0));
 select conversation_id,content,metadata into prior from public.ai_coach_messages
   where user_id=actor and request_id=p_request and role='assistant';
 if found then return prior.metadata||jsonb_build_object('ok',true,'conversation_id',prior.conversation_id,'reply',prior.content); end if;
 if p_conversation is not null and not exists(select 1 from public.ai_coach_conversations where id=p_conversation and user_id=actor) then raise exception 'conversation unavailable'; end if;
 if m is not null then
   select * into meal from public.meals where id=(m->>'id')::uuid and user_id=actor for update;
   if not found or meal.foods is distinct from m->'expected' then conflict:=true;
   else mi:=(m->>'index')::integer; meal_next:=public.meallog_change_foods(meal.foods,operation,mi,added); end if;
 end if;
 if c is not null then
   select * into combo from public.meal_combinations where id=(c->>'id')::uuid and user_id=actor for update;
   if not found or combo.foods is distinct from c->'expected' or combo.revision is distinct from (c->>'revision')::integer or combo.approved_at is null then conflict:=true;
   else ci:=(c->>'index')::integer; combo_next:=public.meallog_change_foods(combo.foods,operation,ci,added); end if;
 end if;
 if conflict then
   outcome:='conflict';
   reply:='확인하는 동안 기록이나 조합이 바뀌었거나 더 이상 접근할 수 없어요. 어느 쪽도 수정하지 않았어요. 최신 기록을 확인하고 같은 요청을 다시 보내 주세요.';
 else
   if m is not null then
     update public.meals set foods=meal_next where id=meal.id and user_id=actor and foods=meal.foods;
     get diagnostics affected=row_count;
     if affected<>1 then raise exception 'meal changed'; end if;
     changed_food:=case when operation='add' then added else meal.foods->mi end;
     changes:=changes||jsonb_build_array(jsonb_build_object('target','meal','name',meal.meal_date::text||' '||meal.meal_type,'operation',operation,'food',changed_food->>'name','before',case when operation='add' then '0'::jsonb else changed_food->'grams' end,'after',case when operation='add' then changed_food->'grams' else '0'::jsonb end,'unit',coalesce(changed_food->>'unit','g')));
     reply:=meal.meal_date::text||' '||meal.meal_type||' 기록 · '||(changed_food->>'name')||' '||(changed_food->>'grams')||coalesce(changed_food->>'unit','g')||case when operation='add' then ' 추가' else ' 제외' end;
   end if;
   if c is not null then
     update public.meal_combinations set foods=combo_next,revision=combo.revision+1 where id=combo.id and user_id=actor and revision=combo.revision and foods=combo.foods;
     get diagnostics affected=row_count;
     if affected<>1 then raise exception 'combination changed'; end if;
     changed_food:=case when operation='add' then added else combo.foods->ci end;
     changes:=changes||jsonb_build_array(jsonb_build_object('target','combination','name',combo.name,'operation',operation,'food',changed_food->>'name','before',case when operation='add' then '0'::jsonb else changed_food->'grams' end,'after',case when operation='add' then changed_food->'grams' else '0'::jsonb end,'unit',coalesce(changed_food->>'unit','g')));
     reply:=reply||case when reply<>'' then E'\n' else '' end||'저장 조합 “'||combo.name||'” · '||(changed_food->>'name')||' '||(changed_food->>'grams')||coalesce(changed_food->>'unit','g')||case when operation='add' then ' 추가' else ' 제외' end;
   end if;
   reply:='실제 저장된 음식 구성을 수정했어요.'||E'\n'||reply||case when operation='add' then E'\n요청한 양을 새 음식 항목으로 추가했어요. 추가 음식의 영양값은 앱 음식 자료 기준이에요.' else E'\n지정한 음식 항목과 그 영양값을 합계에서 제외했어요.' end||E'\n다른 음식과 메모는 그대로예요.';
   if m is not null and c is null then reply:=reply||E'\n이번 요청에서는 식사 기록만 반영했어요. 저장 조합은 변경하지 않았어요.'; end if;
   if c is not null and m is null then reply:=reply||E'\n이번 요청에서는 저장 조합만 반영했어요. 식사 기록은 변경하지 않았어요.'; end if;
 end if;
 result:=jsonb_build_object('reply',reply,'mode',case when operation='add' then '음식 추가' else '음식 빼기' end,'warnings','[]'::jsonb,'suggestions','[]'::jsonb,'evidence',jsonb_build_array('본인의 저장된 식사·조합과 수정 전 상태를 확인했어요.'),'record_edit',jsonb_build_object('status',outcome,'operation',operation,'meal_id',meal.id,'combination_id',combo.id,'changes',changes),'edit_pending',null,'conversation_context',jsonb_build_object('version',1,'kind','general'));
 cid:=public.meallog_coach_save(p_conversation,p_request,p_question,reply,result);
 return result||jsonb_build_object('ok',true,'conversation_id',cid);
end $$;
revoke all on function public.meallog_coach_change_foods(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.meallog_coach_change_foods(uuid,uuid,text,jsonb) to authenticated;
