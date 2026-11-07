import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {editRequest,resolveEdit,editChoice} from '../coach-edit.js';
import {makeHandler} from '../api/ai-coach.js';
import {koreaDay} from '../coach-core.js';
import {siteFoods} from '../coach-catalog.js';

const day=koreaDay();
const rice={name:'흰쌀밥',grams:210,unit:'g',calories:273,carbs:58.8,protein:5.6,fat:0.7};
const egg={name:'계란후라이',grams:50,unit:'g',calories:98,carbs:0.4,protein:6.8,fat:7.5};
const meals=[{id:randomUUID(),meal_date:day,meal_type:'점심',created_at:day+'T03:00:00Z',foods:[rice,egg]}];
const combos=[{id:randomUUID(),name:'시오콘부볶음밥',meal_type:'점심',approved_at:day,revision:2,foods:[rice,egg]}];
const resolve=q=>resolveEdit(editRequest(q,day),meals,combos,siteFoods,day);

test('explicit additions resolve a catalog food and a separate added quantity for both targets',()=>{
 for(const q of ['오늘 점심 오이를 100g 추가해줘','오늘 점심 기록이랑 저장한 시오콘부볶음밥 조합 둘 다 오이를 100g 넣어줘','오늘 점심 오이 0.1kg을 추가해주세요']){
  const r=resolve(q);assert.equal(r.operation,'add',q);assert.equal(r.meal.id,meals[0].id);assert.equal(r.combination.id,combos[0].id);
  assert.equal(r.food.name,'오이');assert.equal(r.food.grams,100);assert.equal(r.food.calories,15);assert.equal(r.food.source,undefined);
 }
 const r=resolve('오늘 점심 계란후라이를 한 알 추가해줘');
 assert.equal(r.food.grams,50);assert.equal(r.food.calories,98);assert.deepEqual(meals[0].foods,[rice,egg]);
});

test('whole-item removal selects exact owned indices and preserves snapshots',()=>{
 for(const verb of ['빼줘','빼주세요','삭제해줘','제거해줘','제외해줘']){
  const r=resolve('오늘 점심 계란후라이를 '+verb);assert.equal(r.operation,'remove',verb);assert.equal(r.meal.index,1);assert.equal(r.combination.index,1);assert.deepEqual(r.meal.expected,[rice,egg]);
 }
 assert.equal(resolve('오늘 점심 기록만 계란후라이를 빼줘').combination,null);
 assert.equal(resolve('시오콘부볶음밥 조합만 오이를 100g 추가해줘').meal,null);
});

test('missing or ambiguous quantities, compound operations and non-commands never write',()=>{
 for(const q of ['오늘 점심 오이를 추가해줘','오늘 점심 오이를 0g 추가해줘','오늘 점심 오이를 -50g 추가해줘','오늘 점심 오이를 100g 추가하면 어때?','오늘 점심 오이를 100g 추가하지 마','오늘 점심 오이를 100g 넣지 말아줘','오늘 점심 계란후라이를 빼지 마','오늘 점심 계란후라이 20g만 빼줘','오늘 점심 오이 100g과 바나나 100g을 추가해줘','오늘 점심 계란후라이를 빼줘. 오이를 100g 추가해줘','오늘 점심 전부 빼줘']) assert.ok(editRequest(q,day)?.reply,q);
});

test('unknown food and unavailable conversion ask instead of inventing nutrition',()=>{
 assert.ok(resolve('오늘 점심 알수없는음식123을 100g 추가해줘').reply);
 assert.match(resolve('오늘 점심 오이를 한 팩 추가해줘').reply,/중량을 확인할 수 없어요/);
});

test('catalog ambiguity is selected in conversation and revalidated',()=>{
 const catalog=[{name:'검증음식',brand:'A',unit:'g',nutritionBase:100,calories:10,carbs:1,protein:1,fat:0},{name:'검증음식',brand:'B',unit:'g',nutritionBase:100,calories:20,carbs:2,protein:1,fat:0}];
 const request=editRequest('오늘 점심 검증음식을 50g 추가해줘',day);
 const pending=resolveEdit(request,meals,combos,catalog,day);
 assert.equal(pending.edit_pending.choices.length,2);
 const selected=editChoice('선택 2',[{role:'assistant',metadata:pending}],day);
 const r=resolveEdit(selected,meals,combos,catalog,day);
 assert.equal(r.food.manualBrand,'B');assert.equal(r.food.calories,10);
 assert.ok(resolveEdit(selected,meals,combos,catalog.slice(0,1),day).reply);
});

