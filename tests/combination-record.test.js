import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {randomUUID} from 'node:crypto';
const core=readFileSync(new URL('../combination-record-core.js',import.meta.url),'utf8'),ui=readFileSync(new URL('../combination-record.js',import.meta.url),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x)),ctx={};runInNewContext(core,ctx);const C=ctx.MealLogCombinationCore;
const recipe=()=>({id:'10000000-0000-4000-8000-000000000001',user_id:'owner',name:'검증용 볶음밥',meal_type:'점심',revision:0,yield_servings:2,cooked_weight:800,approved_at:'2026-11-08',updated_at:'2026-11-08',foods:[{name:'밥',grams:400,unit:'g',manualBrand:'',calories:520,carbs:116,protein:12,fat:0},{name:'계란후라이',grams:100,unit:'g',manualBrand:'',calories:196,carbs:1.6,protein:14,fat:15}]});
test('servings and final cooked weight use the entire recipe denominator',()=>{
 const combo=recipe(),before=JSON.stringify(combo),a=C.calculate(combo,'servings',.5),b=C.calculate(combo,'weight',200);
 assert.equal(a.ratio,.25);assert.equal(a.foods[0].grams,100);assert.equal(a.foods[1].calories,49);assert.deepEqual(plain(a.foods),plain(b.foods));assert.equal(JSON.stringify(combo),before);
 assert.equal(C.calculate(combo,'whole',.5).foods[0].grams,200);
 assert.match(C.description(a),/0.5인분 \/ 전체 2인분 · 25%/);
});
test('individual overrides and exclusions use original food indices without changing the source',()=>{
 const combo=recipe(),a=C.calculate(combo,'whole',1,[{index:0,amount:200},{index:1,excluded:true}]);assert.equal(a.foods.length,1);assert.equal(a.totals.calories,260);assert.equal(combo.foods[0].grams,400);
 assert.throws(()=>C.calculate(combo,'whole',1,[{index:0,amount:20},{index:0,amount:40}]));assert.throws(()=>C.calculate(combo,'whole',1,[{index:3,amount:1}]));assert.throws(()=>C.calculate(combo,'whole',1,[{index:0,excluded:true},{index:1,excluded:true}]));
});
test('unknown nutrition remains unknown, and missing yield never becomes a guessed serving',()=>{
 const combo=recipe();combo.foods[1].nutritionStatus='unknown';for(const k of C.nutrients)combo.foods[1][k]=null;
 const a=C.calculate(combo,'servings',1);assert.equal(a.foods[1].grams,50);assert.equal(a.totals.calories,null);assert.equal(a.foods[0].calories,260);
 combo.yield_servings=null;combo.cooked_weight=null;assert.throws(()=>C.calculate(combo,'servings',1),/먼저 저장/);assert.throws(()=>C.calculate(combo,'weight',100),/완성 무게/);assert.equal(C.calculate(combo,'whole',1).foods.length,2);
});
test('invalid quantities, excessive scaling, and missing nutrient values cannot be recorded',()=>{
 for(const value of [0,-1,'',null,true,NaN,Infinity,'1/0'])assert.throws(()=>C.calculate(recipe(),'whole',value));assert.throws(()=>C.calculate(recipe(),'whole',101));assert.throws(()=>C.calculate(recipe(),'unknown',1));assert.throws(()=>C.scale(recipe().foods[0],.00001));
 const missing=recipe().foods[0];missing.protein=null;assert.throws(()=>C.scale(missing,100));assert.equal(C.optional('',1000),null);assert.throws(()=>C.optional(1001,1000));
});
test('personal portions require matching owner, food, brand, unit, and approval',()=>{
 const food=recipe().foods[1],memory={id:'p',user_id:'owner',food:{...food,grams:50},brand:'',portion_label:'한 알',approved_at:'2026-11-08'};
 const memories=[memory,{...memory,id:'other',user_id:'other'},{...memory,id:'brand',brand:'다른 제품'},{...memory,id:'unit',food:{...food,unit:'개'}},{...memory,id:'raw',food:{...food,name:'삶은 계란'}},{...memory,id:'unapproved',approved_at:null}];
 assert.deepEqual(plain(C.portions(food,memories,'owner')).map(x=>x.id),['p']);assert.equal(C.portions(food,memories,null).length,0);assert.equal(C.sameFood(food,{fat:15,...food}),true);
});
const flush=()=>new Promise(r=>setImmediate(r));const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve};};
function harness({database,storage,run,prepare=async()=>{}}={}){
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.textContent='';this.attrs={};this.events={};this.value='';this.disabled=false;this.open=false;this.checked=false;}
  append(...nodes){this.children.push(...nodes);}before(...nodes){body.append(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,fn){this.events[k]=fn;}showModal(){this.open=true;}close(){this.open=false;}reportValidity(){return true;}click(){return this.onclick?.();}
 }
 let user={id:'owner'},writes=0,refreshes=0;const calls=[];
 const db=database||{combos:[recipe()],memories:[],meals:[],receipts:{}};const cache=storage||new Map();
 const body=new Element('body'),anchor=new Element('section'),account=new Element('button');body.append(anchor,account);
 const document={body,createElement:tag=>new Element(tag),querySelector:s=>s==='#mealRecords'?anchor:s==='#accountBtn'?account:null};
 const localStorage={getItem:k=>cache.get(k)||null,setItem:(k,v)=>cache.set(k,v),removeItem:k=>cache.delete(k)};
 const context={document,localStorage,structuredClone,crypto:{randomUUID},AbortController,setTimeout,clearTimeout,Intl,Date};context.window=context;
 function builder(call){const q={select(){return q;},eq(k,v){(call.filters??={})[k]=v;return q;},order(){return q;},limit(){return q;},single(){call.single=true;return q;},maybeSingle(){call.single=true;return q;},abortSignal(s){call.signal=s;return q;},insert(v){call.kind='insert';call.values=plain(v);return q;},update(v){call.kind='update';call.values=plain(v);return q;},then(a,b){calls.push(call);return Promise.resolve().then(async()=>{
   const custom=await run?.(call,db);if(custom!==undefined)return custom;
   if(call.kind==='rpc'){
    const args=call.args;if(db.receipts[args.p_request])return {data:db.receipts[args.p_request],error:null};const combo=db.combos.find(x=>x.id===args.p_combination&&x.user_id===user?.id);if(!combo||combo.revision!==args.p_revision)return {error:{code:'40001',message:'combination_changed'}};
    const result=C.calculate(combo,args.p_mode,args.p_quantity,args.p_overrides);db.meals.push({id:args.p_request,user_id:user.id,meal_date:args.p_day,meal_time:args.p_time,meal_type:args.p_type,foods:plain(result.foods)});writes++;return {data:db.receipts[args.p_request]={meal_id:args.p_request},error:null};
   }
   const rows=call.table==='meal_combinations'?db.combos:call.table==='food_memories'?db.memories:db.meals;
   const matches=rows.filter(row=>Object.entries(call.filters||{}).every(([k,v])=>row[k]===v));
   if(call.kind==='insert'){if(rows.some(x=>x.id===call.values.id))return {error:{code:'23505'}};rows.push({...call.values});return {data:plain(call.values),error:null};}
   if(call.kind==='update'){if(!matches.length)return {error:{code:'PGRST116'}};Object.assign(matches[0],call.values);return {data:plain(matches[0]),error:null};}
   return {data:plain(call.single?matches[0]||null:matches),error:null};
  }).then(a,b);}};return q;}
 const client={from:table=>builder({table,kind:'read'}),rpc:(name,args)=>{assert.equal(name,'meallog_record_combination');return builder({kind:'rpc',args:plain(args)});}};
 runInNewContext(core,context);runInNewContext(ui,context);const panel=context.MealLogCombinationRecord.mount({client,getUser:()=>user,prepare,refresh:async()=>refreshes++,getDay:()=> '2026-11-08'});
 function all(){const output=[];function visit(n){output.push(n);for(const c of n.children)visit(c);}visit(body);return output;}
 const find=(tag,text)=>all().find(n=>n.tag===tag&&n.textContent===text);const field=label=>all().find(n=>n.attrs['aria-label']===label);
 return {panel,db,cache,calls,all,find,field,get writes(){return writes;},get refreshes(){return refreshes;},dialog:field('내 조합 다시 기록하기'),setUser(v){user=v;panel.accountChanged();},text:()=>all().map(n=>n.textContent).join('\n'),async open(){await panel.open();},async choose(){await panel.open(recipe().id);},async click(text){const b=find('button',text);assert.ok(b,'button exists: '+text);await b.click();await flush();},async fill(label,value){const n=field(label);assert.ok(n,'field exists: '+label);n.value=String(value);n.oninput?.();await flush();},async mode(value){const n=field('먹은 양의 기준');n.value=value;n.onchange();await flush();}};
}
test('recipe re-record previews all foods, records one snapshot, and leaves recipe unchanged',async()=>{
 const h=harness();await h.choose();const before=JSON.stringify(h.db.combos);await h.mode('servings');await h.fill('먹은 양',.5);assert.match(h.text(),/25%/);assert.equal(h.writes,0);
 await h.click('식사 저장 전 확인');assert.equal(h.writes,0);await h.click('확인하고 식사 저장');assert.equal(h.writes,1);assert.equal(h.db.meals[0].foods[0].grams,100);assert.equal(JSON.stringify(h.db.combos),before);assert.equal(h.cache.size,0);assert.match(h.text(),/서버 저장을 확인/);
});
test('individual quantities are serialized as numbers, and whole-batch controls reset overrides',async()=>{
 const h=harness();await h.choose();await h.fill('밥 이번 양 (g)',200);await h.click('식사 저장 전 확인');await h.click('확인하고 식사 저장');const args=h.calls.find(c=>c.kind==='rpc').args;assert.equal(args.p_overrides[0].amount,200);assert.equal(h.db.meals[0].foods[1].grams,100);
 await h.choose();await h.fill('밥 이번 양 (g)',200);await h.click('전체의 ¼');assert.equal(Number(h.field('밥 이번 양 (g)').value),100);
});
test('personal serving save is explicit, reusable after reopening, and does not edit recipe or meals',async()=>{
 const h=harness();await h.choose();const before=JSON.stringify(h.db.combos);await h.find('button','이 음식의 개인 분량 기억').click();await h.fill('내 분량 이름','내 공기');await h.fill('기억할 양 (g)',150);assert.equal(h.db.memories.length,0);await h.click('개인 분량 기억 저장');assert.equal(h.db.memories.length,1);assert.equal(h.db.memories[0].food.calories,195);assert.equal(h.db.meals.length,0);assert.equal(JSON.stringify(h.db.combos),before);
 await h.choose();await h.click('내 내 공기 · 150g');assert.equal(Number(h.field('밥 이번 양 (g)').value),150);
});
test('recipe yield settings persist separately and enable portion calculations without editing ingredients',async()=>{
 const db={combos:[{...recipe(),yield_servings:null,cooked_weight:null}],memories:[],meals:[],receipts:{}};const h=harness({database:db});await h.choose();await h.mode('servings');assert.equal(h.find('button','식사 저장 전 확인').disabled,true);const foods=JSON.stringify(db.combos[0].foods);await h.fill('조합 전체 인분',2);await h.fill('완성한 음식 전체 무게 (g)',800);await h.click('조합의 전체 분량 저장');assert.equal(db.combos[0].revision,1);assert.equal(db.combos[0].yield_servings,2);assert.equal(JSON.stringify(db.combos[0].foods),foods);assert.equal(h.find('button','식사 저장 전 확인').disabled,false);
});
test('uncertain write keeps a durable request and reload retry does not insert again',async()=>{
 let lost=true;const db={combos:[recipe()],memories:[],meals:[],receipts:{}};const h=harness({database:db,run:(call,db)=>{if(call.kind==='read'&&call.table==='meals'&&lost){lost=false;return {error:{message:'network failure'}};}}});await h.choose();await h.click('식사 저장 전 확인');await h.click('확인하고 식사 저장');assert.equal(db.meals.length,1);assert.equal(h.cache.size,1);assert.doesNotMatch(h.text(),/서버 저장을 확인했어요/);
 const reopened=harness({database:db,storage:h.cache});await reopened.open();assert.match(reopened.text(),/중복으로 추가하지/);await reopened.click('같은 요청으로 저장 결과 확인');assert.equal(db.meals.length,1);assert.equal(reopened.cache.size,0);assert.match(reopened.text(),/서버 저장을 확인/);
});
test('recipe conflict never saves a stale snapshot or reports success',async()=>{
 const h=harness();await h.choose();await h.click('식사 저장 전 확인');h.db.combos[0].revision++;await h.click('확인하고 식사 저장');assert.equal(h.db.meals.length,0);assert.equal(h.cache.size,0);assert.match(h.text(),/다른 화면에서/);assert.ok(h.find('button','최신 조합 목록 불러오기'));
});
test('account switch cancels old reads and does not expose remembered portions',async()=>{
 const wait=deferred();const h=harness({run:call=>call.table==='meal_combinations'?wait.promise:undefined});const opening=h.panel.open();await flush();h.setUser(null);assert.equal(h.dialog.open,false);wait.resolve({data:[recipe()],error:null});await opening;assert.doesNotMatch(h.text(),/검증용 볶음밥/);assert.equal(h.dialog.open,false);
});
test('closing an initial read prevents late results from repopulating the dialog',async()=>{
 const wait=deferred();const h=harness({run:call=>call.table==='meal_combinations'?wait.promise:undefined});const opening=h.panel.open();await flush();await h.click('닫기');wait.resolve({data:[recipe()],error:null});await opening;assert.equal(h.dialog.open,false);assert.doesNotMatch(h.text(),/검증용 볶음밥/);
});

