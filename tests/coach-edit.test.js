import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {editRequest,resolveEdit,editChoice} from '../coach-edit.js';
import {makeHandler} from '../api/ai-coach.js';
import {koreaDay} from '../coach-core.js';

const day=koreaDay();
const egg={name:'계란후라이',grams:100,unit:'g',calories:196,carbs:0.8,protein:13.6,fat:15,barcodeProduct:null};
const rice={name:'흰쌀밥',grams:210,unit:'g',calories:273,carbs:58.8,protein:5.6,fat:0.7};
const meals=[{id:randomUUID(),meal_date:day,meal_type:'점심',meal_time:day+'T12:00:00+09:00',created_at:day+'T03:00:00Z',foods:[rice,egg]}];
const combos=[{id:randomUUID(),name:'시오콘부볶음밥',meal_type:'점심',approved_at:day,revision:1,foods:[{...egg,barcodeProduct:undefined},rice]}];
const catalog=[{name:'계란후라이',unit:'g',portions:[['1개',50],['2개',100]]},{name:'흰쌀밥',aliases:['밥'],unit:'g',portions:[['1공기',210]]}];

test('understands explicit quantity corrections, one egg and named destinations',()=>{
  for(const question of ['오늘 점심 계란후라이를 50g으로 수정해줘','오늘 점심 기록이랑 저장한 시오콘부볶음밥 조합 둘 다 계란후라이를 50g으로 수정해줘','오늘 점심 계란후라이를 50g으로 수정해줘. 저장한 시오콘부볶음밥 조합도 같이.']) {
    const r=editRequest(question,day);
    assert.equal(r.reply,undefined,question);assert.equal(r.food,'계란후라이');assert.equal(r.amount,50);assert.equal(r.day,day);assert.equal(r.scope,'both');
  }
  const one=editRequest('오늘 점심 계란후라이를 한 알로 바꿔줘',day);
  assert.equal(one.unit,'개');assert.equal(one.amount,1);
  const resolved=resolveEdit(one,meals,combos,catalog,day);
  assert.equal(resolved.meal.amount,50);assert.equal(resolved.combination.amount,50);
  assert.equal(editRequest('어제 점심 계란후라이를 0.05kg으로 수정해줘',day).amount,50);
  assert.equal(editRequest('오늘 점심 그릭요거트를 50g으로 수정해줘',day).food,'그릭요거트');
  const riceEdit=resolveEdit(editRequest('오늘 점심 밥을 반 공기로 수정해줘',day),meals,combos,catalog,day);
  assert.equal(riceEdit.meal.amount,105);assert.equal(riceEdit.combination.amount,105);
});

test('does not turn questions, negations, invalid amounts or multi-food changes into writes',()=>{
  for(const q of ['오늘 점심 계란후라이를 50g으로 수정하면 어때?','오늘 점심 계란후라이를 50g으로 수정하지 마','오늘 점심 계란후라이를 -50g으로 수정해줘','오늘 점심 계란후라이를 0g으로 수정해줘','오늘 점심 계란후라이를 100001g으로 수정해줘','오늘 점심 계란후라이를 반만 수정해줘','오늘 점심 계란후라이 50g하고 밥 100g으로 수정해줘','내일 점심 계란후라이를 50g으로 수정해줘','오늘 어제 점심 계란후라이를 50g으로 수정해줘']) assert.ok(editRequest(q,day)?.reply,q);
  assert.equal(editRequest('과메기 100g 먹으면?',day),null);
  assert.equal(editRequest('오늘 점심을 볶음밥으로 기억해줘',day),null);
});

test('honors meal-only and combination-only corrections',()=>{
  const a=resolveEdit(editRequest('오늘 점심 기록만 계란후라이를 50g으로 수정해줘',day),meals,combos,catalog,day);
  assert.ok(a.meal);assert.equal(a.combination,null);
  const b=resolveEdit(editRequest('시오콘부볶음밥 조합만 계란후라이를 50g으로 수정해줘',day),[],combos,catalog,day);
  assert.equal(b.meal,null);assert.equal(b.combination.amount,50);
});

test('does not guess serving conversions or a missing required combination',()=>{
  const bad=resolveEdit(editRequest('오늘 점심 흰쌀밥을 한 팩으로 수정해줘',day),meals,combos,catalog,day);
  assert.match(bad.reply,/중량을 확인할 수 없어요/);
  const absent=resolveEdit(editRequest('오늘 점심 계란후라이를 50g으로 수정해줘. 조합도 같이.',day),meals,[],catalog,day);
  assert.match(absent.reply,/어느 쪽도 수정하지 않았어요/);
});

test('only an exact full recipe match is automatically updated',()=>{
  const request=editRequest('오늘 점심 계란후라이를 50g으로 수정해줘',day);
  const different={...combos[0],foods:[egg,{...rice,grams:100}]};
  assert.equal(resolveEdit(request,meals,[different],catalog,day).combination,null);
  const named={...request,comboName:different.name,requireCombo:true};
  assert.equal(resolveEdit(named,meals,[different],catalog,day).combination.id,different.id);
});