test('additions select a meal even before the food exists; removals disambiguate duplicate items',()=>{
 const req=editRequest('오늘 점심 오이를 100g 추가해줘',day);
 const other={...meals[0],id:randomUUID(),foods:[rice]};
 const pending=resolveEdit(req,[...meals,other],combos,siteFoods,day);
 assert.equal(pending.edit_pending.choices.length,2);
 const chosen=editChoice('선택 1',[{role:'assistant',metadata:pending}],day);
 assert.equal(resolveEdit(chosen,meals,combos,siteFoods,day).meal.id,meals[0].id);
 const duplicate={...meals[0],foods:[rice,egg,egg]};
 const removal=resolveEdit(editRequest('오늘 점심 계란후라이를 빼줘',day),[duplicate],[],siteFoods,day);
 assert.equal(removal.edit_pending.choices.length,2);
});

test('missing required combination, full combination and final food cannot partly modify a meal',()=>{
 const required=editRequest('오늘 점심 기록이랑 저장한 없는조합 조합 둘 다 계란후라이를 빼줘',day);
 assert.ok(resolveEdit(required,meals,combos,siteFoods,day).reply);
 const full={...combos[0],foods:Array.from({length:8},()=>rice)};
 assert.ok(resolveEdit(editRequest('오늘 점심 기록이랑 저장한 시오콘부볶음밥 조합 둘 다 오이를 100g 추가해줘',day),meals,[full],siteFoods,day).reply);
 const single={...combos[0],foods:[egg]};
 assert.ok(resolveEdit(editRequest('오늘 점심 기록이랑 저장한 시오콘부볶음밥 조합 둘 다 계란후라이를 빼줘',day),meals,[single],siteFoods,day).reply);
 assert.equal(resolveEdit(editRequest('오늘 점심 오이를 100g 추가해줘',day),meals,[single],siteFoods,day).combination,null);
});

test('API dispatches add/remove to the atomic RPC and never calls a model or claims failed persistence',async()=>{
 const userId=randomUUID(),conversationId=randomUUID();let fail=false,calls=[];const stored=[];
 const handler=makeHandler(async(url,options)=>{
  const u=new URL(url),body=options.body&&JSON.parse(options.body);calls.push({path:u.pathname,body});
  assert.equal(options.headers.Authorization,'Bearer test-session');
  if(u.pathname==='/auth/v1/user')return Response.json({id:userId});
  if(u.pathname==='/rest/v1/ai_coach_messages')return Response.json(stored.filter(m=>m.request_id===u.searchParams.get('request_id')?.slice(3)));
  if(u.pathname==='/rest/v1/meals'||u.pathname==='/rest/v1/meal_combinations'){
   assert.equal(u.searchParams.get('user_id'),'eq.'+userId);return Response.json(u.pathname.endsWith('/meals')?meals:combos);
  }
  if(u.pathname==='/rest/v1/rpc/meallog_coach_change_foods'){
   assert.equal(options.headers['x-meallog-generation'],'11111111-1111-4111-8111-111111111111');
   if(fail)return Response.json({}, {status:500});
   const data={reply:'수정했어요.',record_edit:{status:'updated',operation:body.p_edit.operation},suggestions:[]};
   stored.push({request_id:body.p_request,conversation_id:conversationId,content:data.reply,metadata:data});
   return Response.json({ok:true,conversation_id:conversationId,...data});
  }
  throw Error('Unexpected endpoint '+u.pathname);
 },{OPENAI_API_KEY:'must-not-use'});
 async function ask(message,requestId=randomUUID()){
  const res={setHeader(){},status(code){this.statusCode=code;return this;},json(value){this.data=value;}};
  await handler({method:'POST',headers:{authorization:'Bearer test-session','x-meallog-generation':'11111111-1111-4111-8111-111111111111'},body:{message,request_id:requestId,selected_date:day}},res);return res;
 }
 const id=randomUUID(),first=await ask('오늘 점심 오이를 100g 추가해줘',id);
 assert.equal(first.data.record_edit.operation,'add');assert.equal(calls.at(-1).body.p_edit.food.calories,15);
 assert.deepEqual((await ask('오늘 점심 오이를 100g 추가해줘',id)).data,first.data);
 assert.equal(calls.filter(c=>c.path.endsWith('meallog_coach_change_foods')).length,1);
 assert.equal((await ask('오늘 점심 계란후라이를 빼줘')).data.record_edit.operation,'remove');
 fail=true;const failed=await ask('오늘 점심 오이를 100g 추가해줘');assert.equal(failed.statusCode,503);assert.equal(failed.data.reply,undefined);
});
