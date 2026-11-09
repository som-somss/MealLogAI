import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {batchRequest,resolveBatchEdit} from '../coach-batch.js';
import {editChoice} from '../coach-edit.js';
import {siteFoods} from '../coach-catalog.js';
import {koreaDay} from '../coach-core.js';
import {makeHandler} from '../api/ai-coach.js';
const day=koreaDay();
const rice={name:'흰쌀밥',grams:210,unit:'g',calories:273,carbs:58.8,protein:5.6,fat:0.7};
const mayo={name:'마요네즈',grams:3,unit:'g',calories:22,carbs:0.1,protein:0.1,fat:2.3};
const egg={name:'계란후라이',grams:50,unit:'g',calories:98,carbs:0.4,protein:6.8,fat:7.5};
const garlic={name:'다진마늘',grams:3,unit:'g',calories:4,carbs:0.6,protein:0.2,fat:0};
const meals=[{id:randomUUID(),meal_date:day,meal_type:'점심',created_at:day+'T03:00:00Z',foods:[rice,mayo,egg,garlic]}];
const combos=[{id:randomUUID(),name:'시오콘부볶음밥',meal_type:'점심',approved_at:day,revision:1,foods:[egg,garlic,rice,mayo]}];
const mixed='오늘 점심 오이 100g과 바나나 50g을 추가하고, 마요네즈를 빼고, 계란후라이를 삶은 계란 한 알로 바꿔줘';
const resolve=q=>resolveBatchEdit(batchRequest(q,day),meals,combos,siteFoods,day);
const choose=(pending,n)=>editChoice('선택 '+n,[{role:'assistant',metadata:pending}],day);