test('ambiguity is resolved in conversation and expires across dates, topics and time',()=>{
  const request=editRequest('오늘 점심 계란후라이를 50g으로 수정해줘',day);
  const other={...meals[0],id:randomUUID(),meal_time:day+'T13:00:00+09:00'};
  const choice=resolveEdit(request,[...meals,other],combos,catalog,day);
  assert.equal(choice.record_edit.status,'needs_details');
  assert.equal(choice.edit_pending.choices.length,2);
  const messages=[{role:'assistant',metadata:choice}];
  const selected=editChoice('선택 2',messages,day);
  assert.equal(resolveEdit(selected,[...meals,other],combos,catalog,day).meal.id,other.id);
  assert.ok(editChoice('선택 2',messages,'2000-01-01').reply);
  assert.ok(editChoice('선택 2',messages,day,Date.now()+16*60*1000).reply);
  assert.equal(editChoice('선택 2',[{role:'assistant',metadata:{}},...messages],day),null);
  const multiple=resolveEdit(request,meals,[...combos,{...combos[0],id:randomUUID(),name:'다른 조합'}],catalog,day);
  assert.equal(multiple.edit_pending.choices.length,2);
});

function fixture({fail=false,foodRows=meals,comboRows=combos}={}) {
 const userId=randomUUID(),conversationId=randomUUID(),calls=[],messages=[];
 const handler=makeHandler(async(url,options)=>{
  const u=new URL(url),body=options.body&&JSON.parse(options.body);calls.push({url:u,body});
  assert.equal(options.headers.Authorization,'Bearer fixture-session');
  if(u.pathname==='/auth/v1/user')return Response.json({id:userId});
  if(u.pathname==='/rest/v1/ai_coach_messages') {
   assert.equal(u.searchParams.get('user_id'),'eq.'+userId);
   const id=u.searchParams.get('request_id')?.slice(3);
   return Response.json(id?messages.filter(m=>m.request_id===id&&m.role==='assistant'):messages);
  }
  if(u.pathname==='/rest/v1/meals'||u.pathname==='/rest/v1/meal_combinations') {
   assert.equal(u.searchParams.get('user_id'),'eq.'+userId);
   return Response.json(u.pathname.endsWith('/meals')?foodRows:comboRows);
  }
  if(u.pathname.endsWith('/meallog_coach_resize')) {
   assert.equal(options.headers['x-meallog-generation'],'11111111-1111-4111-8111-111111111111');
   if(fail)return Response.json({}, {status:500});
   assert.equal(body.p_edit.meal.amount,50);assert.equal(body.p_edit.combination.amount,50);
   const data={reply:'식사 기록과 저장 조합을 수정했어요.',record_edit:{status:'updated'},suggestions:[]};
   messages.unshift({role:'assistant',request_id:body.p_request,conversation_id:conversationId,content:data.reply,metadata:data});
   return Response.json({ok:true,conversation_id:conversationId,...data});
  }
  if(u.pathname.endsWith('/meallog_coach_save')) {messages.unshift({role:'assistant',request_id:body.p_request,conversation_id:conversationId,content:body.p_reply,metadata:body.p_metadata});return Response.json(conversationId);}
  throw Error('Unexpected endpoint '+u.pathname);
 },{OPENAI_API_KEY:'unused'});
 async function ask(message,requestId=randomUUID()) {
  const res={statusCode:200,setHeader(){},status(code){this.statusCode=code;return this;},json(value){this.data=value;}};
  await handler({method:'POST',headers:{authorization:'Bearer fixture-session','x-meallog-generation':'11111111-1111-4111-8111-111111111111'},body:{message,request_id:requestId,conversation_id:messages.length?conversationId:null,selected_date:day}},res);return res;
 }
 return {ask,calls};
}
test('API uses owned records, atomic RPC, sync guard and stored response on retry without model calls',async()=>{
 const {ask,calls}=fixture(),requestId=randomUUID();
 const first=await ask('오늘 점심 계란후라이를 한 알로 수정해줘',requestId);
 assert.equal(first.data.record_edit.status,'updated');
 const retry=await ask('오늘 점심 계란후라이를 한 알로 수정해줘',requestId);
 assert.deepEqual(retry.data,first.data);
 assert.equal(calls.filter(c=>c.url.pathname.endsWith('/meallog_coach_resize')).length,1);
});
test('API clarifies ambiguous rows, accepts a choice, and never confirms a failed write',async()=>{
 const {ask,calls}=fixture({foodRows:[...meals,{...meals[0],id:randomUUID()}]});
 assert.equal((await ask('오늘 점심 계란후라이를 50g으로 수정해줘')).data.record_edit.status,'needs_details');
 assert.equal(calls.filter(c=>c.url.pathname.endsWith('/meallog_coach_resize')).length,0);
 assert.equal((await ask('선택 1')).data.record_edit.status,'updated');
 const failed=await fixture({fail:true}).ask('오늘 점심 계란후라이를 50g으로 수정해줘');
 assert.equal(failed.statusCode,503);assert.equal(failed.data.ok,false);assert.equal(failed.data.reply,undefined);
});
