-- Applied through Supabase as coach_remember_recorded_meal. No existing rows
-- or policies are modified. Calls use the signed-in user's RLS permissions.
create or replace function public.meallog_coach_remember(
  p_conversation uuid, p_request uuid, p_question text,
  p_day date, p_meal_type text, p_name text, p_latest boolean default false
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  cid uuid;
  prior record;
  source_ids uuid[];
  source_foods jsonb;
  source_type text;
  combo public.meal_combinations%rowtype;
  result jsonb;
  reply text;
  outcome text := 'needs_details';
  saved_name text := btrim(p_name);
begin
  if actor is null or p_request is null or p_question is null
     or length(btrim(p_question)) not between 1 and 1500
     or p_day is null or p_day < date '2000-01-01'
     or p_day > (now() at time zone 'Asia/Seoul')::date
     or saved_name is null or length(saved_name) not between 1 and 80
     or (p_meal_type is not null and p_meal_type not in ('아침','점심','저녁','간식'))
     or (p_meal_type is null and p_latest is not true) then
    raise exception 'invalid memory request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(actor::text || p_request::text, 0));
  select conversation_id, content, metadata into prior
    from public.ai_coach_messages
    where user_id = actor and request_id = p_request and role = 'assistant';
  if found then
    return prior.metadata || jsonb_build_object('ok',true,'conversation_id',prior.conversation_id,'reply',prior.content);
  end if;
  if p_conversation is not null and not exists (
    select 1 from public.ai_coach_conversations where id = p_conversation and user_id = actor
  ) then raise exception 'conversation unavailable'; end if;

  -- The database obtains ingredients from owned records, never caller/model JSON.
  select array_agg(id order by created_at, id) into source_ids from (
    select id, created_at from public.meals
    where user_id = actor and meal_date = p_day
      and (p_meal_type is null or meal_type = p_meal_type)
    order by created_at desc, id desc
    limit case when p_latest then 1 else null end
  ) sources;
  if source_ids is null then
    reply := p_day::text || ' ' || coalesce(p_meal_type,'') || ' 식사 기록을 찾지 못해 저장하지 않았어요. 날짜와 끼니를 확인해 주세요.';
  else
    select meal_type into source_type from public.meals where user_id = actor and id = source_ids[1];
    if exists (select 1 from public.meals where user_id = actor and id = any(source_ids)
      and (foods is null or jsonb_typeof(foods) <> 'array' or foods = '[]'::jsonb)) then
      reply := '음식이 비어 있는 식사 기록이 있어 저장하지 않았어요. 원래 식사 기록을 먼저 확인해 주세요.';
    else
      select jsonb_agg(jsonb_build_object(
        'name',btrim(f.food->>'name'),'grams',f.food->'grams',
        'unit',coalesce(f.food->>'unit',f.food#>>'{barcodeProduct,unit}','g'),
        'manualBrand',left(coalesce(nullif(f.food->>'manualBrand',''),f.food#>>'{barcodeProduct,maker}',''),200),
        'calories',case when f.food->>'nutritionStatus'='unknown' then 'null'::jsonb else f.food->'calories' end,
        'carbs',case when f.food->>'nutritionStatus'='unknown' then 'null'::jsonb else f.food->'carbs' end,
        'protein',case when f.food->>'nutritionStatus'='unknown' then 'null'::jsonb else f.food->'protein' end,
        'fat',case when f.food->>'nutritionStatus'='unknown' then 'null'::jsonb else f.food->'fat' end
      ) || case when f.food->>'nutritionStatus'='unknown' then '{"nutritionStatus":"unknown"}'::jsonb else '{}'::jsonb end
        order by m.created_at, m.id, f.position) into source_foods
        from public.meals m cross join lateral jsonb_array_elements(m.foods) with ordinality f(food, position)
        where m.user_id = actor and m.id = any(source_ids);
      if jsonb_array_length(source_foods) not between 1 and 8 then
        reply := '내 조합에는 음식 1~8개를 저장할 수 있어요. 이번 식사는 음식 수를 확인해야 해서 저장하지 않았어요.';
      elsif exists (select 1 from jsonb_array_elements(source_foods) f where
        jsonb_typeof(f->'name') is distinct from 'string' or length(btrim(f->>'name')) not between 1 and 200
        or jsonb_typeof(f->'grams') is distinct from 'number'
        or case when jsonb_typeof(f->'grams') = 'number' then (f->>'grams')::numeric < 0.001 or (f->>'grams')::numeric > 100000 else false end
        or f->>'unit' not in ('g','mL','개','인분')
        or (coalesce(f->>'nutritionStatus','') <> 'unknown' and exists (
          select 1 from unnest(array['calories','carbs','protein','fat']) k
          where jsonb_typeof(f->k) is distinct from 'number'
            or case when jsonb_typeof(f->k)='number' then (f->>k)::numeric not between 0 and 1000000 else false end
        ))
      ) then
        reply := '음식 이름이나 양을 확인해야 해서 저장하지 않았어요. 원래 식사 기록을 먼저 확인해 주세요.';
      else
        perform pg_advisory_xact_lock(hashtextextended(actor::text || ':combination:' || lower(regexp_replace(saved_name,'\s','','g')), 0));
        select * into combo from public.meal_combinations
          where user_id = actor and lower(regexp_replace(name,'\s','','g')) = lower(regexp_replace(saved_name,'\s','','g'))
          order by updated_at desc, id limit 1;
        if found and (combo.foods <> source_foods or combo.meal_type <> source_type) then
          outcome := 'name_conflict';
          reply := '“' || saved_name || '”이라는 이름에 다른 음식이나 양이 이미 저장되어 있어요. 기존 조합은 변경하지 않았어요. 다른 이름으로 요청하거나 내 조합에서 수정해 주세요.';
        else
          if combo.id is null then
            insert into public.meal_combinations(user_id,name,meal_type,foods,approved_at)
              values(actor,saved_name,source_type,source_foods,now()) returning * into combo;
            outcome := 'saved';
            reply := '“' || combo.name || '”을 내 조합으로 저장했어요.';
          else
            outcome := 'already_saved';
            reply := '“' || combo.name || '”은 같은 음식과 양으로 이미 저장되어 있어요. 중복으로 만들지 않았어요.';
          end if;
          reply := reply || E'\n' || p_day::text || ' ' || source_type || ' 기록 기준이에요.' || E'\n' ||
            (select string_agg((f->>'name') || ' ' || (f->>'grams') || coalesce(f->>'unit','g'), ' + ') from jsonb_array_elements(source_foods) f)
            || E'\n기존 식사 기록은 그대로이며, 식단 비서의 ‘내 조합’에서 다시 불러올 수 있어요.';
        end if;
      end if;
    end if;
  end if;
  result := jsonb_build_object('reply',reply,'mode','기억 저장','warnings','[]'::jsonb,
    'evidence',jsonb_build_array(p_day::text || ' · 직접 저장한 식사 기록'),'suggestions','[]'::jsonb,
    'memory_save',jsonb_build_object('status',outcome,'name',saved_name,
      'combination_id',case when outcome in ('saved','already_saved') then combo.id else null end,
      'source_meal_ids',source_ids,'day',p_day,'meal_type',source_type),
    'conversation_context',jsonb_build_object('version',1,'kind','general','day',p_day));
  cid := public.meallog_coach_save(p_conversation,p_request,p_question,reply,result);
  return result || jsonb_build_object('ok',true,'conversation_id',cid);
end;
$$;

revoke all on function public.meallog_coach_remember(uuid,uuid,text,date,text,text,boolean) from public, anon;
grant execute on function public.meallog_coach_remember(uuid,uuid,text,date,text,text,boolean) to authenticated;
