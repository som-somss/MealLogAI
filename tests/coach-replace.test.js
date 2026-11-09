import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {editRequest,resolveEdit,editChoice} from '../coach-edit.js';
import {koreaDay} from '../coach-core.js';
import {siteFoods} from '../coach-catalog.js';

const day=koreaDay();
const rice={name:'흰쌀밥',grams:210,unit:'g',calories:273,carbs:58.8,protein:5.6,fat:0.7};
const egg={name:'계란후라이',grams:50,unit:'g',calories:98,carbs:0.4,protein:6.8,fat:7.5};
const meals=[{id:randomUUID(),meal_date:day,meal_type:'점심',created_at:day+'T03:00:00Z',foods:[rice,egg]}];
const combos=[{id:randomUUID(),name:'시오콘부볶음밥',meal_type:'점심',approved_at:day,revision:2,foods:[egg,rice]}];
const resolve=q=>resolveEdit(editRequest(q,day),meals,combos,siteFoods,day);

test('replacement distinguishes source food and destination amount with both target indices',()=>{
 for(const q of ['오늘 점심 계란후라이를 오이 100g으로 바꿔줘','오늘 점심 계란후라이 대신 오이 100g으로 교체해줘','오늘 점심 기록이랑 저장한 시오콘부볶음밥 조합 둘 다 계란후라이를 오이 100g으로 변경해주세요']){
  const r=resolve(q);assert.equal(r.operation,'replace',q);assert.equal(r.request.food,'계란후라이');assert.equal(r.food.name,'오이');assert.equal(r.food.grams,100);assert.equal(r.food.calories,15);
  assert.equal(r.meal.index,1);assert.equal(r.combination.index,0);assert.deepEqual(r.meal.expected,[rice,egg]);assert.equal(r.meal.amount,undefined);
 }
});

test('replacement uses the new food serving conversion and retains ordinary quantity changes',()=>{
 const r=resolve('오늘 점심 흰쌀밥을 계란후라이 한 알로 바꿔줘');
 assert.equal(r.food.grams,50);assert.equal(r.food.calories,98);assert.equal(r.meal.index,0);
 for(const q of ['오늘 점심 계란후라이를 50g으로 바꿔줘','오늘 점심 계란후라이를 한 알로 바꿔줘'])assert.equal(resolve(q).operation,'resize');
 assert.equal(resolve('오늘 점심 기록만 계란후라이를 오이 100g으로 바꿔줘').combination,null);
 assert.equal(resolve('시오콘부볶음밥 조합만 계란후라이를 오이 100g으로 바꿔줘').meal,null);
});

test('replacement requires a new amount and rejects hypothetical, negated, compound or partial requests',()=>{
 for(const q of ['오늘 점심 계란후라이를 오이로 바꿔줘','오늘 점심 계란후라이를 오이 0g으로 바꿔줘','오늘 점심 계란후라이를 오이 -50g으로 바꿔줘','오늘 점심 계란후라이를 오이 100g으로 바꾸면 어때?','오늘 점심 계란후라이를 오이 100g으로 변경하지 마','오늘 점심 계란후라이를 오이 100g으로 바꿔줘. 밥을 100g 추가해줘','오늘 점심 계란후라이를 오이 100g과 바나나 50g으로 바꿔줘','오늘 점심 계란후라이 20g을 오이 100g으로 바꿔줘','내일 점심 계란후라이를 오이 100g으로 바꿔줘','오늘 점심 계란후라이와 흰쌀밥을 오이 100g으로 바꿔줘'])assert.ok(editRequest(q,day)?.reply,q);
});

test('unavailable old food, new food, conversion or explicitly required combination never produce edits',()=>{
 for(const q of ['오늘 점심 없는음식을 오이 100g으로 바꿔줘','오늘 점심 계란후라이를 없는새음식 100g으로 바꿔줘','오늘 점심 계란후라이를 오이 한 팩으로 바꿔줘','오늘 점심 기록이랑 저장한 없는조합 조합 둘 다 계란후라이를 오이 100g으로 바꿔줘'])assert.ok(resolve(q).reply,q);
});

test('food catalog choice preserves the original source through subsequent item choices',()=>{
 const catalog=['A','B'].map((brand,i)=>({name:'새음식',brand,unit:'g',nutritionBase:100,calories:10+i*10,carbs:1,protein:1,fat:0}));
 const duplicated={...meals[0],foods:[egg,egg,rice]};
 const combo={...combos[0],foods:[egg,egg,rice]};
 let request=editRequest('오늘 점심 계란후라이를 새음식 50g으로 바꿔줘',day);
 let pending=resolveEdit(request,[duplicated],[combo],catalog,day);
 assert.equal(pending.edit_pending.choices.length,2);
 request=editChoice('선택 2',[{role:'assistant',metadata:pending}],day);
 assert.equal(request.food,'계란후라이');assert.equal(request.replacementFood,'새음식');
 pending=resolveEdit(request,[duplicated],[combo],catalog,day);
 assert.equal(pending.edit_pending.choices.length,2);
 request=editChoice('선택 2',[{role:'assistant',metadata:pending}],day);
 pending=resolveEdit(request,[duplicated],[combo],catalog,day);
 assert.equal(pending.edit_pending.choices.length,2);
 request=editChoice('선택 2',[{role:'assistant',metadata:pending}],day);
 const r=resolveEdit(request,[duplicated],[combo],catalog,day);
 assert.equal(r.meal.index,1);assert.equal(r.combination.index,1);assert.equal(r.food.manualBrand,'B');assert.equal(r.food.calories,10);
 assert.ok(resolveEdit(request,[duplicated],[combo],catalog.slice(0,1),day).reply);
});

test('replacement is allowed for a single item and a full eight-food combination',()=>{
 const request=editRequest('오늘 점심 계란후라이를 오이 100g으로 바꿔줘',day);
 for(const foods of [[egg],[egg,...Array.from({length:7},()=>rice)]]){
  const r=resolveEdit(request,[{...meals[0],foods}],[{...combos[0],foods}],siteFoods,day);
  assert.equal(r.operation,'replace');assert.equal(r.meal.index,0);assert.equal(r.combination.index,0);
 }
});
