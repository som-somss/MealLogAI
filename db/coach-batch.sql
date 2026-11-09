-- Operation indices refer to the ORIGINAL array. Removals never shift later
-- targets. Validate the final count so a full combination can remove and add.
create or replace function public.meallog_apply_food_batch(p_foods jsonb,p_operations jsonb,p_limit integer)
returns jsonb language plpgsql immutable security invoker set search_path=''
as $$
declare
 item jsonb; operation text; idx integer; i integer;
 before_food jsonb; after_food jsonb; working jsonb:=p_foods;
 additions jsonb:='[]'; next_foods jsonb:='[]'; changes jsonb:='[]';
 touched integer[]:='{}'; removed integer[]:='{}';
begin
 if jsonb_typeof(p_foods) is distinct from 'array' or jsonb_array_length(p_foods) not between 1 and 100
    or jsonb_typeof(p_operations) is distinct from 'array' or jsonb_array_length(p_operations) not between 1 and 10
    or p_limit is null or p_limit not between 1 and 100 then raise exception 'invalid batch'; end if;
 for item in select value from jsonb_array_elements(p_operations) loop
   operation:=item->>'operation'; idx:=null; before_food:=null; after_food:=null;
   if jsonb_typeof(item) is distinct from 'object' or operation is null or operation not in ('add','remove','replace','resize') then raise exception 'invalid batch operation'; end if;
   if operation<>'add' then
     if jsonb_typeof(item->'index') is distinct from 'number' or (item->>'index')!~'^[0-9]+$' then raise exception 'invalid food index'; end if;
     idx:=(item->>'index')::integer;
     if idx<0 or idx>=jsonb_array_length(p_foods) then raise exception 'invalid food index'; end if;
     if idx=any(touched) then raise exception 'duplicate food target'; end if;
     touched:=array_append(touched,idx); before_food:=p_foods->idx;
   end if;
   if operation in ('add','replace') then
     after_food:=public.meallog_change_foods(p_foods,'replace',0,item->'food')->0;
   elsif operation='resize' then
     after_food:=public.meallog_resize_foods(p_foods,idx,(item->>'amount')::numeric)->idx;
   end if;
   if operation='add' then additions:=additions||jsonb_build_array(after_food);
   elsif operation='remove' then removed:=array_append(removed,idx);
   else working:=jsonb_set(working,array[idx::text],after_food,false); end if;
   changes:=changes||jsonb_build_array(jsonb_build_object('operation',operation,'index',idx,'before_food',before_food,'after_food',after_food));
 end loop;
 for i in 0..jsonb_array_length(p_foods)-1 loop
   if not i=any(removed) then next_foods:=next_foods||jsonb_build_array(working->i); end if;
 end loop;
 next_foods:=next_foods||additions;
 if jsonb_array_length(next_foods) not between 1 and p_limit then raise exception 'invalid final food count'; end if;
 return jsonb_build_object('foods',next_foods,'changes',changes);
end $$;
revoke all on function public.meallog_apply_food_batch(jsonb,jsonb,integer) from public,anon;
grant execute on function public.meallog_apply_food_batch(jsonb,jsonb,integer) to authenticated;

