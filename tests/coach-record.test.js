import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {recordRequest,resolveRecord} from '../coach-record.js';
import {makeHandler} from '../api/ai-coach.js';
import {koreaDay} from '../coach-core.js';

const owner='11111111-1111-4111-8111-111111111111',conversation='22222222-2222-4222-8222-222222222222';
const recipe=()=>({id:'33333333-3333-4333-8333-333333333333',user_id:owner,name:'시오콘부볶음밥',revision:3,approved_at:'2026-11-01',yield_servings:2,cooked_weight:800,foods:[{name:'밥',unit:'g',grams:400,calories:520,carbs:116,protein:12,fat:0},{name:'계란후라이',unit:'g',grams:100,calories:196,carbs:1.6,protein:14,fat:15}]});
const resolve=(q,combos=[recipe()])=>resolveRecord(recordRequest(q,'2026-11-07','2026-11-09'),combos,randomUUID());

test('repeat meal commands preserve explicit dates, meal types and recipe quantities',()=>{
 for(const [q,mode,quantity,day,type] of [
  ['저장한 시오콘부볶음밥을 오늘 점심으로 기록해줘','whole',1,'2026-11-09','점심'],
  ['오늘 저녁으로 시오콘부볶음밥 절반만 기록해줘','whole',.5,'2026-11-09','저녁'],
  ['시오콘부볶음밥 0.5인분을 어제 점심으로 기록해줘','servings',.5,'2026-11-08','점심'],
  ['내 조합 시오콘부볶음밥 200g을 점심으로 저장해줘','weight',200,'2026-11-07','점심'],
  ['2026-11-01 점심으로 시오콘부볶음밥 25% 기록해줘','whole',.25,'2026-11-01','점심'],
  ['시오콘부 볶음밥 반 인분을 오늘 점심으로 기록해줘','servings',.5,'2026-11-09','점심']
 ]){const r=resolve(q);assert.equal(r.combination_record.status,'ready',q);const d=r.combination_record.draft;assert.deepEqual([d.mode,d.quantity,d.day,d.meal_type],[mode,quantity,day,type]);assert.match(r.reply,/아직 식사로 저장하지 않았어요/);}
 assert.match(resolve('시오콘부볶음밥 0.5인분 오늘 점심으로 기록해줘').reply,/25%/);
});

test('unsafe, ambiguous and unparsed repeat commands never produce a record draft',()=>{
 for(const q of ['시오콘부볶음밥 오늘 점심으로 기록하지 마','시오콘부볶음밥 오늘 점심으로 기록해도 돼?', '시오콘부볶음밥 내일 점심으로 기록해줘','시오콘부볶음밥 오늘 어제 점심으로 기록해줘','시오콘부볶음밥 오늘 점심 저녁으로 기록해줘','시오콘부볶음밥 오늘 기록해줘','시오콘부볶음밥 오늘 점심 밥만 반만 기록해줘','시오콘부볶음밥 오늘 점심 계란 한 알로 기록해줘','시오콘부볶음밥 오늘 점심 0인분 기록해줘','시오콘부볶음밥 오늘 점심 -1인분 기록해줘','시오콘부볶음밥 오늘 점심 1인분 200g 기록해줘','시오콘부볶음밥 오늘 점심 100000000g 기록해줘','없는조합 오늘 점심으로 기록해줘','시오콘부볶음밥 안 먹었어 오늘 점심으로 기록해줘','시오콘부볶음밥 2026-02-30 점심으로 기록해줘']){
  const intent=recordRequest(q,'2026-11-07','2026-11-09');if(intent){const r=resolveRecord(intent,[recipe()],randomUUID());assert.notEqual(r.combination_record.status,'ready',q);assert.equal(r.combination_record.draft,undefined);}
 }
 assert.equal(recordRequest('오늘 점심을 시오콘부볶음밥으로 기억해줘','2026-11-09'),null);
 assert.equal(recordRequest('오늘 점심을 시오콘부볶음밥으로 저장해줘','2026-11-09'),null);
 assert.equal(recordRequest('오늘 단백질 얼마나 부족해?','2026-11-09'),null);
});

test('duplicate names, missing recipe basis and incomplete nutrition do not silently guess',()=>{
 const q='시오콘부볶음밥 0.5인분 오늘 점심으로 기록해줘';
 for(const combos of [[recipe(),{...recipe(),id:randomUUID()}],[{...recipe(),yield_servings:null}],[{...recipe(),approved_at:null}],[{...recipe(),foods:[{...recipe().foods[0],protein:null}]}]])assert.equal(resolve(q,combos).combination_record.status,'needs_details');
 assert.equal(resolve('시오콘부볶음밥 200g 오늘 점심으로 기록해줘',[{...recipe(),cooked_weight:null}]).combination_record.status,'needs_details');
 const r=resolve(q,[recipe(),{...recipe(),id:randomUUID(),name:'볶음밥'}]);assert.equal(r.combination_record.draft.combination_id,recipe().id);
 assert.equal(resolve('시오콘부볶음밥과 볶음밥을 오늘 점심으로 기록해줘',[recipe(),{...recipe(),id:randomUUID(),name:'볶음밥'}]).combination_record.status,'needs_details');
});

test('API prepares and persists a stable draft, never calls a meal-write RPC or external AI',async()=>{
 const saved=[],calls=[],requestId=randomUUID();
 const handler=makeHandler(async(url,options)=>{const u=new URL(url),data=options.body?JSON.parse(options.body):null;calls.push(u.pathname);assert.match(u.hostname,/supabase\.co$/);assert.equal(options.headers.Authorization,'Bearer test-session');
  if(u.pathname==='/auth/v1/user')return Response.json({id:owner});
  if(u.pathname==='/rest/v1/ai_coach_messages')return Response.json(saved.filter(x=>x.request_id===u.searchParams.get('request_id').slice(3)));
  if(u.pathname==='/rest/v1/meal_combinations'){assert.equal(u.searchParams.get('user_id'),'eq.'+owner);return Response.json([recipe()]);}
  if(u.pathname==='/rest/v1/rpc/meallog_coach_save'){saved.push({request_id:data.p_request,conversation_id:conversation,content:data.p_reply,metadata:data.p_metadata});return Response.json(conversation);}
  throw Error('Unexpected side effect: '+u.pathname);
 },{OPENAI_API_KEY:'unused'});
 async function ask(){const res={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;return this;}};await handler({method:'POST',headers:{authorization:'Bearer test-session'},body:{message:'저장한 시오콘부볶음밥 0.5인분을 오늘 점심으로 기록해줘',selected_date:koreaDay(),request_id:requestId}},res);return res;}
 const first=await ask();assert.equal(first.code,200);assert.equal(first.data.combination_record.draft.request_id,requestId);assert.match(first.data.reply,/25%/);const second=await ask();assert.deepEqual(second.data,first.data);assert.equal(saved.length,1);assert.equal(calls.filter(x=>x.includes('meal_combinations')).length,1);
});
