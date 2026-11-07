import {readFileSync} from 'node:fs';
import {plan,compose} from '../coach-core.js';
import {siteFoods} from '../coach-catalog.js';
import {lookupFood} from '../coach-food-budget.js';
import {createGenerator,previousIntent,resolveFollowUp,conversationContext,generationDiagnostic} from '../coach-generation.js';
const cfg=readFileSync(new URL('../supabase-config.js',import.meta.url),'utf8');
const database=cfg.match(/https:\/\/[a-z]+\.supabase\.co/)[0],publicKey=cfg.match(/sb_publishable_[a-zA-Z0-9_-]+/)[0];
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function makeHandler(fetcher=fetch,env=process.env){return async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Authorization');
 const fail=(status,message)=>res.status(status).json({ok:false,message});
 if(req.method!=='POST'){res.setHeader('Allow','POST');return fail(405,'POST 요청이 필요해요.');}
 const authorization=req.headers.authorization;if(!/^Bearer [A-Za-z0-9._-]+$/.test(authorization||''))return fail(401,'로그인한 뒤 이용해 주세요.');
 let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return fail(400,'질문 형식을 확인해 주세요.');}
 if(!body||typeof body.message!=='string'||!body.message.trim()||body.message.length>1500||!uuid(body.request_id)||(body.conversation_id!=null&&!uuid(body.conversation_id)))return fail(400,'질문과 대화 정보를 확인해 주세요.');
 let route;try{route=plan(body.message,body.selected_date);}catch(e){return fail(400,e.message);}
 const headers={apikey:publicKey,Authorization:authorization,'Content-Type':'application/json'};
 async function request(path,data){const r=await fetcher(database+path,{method:data?'POST':'GET',headers,body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error(r.status===401||r.status===403?'로그인 상태를 다시 확인해 주세요.':'서버 조회·저장을 완료하지 못했어요. 질문을 유지했으니 다시 시도해 주세요.');if(r.status===204)return null;const text=await r.text();return text?JSON.parse(text):null;}
 try{
  const user=await request('/auth/v1/user');if(!user?.id)return fail(401,'로그인을 확인해 주세요.');
  const prior=await request('/rest/v1/ai_coach_messages?select=conversation_id,content,metadata&user_id=eq.'+user.id+'&request_id=eq.'+body.request_id+'&role=eq.assistant');
  if(prior[0])return res.status(200).json({ok:true,conversation_id:prior[0].conversation_id,...prior[0].metadata,reply:prior[0].content});
  const settingsContext = await request('/rest/v1/rpc/meallog_coach_context',{p_kind:'general',p_day:route.day});
  let previous = null;
  if (body.conversation_id) {
   const query = new URLSearchParams({select:'role,content,metadata',user_id:'eq.'+user.id,conversation_id:'eq.'+body.conversation_id,order:'created_at.desc,role.asc',limit:'8'});
   previous = previousIntent(await request('/rest/v1/ai_coach_messages?'+query),body.selected_date);
  }
  route = resolveFollowUp(body.message,previous,{...route,selected_date:body.selected_date}) || route;
  const enabled = settingsContext.settings?.use_external_ai === true;
  let reserved = false, generationFailed = false, usage, result, diagnostic;
  const generator = createGenerator(fetcher,env);
  try {
   if (enabled && env.OPENAI_API_KEY) {
    let stage = 'reservation';
    try {
     const reservation = await request('/rest/v1/rpc/meal_assistant_reserve',{p_request:body.request_id});
     usage = reservation.usage;
     if (!reservation.allowed) throw Object.assign(Error('AI usage limit'), {coachCode: reservation.reason});
     reserved = true;
     stage = 'interpretation';
     if (!route.followUp) route = await generator.interpret(body.message,previous,route);
    } catch (error) { generationFailed = true; diagnostic = generationDiagnostic(error,stage); }
   }
   const context = route.kind === 'general' ? settingsContext : await request('/rest/v1/rpc/meallog_coach_context',{p_kind:route.kind==='food'?'today':route.kind,p_day:route.day});
   if (route.kind === 'food') {
    context.kind = 'food';
    context.foodRequest = route.foodRequest;
    context.foodLookup = route.foodRequest.multiple || route.foodRequest.invalidAmount || route.foodRequest.needsFood || route.foodRequest.needsAmount ? {matches:[]} : await lookupFood(route.foodRequest,siteFoods,fetcher);
   }
   context.preferences = route.preferences;
   if (['recommend','memory'].includes(route.kind)) context.catalog = siteFoods;
   result = compose(context);
   result.conversation_context = conversationContext(route,body.selected_date);
   result.mode = '기록 기반 코칭';
   if (usage) result.usage = usage;
   if (reserved && !generationFailed) {
    try {
     const generated = await generator.answer(body.message,route,result);
     result.reply = route.kind === 'general' ? generated : generated+'\n\n'+result.reply;
     result.mode = '생성형 AI 코치';
    } catch (error) { generationFailed = true; diagnostic = generationDiagnostic(error,'answer'); }
   }
   if (enabled && !env.OPENAI_API_KEY) diagnostic = generationDiagnostic({coachCode:'missing_key'},'configuration');
   if (diagnostic) result.generation_diagnostic = diagnostic;
   if (enabled && (!env.OPENAI_API_KEY || generationFailed)) result.warnings.push('생성형 AI 연결 또는 이용 한도를 확인해 주세요. 현재는 기록 기반 답변이에요.');
  } finally {
   if (reserved) {
    try { await request('/rest/v1/rpc/meal_assistant_release',{p_request:body.request_id}); } catch {}
   }
  }
  const id=await request('/rest/v1/rpc/meallog_coach_save',{p_conversation:body.conversation_id||null,p_request:body.request_id,p_question:body.message.trim(),p_reply:result.reply,p_metadata:result});
  return res.status(200).json({ok:true,conversation_id:id,...result});
 }catch(e){return fail(503,e.message==='fetch failed'?'연결을 확인하고 다시 시도해 주세요.':e.message);}
};}
export default makeHandler();
