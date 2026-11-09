-- No client/model-generated nutrients are accepted. Recalculate from the
-- locked, owned source row, with optimistic snapshots and atomic chat receipt.
create or replace function public.meallog_resize_foods(p_foods jsonb,p_index integer,p_amount numeric)
returns jsonb language plpgsql immutable security invoker set search_path=''
as $$
declare food jsonb; changed jsonb; nutrient text; original numeric;
begin
 if jsonb_typeof(p_foods) is distinct from 'array' or p_index is null
   or p_index<0 or p_index>=jsonb_array_length(p_foods)
   or p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity')
   or p_amount not between 0.001 and 100000 then raise exception 'invalid amount'; end if;
 food:=p_foods->p_index;
 if jsonb_typeof(food->'grams') is distinct from 'number' then raise exception 'invalid source amount'; end if;
 original:=(food->>'grams')::numeric;
 if original<=0 then raise exception 'invalid source amount'; end if;
 if p_amount=original then return p_foods; end if;
 changed:=food||jsonb_build_object('grams',p_amount);
 foreach nutrient in array array['calories','carbs','protein','fat'] loop
   if food->>'nutritionStatus'='unknown' or food->nutrient is null or food->nutrient='null'::jsonb then
     changed:=changed||jsonb_build_object(nutrient,null);
   elsif jsonb_typeof(food->nutrient)='number' and (food->>nutrient)::numeric>=0 then
     changed:=changed||jsonb_build_object(nutrient,round((food->>nutrient)::numeric*p_amount/original,4));
   else raise exception 'invalid source nutrition'; end if;
 end loop;
 return jsonb_set(p_foods,array[p_index::text],changed,false);
end $$;
revoke all on function public.meallog_resize_foods(jsonb,integer,numeric) from public,anon;
grant execute on function public.meallog_resize_foods(jsonb,integer,numeric) to authenticated;

create or replace function public.meallog_coach_resize(p_conversation uuid,p_request uuid,p_question text,p_edit jsonb)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare
 actor uuid:=auth.uid(); prior record; cid uuid;
 meal public.meals%rowtype; combo public.meal_combinations%rowtype;
 m jsonb:=nullif(p_edit->'meal','null'::jsonb); c jsonb:=nullif(p_edit->'combination','null'::jsonb);
 meal_next jsonb; combo_next jsonb; mi integer; ci integer;
 reply text:=''; result jsonb; outcome text:='unchanged'; conflict boolean:=false;
 changes jsonb:='[]'; affected integer;
begin
 if actor is null or p_request is null or p_question is null or length(btrim(p_question)) not between 1 and 1500
    or jsonb_typeof(p_edit) is distinct from 'object' or (m is null and c is null) then raise exception 'invalid edit request'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_request::text,0));
 select conversation_id,content,metadata into prior from public.ai_coach_messages
   where user_id=actor and request_id=p_request and role='assistant';
 if found then return prior.metadata||jsonb_build_object('ok',true,'conversation_id',prior.conversation_id,'reply',prior.content); end if;
 if p_conversation is not null and not exists(select 1 from public.ai_coach_conversations where id=p_conversation and user_id=actor) then raise exception 'conversation unavailable'; end if;

 if m is not null then
   select * into meal from public.meals where id=(m->>'id')::uuid and user_id=actor for update;
   if not found or meal.foods is distinct from m->'expected' then conflict:=true;
   else mi:=(m->>'index')::integer; meal_next:=public.meallog_resize_foods(meal.foods,mi,(m->>'amount')::numeric); end if;
 end if;
 if c is not null then
   select * into combo from public.meal_combinations where id=(c->>'id')::uuid and user_id=actor for update;
   if not found or combo.foods is distinct from c->'expected' or combo.revision is distinct from (c->>'revision')::integer or combo.approved_at is null then conflict:=true;
   else ci:=(c->>'index')::integer; combo_next:=public.meallog_resize_foods(combo.foods,ci,(c->>'amount')::numeric); end if;
 end if;
 if conflict then
   outcome:='conflict';
   reply:='확인하는 동안 기록이나 조합이 바뀌었거나 더 이상 접근할 수 없어요. 어느 쪽도 수정하지 않았어요. 최신 기록을 확인하고 같은 요청을 다시 보내 주세요.';
 else
   if m is not null then
     if meal_next is distinct from meal.foods then
       update public.meals set foods=meal_next where id=meal.id and user_id=actor and foods=meal.foods;
       get diagnostics affected=row_count;
       if affected<>1 then raise exception 'meal changed'; end if;
       outcome:='updated';
     end if;
     changes:=changes||jsonb_build_array(jsonb_build_object('target','meal','name',meal.meal_date::text||' '||meal.meal_type,'food',meal.foods->mi->>'name','before',meal.foods->mi->'grams','after',meal_next->mi->'grams','unit',coalesce(meal.foods->mi->>'unit','g')));
     reply:=meal.meal_date::text||' '||meal.meal_type||' 기록 · '||(meal.foods->mi->>'name')||' '||(meal.foods->mi->>'grams')||' → '||(meal_next->mi->>'grams')||coalesce(meal.foods->mi->>'unit','g');
   end if;
   if c is not null then
     if combo_next is distinct from combo.foods then
       update public.meal_combinations set foods=combo_next,revision=combo.revision+1 where id=combo.id and user_id=actor and revision=combo.revision and foods=combo.foods;
       get diagnostics affected=row_count;
       if affected<>1 then raise exception 'combination changed'; end if;
       outcome:='updated';
     end if;
     changes:=changes||jsonb_build_array(jsonb_build_object('target','combination','name',combo.name,'food',combo.foods->ci->>'name','before',combo.foods->ci->'grams','after',combo_next->ci->'grams','unit',coalesce(combo.foods->ci->>'unit','g')));
     reply:=reply||case when reply<>'' then E'\n' else '' end||'저장 조합 “'||combo.name||'” · '||(combo.foods->ci->>'name')||' '||(combo.foods->ci->>'grams')||' → '||(combo_next->ci->>'grams')||coalesce(combo.foods->ci->>'unit','g');
   end if;
   reply:=case when outcome='updated' then '실제 저장된 음식 양을 수정했어요.' else '이미 요청한 양으로 저장되어 있어요.' end||E'\n'||reply||E'\n영양값은 각 기록의 기존 값에 맞춰 비례 계산했어요. 다른 음식의 양은 그대로예요.';
   if m is not null and c is null then reply:=reply||E'\n이번 요청에서는 식사 기록만 반영했어요. 저장 조합은 변경하지 않았어요.'; end if;
   if c is not null and m is null then reply:=reply||E'\n이번 요청에서는 저장 조합만 반영했어요. 식사 기록은 변경하지 않았어요.'; end if;
 end if;
 result:=jsonb_build_object('reply',reply,'mode','음식 양 수정','warnings','[]'::jsonb,'suggestions','[]'::jsonb,'evidence',jsonb_build_array('본인의 저장된 식사·조합과 수정 전 상태를 확인했어요.'),'record_edit',jsonb_build_object('status',outcome,'meal_id',meal.id,'combination_id',combo.id,'changes',changes),'edit_pending',null,'conversation_context',jsonb_build_object('version',1,'kind','general'));
 cid:=public.meallog_coach_save(p_conversation,p_request,p_question,reply,result);
 return result||jsonb_build_object('ok',true,'conversation_id',cid);
end $$;
revoke all on function public.meallog_coach_resize(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.meallog_coach_resize(uuid,uuid,text,jsonb) to authenticated;