create or replace function public.meallog_coach_batch_edit(p_conversation uuid,p_request uuid,p_question text,p_edit jsonb)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare
 actor uuid:=auth.uid(); prior record; cid uuid;
 meal public.meals%rowtype; combo public.meal_combinations%rowtype;
 m jsonb:=nullif(p_edit->'meal','null'::jsonb); c jsonb:=nullif(p_edit->'combination','null'::jsonb);
 meal_plan jsonb; combo_plan jsonb; computed jsonb; change jsonb;
 result jsonb; outcome text:='unchanged'; conflict boolean:=false; affected integer;
 target text; target_name text; reply text:=''; description text; before_text text; after_text text;
 changes jsonb:='[]';
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
   else meal_plan:=public.meallog_apply_food_batch(meal.foods,m->'operations',100); end if;
 end if;
 if c is not null then
   select * into combo from public.meal_combinations where id=(c->>'id')::uuid and user_id=actor for update;
   if not found or combo.foods is distinct from c->'expected' or combo.revision is distinct from (c->>'revision')::integer or combo.approved_at is null then conflict:=true;
   else combo_plan:=public.meallog_apply_food_batch(combo.foods,c->'operations',8); end if;
 end if;
 if conflict then
   outcome:='conflict';
   reply:='확인하는 동안 식사나 조합이 바뀌었거나 접근할 수 없어요. 이번 요청의 변경은 어느 쪽에도 저장하지 않았어요. 최신 기록에서 전체 요청을 다시 보내 주세요.';
 else
   if m is not null and meal.foods is distinct from meal_plan->'foods' then
     update public.meals set foods=meal_plan->'foods' where id=meal.id and user_id=actor and foods=meal.foods;
     get diagnostics affected=row_count; if affected<>1 then raise exception 'meal changed'; end if;
     outcome:='updated';
   end if;
   if c is not null and combo.foods is distinct from combo_plan->'foods' then
     update public.meal_combinations set foods=combo_plan->'foods',revision=combo.revision+1 where id=combo.id and user_id=actor and revision=combo.revision and foods=combo.foods;
     get diagnostics affected=row_count; if affected<>1 then raise exception 'combination changed'; end if;
     outcome:='updated';
   end if;
   foreach target in array array['meal','combination'] loop
     computed:=case when target='meal' then meal_plan else combo_plan end;
     if computed is null then continue; end if;
     target_name:=case when target='meal' then meal.meal_date::text||' '||meal.meal_type||' 기록' else '저장 조합 “'||combo.name||'”' end;
     reply:=reply||case when reply<>'' then E'\n\n' else '' end||target_name;
     for change in select value from jsonb_array_elements(computed->'changes') loop
       before_text:=(change#>>'{before_food,name}')||' '||(change#>>'{before_food,grams}')||coalesce(change#>>'{before_food,unit}','g');
       after_text:=(change#>>'{after_food,name}')||' '||(change#>>'{after_food,grams}')||coalesce(change#>>'{after_food,unit}','g');
       description:=case change->>'operation' when 'add' then after_text||' 추가' when 'remove' then before_text||' 제외' else before_text||' → '||after_text end;
       reply:=reply||E'\n• '||description;
       changes:=changes||jsonb_build_array(change||jsonb_build_object('target',target,'name',target_name));
     end loop;
   end loop;
   reply:=case when outcome='updated' then '요청한 여러 변경을 한 번에 저장했어요.' else '이미 요청한 음식과 양으로 저장되어 있어요.' end||E'\n\n'||reply||E'\n\n추가·교체한 음식은 앱 음식 자료, 양 수정은 기존 영양값을 기준으로 반영했어요. 나머지 음식과 메모는 그대로예요.';
   if m is not null and c is null then reply:=reply||E'\n식사 기록만 반영했어요. 저장 조합은 변경하지 않았어요.'; end if;
   if c is not null and m is null then reply:=reply||E'\n저장 조합만 반영했어요. 식사 기록은 변경하지 않았어요.'; end if;
 end if;
 result:=jsonb_build_object('reply',reply,'mode','여러 음식 수정','warnings','[]'::jsonb,'suggestions','[]'::jsonb,'evidence',jsonb_build_array(case when conflict then '기록 변경 충돌을 확인해 이번 요청은 저장하지 않았어요.' else '모든 항목의 대상과 최종 저장 결과를 확인했어요.' end),'record_edit',jsonb_build_object('status',outcome,'operation','batch','meal_id',meal.id,'combination_id',combo.id,'changes',changes),'edit_pending',null,'conversation_context',jsonb_build_object('version',1,'kind','general'));
 cid:=public.meallog_coach_save(p_conversation,p_request,p_question,reply,result);
 return result||jsonb_build_object('ok',true,'conversation_id',cid);
end $$;
revoke all on function public.meallog_coach_batch_edit(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.meallog_coach_batch_edit(uuid,uuid,text,jsonb) to authenticated;