test('parses mixed operations, addition/removal lists and multiple replacements completely',()=>{
 const r=batchRequest(mixed,day);assert.deepEqual(r.operations.map(o=>o.operation),['add','add','remove','replace']);assert.equal(r.operations[3].replacementFood,'삶은 계란');
 assert.equal(batchRequest('오늘 점심 마요네즈와 다진마늘을 빼줘',day).operations.length,2);
 assert.equal(batchRequest('오늘 점심 오이 100g, 바나나 50g을 추가해줘',day).operations.length,2);
 const replacements=batchRequest('오늘 점심 마요네즈를 오이 100g, 계란후라이를 삶은 계란 한 알로 바꿔줘',day);
 assert.deepEqual(replacements.operations.map(o=>o.operation),['replace','replace']);
 assert.equal(batchRequest('오늘 점심 오이를 100g 추가해줘',day),null);
});
test('shares one target scope including an explicitly named combination and a trailing scope',()=>{
 const q='오늘 점심 기록이랑 저장한 시오콘부볶음밥 조합 둘 다 오이를 100g 추가하고, 마요네즈를 빼줘';
 const r=resolve(q);assert.equal(r.combination.id,combos[0].id);assert.equal(r.meal.id,meals[0].id);
 assert.equal(resolve('시오콘부볶음밥 조합만 오이를 100g 추가하고, 마요네즈를 빼줘').meal,null);
 assert.equal(resolve('오늘 점심 기록만 오이를 100g 추가하고, 마요네즈를 빼줘').combination,null);
 assert.equal(batchRequest('오늘 점심 오이를 100g 추가하고, 마요네즈를 빼줘. 저장한 시오콘부볶음밥 조합도 같이.',day).comboName,'시오콘부볶음밥');
});
test('plans original indices independently for each target and uses verified new-food nutrition',()=>{
 const r=resolve(mixed);assert.equal(r.operation,'batch');assert.deepEqual(r.meal.operations.map(o=>o.index),[undefined,undefined,1,2]);assert.deepEqual(r.combination.operations.map(o=>o.index),[undefined,undefined,3,0]);
 assert.equal(r.meal.operations[3].food.name,'삶은 계란');assert.equal(r.meal.operations[3].food.grams,50);assert.equal(r.meal.operations[3].food.calories,77.5);assert.deepEqual(r.meal.expected,meals[0].foods);
 const resize=resolve('오늘 점심 흰쌀밥을 100g으로 수정하고, 마요네즈를 빼줘');assert.equal(resize.meal.operations[0].amount,100);
});
test('invalid or missing clauses and conflicting target contexts never become a partial plan',()=>{
 for(const q of ['오늘 점심 오이 100g을 추가하고, 바나나를 추가해줘','오늘 점심 오이 -100g을 추가하고, 마요네즈를 빼줘','오늘 점심 오이 100g을 추가하고, 마요네즈를 빼지 마','오늘 점심 오이 100g을 추가하고, 마요네즈를 빼면 어때?','오늘 점심 오이 100g을 추가하고, 내일 저녁 마요네즈를 빼줘','오늘 점심 오이 100g을 추가하고','오늘 점심 오이 100g을 추가하고, 마요네즈를 빼줘. 아니면 취소해줘','오늘 점심 오이 100g을 추가하고, 조합만 마요네즈를 빼줘']){
  const r=batchRequest(q,day);assert.ok(!r||r.reply,q);
 }
 assert.ok(batchRequest('오늘 점심 '+Array.from({length:11},()=> '오이 1g').join(', ')+' 추가해줘',day).reply);
 assert.ok(resolve('오늘 점심 오이 100g을 추가하고, 없는음식을 빼줘').reply);
 assert.ok(resolve('오늘 점심 오이 100g을 추가하고, 없는새음식 100g을 추가해줘').reply);
});
test('duplicate source operations are rejected and limits use the complete final configuration',()=>{
 assert.ok(resolve('오늘 점심 마요네즈를 빼고, 마요네즈를 오이 100g으로 바꿔줘').reply);
 const foods=[mayo,...Array.from({length:7},()=>rice)],request=batchRequest('오늘 점심 오이를 100g 추가하고, 마요네즈를 빼줘',day);
 assert.equal(resolveBatchEdit(request,[{...meals[0],foods}],[{...combos[0],foods}],siteFoods,day).operation,'batch');
 assert.ok(resolveBatchEdit({...request,operations:[request.operations[0],{...request.operations[0],food:'바나나'}]},[{...meals[0],foods}],[{...combos[0],foods}],siteFoods,day).reply);
 const single=[{...meals[0],foods:[mayo]}],singleCombo=[{...combos[0],foods:[mayo]}];
 assert.equal(resolveBatchEdit(request,single,singleCombo,siteFoods,day).operation,'batch');
});
test('catalog choices retain every operation and expire if either target changes',()=>{
 const catalog=['A','B'].map((brand,i)=>({name:'새음식',brand,unit:'g',nutritionBase:100,calories:10+i*10,carbs:1,protein:1,fat:0}));
 const request=batchRequest('오늘 점심 새음식 50g을 추가하고, 마요네즈를 빼줘',day);
 const pending=resolveBatchEdit(request,meals,combos,catalog,day);assert.equal(pending.edit_pending.choices.length,2);
 const chosen=choose(pending,2),result=resolveBatchEdit(chosen,meals,combos,catalog,day);
 assert.equal(result.meal.operations.length,2);assert.equal(result.meal.operations[0].food.manualBrand,'B');assert.equal(result.meal.operations[1].operation,'remove');
 assert.match(resolveBatchEdit(chosen,meals,[{...combos[0],revision:2}],catalog,day).reply,/바뀌었어요/);
 assert.ok(editChoice('선택 1',[{role:'assistant',metadata:pending}],'2000-01-01').reply);
 assert.ok(editChoice('선택 1',[{role:'assistant',metadata:pending}],day,Date.now()+16*60*1000).reply);
});
test('meal, combination and duplicate-item choices remain part of the same batch',()=>{
 const request=batchRequest('오늘 점심 오이를 100g 추가하고, 마요네즈를 빼줘',day);
 const rows=[meals[0],{...meals[0],id:randomUUID()}];let pending=resolveBatchEdit(request,rows,combos,siteFoods,day);
 assert.equal(pending.edit_pending.choices.length,2);const chosen=choose(pending,2);assert.equal(resolveBatchEdit(chosen,rows,combos,siteFoods,day).meal.id,rows[1].id);
 const duplicate={...meals[0],foods:[rice,mayo,mayo]},duplicateCombo={...combos[0],foods:[rice,mayo,mayo]};
 pending=resolveBatchEdit(request,[duplicate],[duplicateCombo],siteFoods,day);let next=choose(pending,2);
 pending=resolveBatchEdit(next,[duplicate],[duplicateCombo],siteFoods,day);next=choose(pending,2);
 const r=resolveBatchEdit(next,[duplicate],[duplicateCombo],siteFoods,day);assert.equal(r.meal.operations[1].index,2);assert.equal(r.combination.operations[1].index,2);
});
test('batch API calls one atomic RPC, replays persisted receipts and never partially writes unresolved input',async()=>{
 const actor=randomUUID(),cid=randomUUID(),stored=[];const calls=[];let fail=false;
 const handler=makeHandler(async(url,options)=>{
  const u=new URL(url),body=options.body&&JSON.parse(options.body);calls.push({path:u.pathname,body});
  if(u.pathname==='/auth/v1/user')return Response.json({id:actor});
  if(u.pathname==='/rest/v1/ai_coach_messages')return Response.json(stored.filter(m=>m.request_id===u.searchParams.get('request_id')?.slice(3)));
  if(u.pathname==='/rest/v1/meals'||u.pathname==='/rest/v1/meal_combinations'){assert.equal(u.searchParams.get('user_id'),'eq.'+actor);return Response.json(u.pathname.endsWith('/meals')?meals:combos);}
  if(u.pathname==='/rest/v1/rpc/meallog_coach_batch_edit'){
   assert.equal(options.headers.Authorization,'Bearer fixture-session');assert.equal(options.headers['x-meallog-generation'],'11111111-1111-4111-8111-111111111111');
   assert.equal(body.p_edit.meal.operations.length,4);assert.equal(body.p_edit.combination.operations.length,4);
   if(fail)return Response.json({}, {status:500});
   const data={reply:'여러 변경을 함께 저장했어요.',record_edit:{status:'updated',operation:'batch'}};
   stored.push({request_id:body.p_request,conversation_id:cid,content:data.reply,metadata:data});return Response.json({ok:true,conversation_id:cid,...data});
  }
  if(u.pathname==='/rest/v1/rpc/meallog_coach_save')return Response.json(cid);
  throw Error('unexpected '+u.pathname);
 },{OPENAI_API_KEY:'must-not-call'});
 async function ask(message,requestId=randomUUID()) {const res={setHeader(){},status(code){this.statusCode=code;return this;},json(data){this.data=data;}};await handler({method:'POST',headers:{authorization:'Bearer fixture-session','x-meallog-generation':'11111111-1111-4111-8111-111111111111'},body:{message,selected_date:day,request_id:requestId}},res);return res;}
 const id=randomUUID(),first=await ask(mixed,id);assert.equal(first.data.record_edit.operation,'batch');assert.deepEqual((await ask(mixed,id)).data,first.data);assert.equal(calls.filter(c=>c.path.endsWith('meallog_coach_batch_edit')).length,1);
 assert.equal((await ask('오늘 점심 오이 100g을 추가하고, 바나나를 추가해줘')).data.record_edit.status,'needs_details');assert.equal(calls.filter(c=>c.path.endsWith('meallog_coach_batch_edit')).length,1);
 fail=true;const failed=await ask(mixed);assert.equal(failed.statusCode,503);assert.equal(failed.data.reply,undefined);
});