test('opening before sync finishes shows a retry instead of an endless loading message',async()=>{
 let ready=false;const h=harness({prepare:async()=>{if(!ready)throw Error('먼저 기존 기록 동기화를 마친 뒤 다시 열어 주세요.');}});
 await h.open();assert.equal(h.calls.length,0);assert.doesNotMatch(h.text(),/불러오는 중/);assert.ok(h.find('button','조합 다시 불러오기'));ready=true;
 await h.click('조합 다시 불러오기');assert.ok(h.find('button','검증용 볶음밥 다시 기록'));assert.equal(h.db.meals.length,0);
});

const coachDraft=()=>({version:1,request_id:randomUUID(),combination_id:recipe().id,revision:0,day:'2026-11-07',meal_type:'저녁',mode:'servings',quantity:.5});
test('coach draft seeds date and servings, confirms once and reopens the existing record',async()=>{
 const h=harness(),draft=coachDraft(),source=JSON.stringify(h.db.combos);await h.panel.openDraft(draft);
 assert.equal(h.field('기록 날짜').value,'2026-11-07');assert.equal(h.field('식사 종류').value,'저녁');assert.equal(Number(h.field('밥 이번 양 (g)').value),100);assert.equal(h.writes,0);
 await h.click('식사 저장 전 확인');await h.click('확인하고 식사 저장');assert.equal(h.db.meals[0].id,draft.request_id);assert.equal(h.db.meals[0].meal_date,'2026-11-07');assert.equal(h.db.meals[0].foods[1].grams,25);assert.equal(h.writes,1);assert.equal(JSON.stringify(h.db.combos),source);
 h.db.combos[0].revision++;h.db.meals[0].foods[1].grams=30;await h.panel.openDraft(draft);assert.match(h.text(),/이미 기록한 식사/);assert.match(h.text(),/30g/);assert.equal(h.find('button','식사 저장 전 확인'),undefined);assert.equal(h.writes,1);
});

test('old or malformed coach drafts cannot bypass source-version checks',async()=>{
 const h=harness(),draft=coachDraft();h.db.combos[0].revision++;await h.panel.openDraft(draft);assert.match(h.text(),/대화 이후 조합이 바뀌었어요/);assert.equal(h.find('button','식사 저장 전 확인'),undefined);assert.equal(h.writes,0);
 for(const patch of [{request_id:'bad'},{combination_id:'other'},{revision:-1},{quantity:Infinity},{quantity:'0.5'},{meal_type:'임의끼니'}])assert.throws(()=>h.panel.openDraft({...draft,...patch}),/초안 정보를/);
});

test('reopening a coach draft in another tab still shares the same record request',async()=>{
 const db={combos:[recipe()],memories:[],meals:[],receipts:{}},draft=coachDraft(),first=harness({database:db}),second=harness({database:db});
 await first.panel.openDraft(draft);await second.panel.openDraft(draft);await first.click('식사 저장 전 확인');await second.click('식사 저장 전 확인');await first.click('확인하고 식사 저장');await second.click('확인하고 식사 저장');assert.equal(db.meals.length,1);assert.equal(db.meals[0].id,draft.request_id);assert.match(second.text(),/서버 저장을 확인/);
});
