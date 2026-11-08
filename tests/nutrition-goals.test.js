import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {compose} from '../coach-core.js';
const core=readFileSync(new URL('../nutrition-goals-core.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('../nutrition-goals.js',import.meta.url),'utf8');
const context={};runInNewContext(core,context);const C=context.MealLogNutritionCore;
const plain=value=>JSON.parse(JSON.stringify(value));
const flush=async()=>{for(let i=0;i<35;i++)await Promise.resolve();};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

test('nutrition goals are optional, validate bounds and retain existing protein targets',()=>{
 assert.deepEqual(plain(C.goals({protein_goal:80})),{carbs:null,protein:80,fat:null});
 assert.deepEqual(plain(C.payload({carbs:'  ',protein:'80.5',fat:null})),{carbs_goal:null,protein_goal:80.5,fat_goal:null});
 for(const value of [0,-1,Infinity,NaN,true,{},'invalid',1001])assert.throws(()=>C.payload({carbs:value}));
 assert.throws(()=>C.payload({fat:501}));assert.throws(()=>C.payload({protein:501}));
 assert.deepEqual(plain(C.goals({carbs_goal:NaN,protein_goal:0,fat_goal:-1})),{carbs:null,protein:null,fat:null});
});

test('progress distinguishes remaining, exceeded, unset, zero and missing nutrients',()=>{
 const summary=C.summarize([{carbs:60,protein:50,fat:0},{carbs:20,protein:60,fat:0}],{carbs:200,protein:100,fat:50});
 assert.deepEqual(plain(summary.map(x=>[x.remaining,x.over,x.percent])),[[120,0,40],[0,10,110],[50,0,0]]);
 assert.equal(C.summarize([{protein:0}],{}).find(x=>x.key==='protein').goal,null);
 const partial=C.summarize([{carbs:20,protein:null,fat:5},{carbs:10,protein:15,fat:''}],{carbs:100,protein:100,fat:50});
 assert.deepEqual(plain(partial.map(x=>[x.consumed,x.missing,x.remaining,x.percent])),[[30,0,70,30],[15,1,null,null],[5,1,null,null]]);
 const unknown=C.summarize([{nutritionStatus:'unknown',carbs:500,protein:500,fat:500}],{carbs:200,protein:100,fat:50});
 assert.ok(unknown.every(x=>x.consumed===0&&x.missing===1&&x.percent===null));
});

test('AI coach uses shared macro targets and withholds comparisons for missing data',()=>{
 const ctx={kind:'today',day:'2026-11-08',settings:{carbs_goal:200,protein_goal:100,fat_goal:50},days:[{meal_date:'2026-11-08',meal_count:1,nutrients:{carbs:{value:60,missing:0},protein:{value:110,missing:0},fat:{value:5,missing:1}}}]};
 const answer=compose(ctx).reply;
 assert.match(answer,/탄수화물 목표 200g · 기록상 남은 양 140g/);assert.match(answer,/단백질 목표 100g · 기록상 목표보다 10g/);assert.match(answer,/지방 목표 50g · 영양정보가 빠져 있어 목표 비교를 보류/);assert.doesNotMatch(answer,/남은 양 45g/);
 const empty=compose({...ctx,days:[],kind:'protein'}).reply;assert.match(empty,/아직 식사 기록이 없어 목표 비교를 보류/);assert.doesNotMatch(empty,/남은 양/);
});

function harness({row={carbs_goal:200,protein_goal:100,fat_goal:50},run}={}){
 class Element {
  constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.events={};this.style={};this.textContent='';this.value='';this.disabled=false;this.open=false;}
  append(...nodes){this.children.push(...nodes);} after(...nodes){body.append(...nodes);} replaceChildren(...nodes){this.children=nodes;}
  setAttribute(k,v){this.attrs[k]=v;} addEventListener(k,fn){(this.events[k]??=[]).push(fn);} showModal(){this.open=true;} close(){this.open=false;} reportValidity(){return true;} click(){this.onclick?.();}
 }
 let user={id:'owner'},db=row==null?null:{...row},failure=null;const calls=[],events={};
 const body=new Element('body'),summary=new Element('section'),settings=new Element('dialog'),settingsBody=new Element('div'),account=new Element('button');settings.append(settingsBody);body.append(summary,settings,account);
 const document={body,visibilityState:'visible',createElement:tag=>new Element(tag),querySelector:s=>({'.summary':summary,'#settingsDialog':settings,'#settingsDialog .settingsBody':settingsBody,'#accountBtn':account}[s]),addEventListener(){}};
 const ctx={document,Intl,Date,Event,AbortController,setTimeout,clearTimeout,state:{meals:[{time:'2026-11-08T12:00:00',foods:[{carbs:60,protein:20,fat:10}]}]},selectedDate:'2026-11-08',addEventListener(k,fn){(events[k]??=[]).push(fn);},dispatchEvent(e){for(const fn of events[e.type]||[])fn(e);}};ctx.window=ctx;
 const client={from(table){assert.equal(table,'ai_coach_settings');const call={kind:'read',filters:{}};
  const q={select(){return q;},eq(k,v){call.filters[k]=v;return q;},is(k,v){call.filters[k]=v;return q;},maybeSingle(){return q;},abortSignal(signal){call.signal=signal;return q;},update(values){call.kind='update';call.values=values;return q;},insert(values){call.kind='insert';call.values=values;return q;},then(a,b){calls.push(call);return Promise.resolve().then(async()=>{
   const custom=await run?.(call);if(custom!==undefined)return custom;if(failure&&call.kind!=='read')return {data:null,error:failure};
   if(call.kind==='read')return {data:db?{...db}:null,error:null};
   assert.equal(call.kind==='insert'?call.values.user_id:call.filters.user_id,user?.id);
   if(call.kind==='insert'&&db)return {data:null,error:{code:'23505'}};
   if(call.kind==='update'&&(!db||Object.entries(call.filters).some(([k,v])=>k!=='user_id'&&db[k]!==v)))return {data:null,error:null};
   db={...db,...plain(call.values)};return {data:{...db},error:null};
  }).then(a,b);}};return q;
 }};
 runInNewContext(core,ctx);runInNewContext(ui,ctx);const panel=ctx.MealLogNutritionGoals.mount({client,getUser:()=>user});
 const all=()=>{const result=[];function visit(e){result.push(e);for(const child of e.children)visit(child);}visit(body);return result;};
 const find=(tag,text)=>all().find(e=>e.tag===tag&&(text==null||e.textContent===text));
 const dialog=all().find(e=>e.attrs['aria-label']==='영양 목표 설정');
 return {ctx,calls,panel,dialog,find,all,get db(){return db;},setDb(value){db=value;},setFailure(value){failure=value;},
  async open(){await flush();await find('button',db&&Object.values(db).some(v=>typeof v==='number')?'목표 수정':'목표 설정').onclick();await flush();},
  input(key){return all().find(e=>e.attrs['aria-label']===({carbs:'탄수화물',protein:'단백질',fat:'지방'}[key]+' 목표 g'));},
  async save(){await find('form').onsubmit({preventDefault(){}});await flush();},
  setUser(value){user=value;panel.accountChanged();},text(){return all().map(e=>e.textContent).join('\n');}
 };
}

test('home progress follows selected day, caps visual bar and preserves actual exceeded values',async()=>{
 const h=harness();await flush();assert.match(h.text(),/140g 남음/);assert.match(h.text(),/80g 남음/);
 h.ctx.state.meals[0].foods[0].protein=110;h.ctx.MealLogNutritionGoals.render();assert.match(h.text(),/목표보다 10g/);
 const bar=h.all().find(e=>e.attrs['aria-label']==='단백질 목표 대비 기록량');assert.equal(bar.attrs['aria-valuenow'],'100');assert.match(bar.attrs['aria-valuetext'],/110%/);
 h.ctx.selectedDate='2026-11-07';h.ctx.MealLogNutritionGoals.render();assert.match(h.text(),/아직 식사 기록이 없어요/);assert.doesNotMatch(h.text(),/140g 남음/);
});

test('goal save updates only owned targets, retains AI settings, and reloads confirmed values',async()=>{
 const h=harness({row:{carbs_goal:null,protein_goal:80,fat_goal:null,use_external_ai:true,use_food_memory:false}});await h.open();
 assert.equal(h.input('protein').value,80);h.input('carbs').value='200';h.input('protein').value='90.5';h.input('fat').value='50';await h.save();
 assert.equal(h.db.carbs_goal,200);assert.equal(h.db.protein_goal,90.5);assert.equal(h.db.fat_goal,50);assert.equal(h.db.use_external_ai,true);assert.equal(h.db.use_food_memory,false);
 const write=h.calls.find(c=>c.kind==='update');assert.deepEqual(plain(write.filters),{user_id:'owner',carbs_goal:null,protein_goal:80,fat_goal:null});assert.equal('use_external_ai' in write.values,false);
 assert.equal(h.dialog.open,false);assert.match(h.text(),/70.5g 남음/);await h.open();assert.equal(h.input('protein').value,90.5);
});

test('new user targets can be inserted and empty values can clear targets without changing meals',async()=>{
 const h=harness({row:null});const meals=JSON.stringify(h.ctx.state.meals);await h.open();h.input('protein').value='75';await h.save();
 assert.equal(h.calls.find(c=>c.kind==='insert').values.user_id,'owner');assert.equal(h.db.protein_goal,75);
 await h.open();h.input('protein').value='';await h.save();assert.equal(h.db.protein_goal,null);assert.equal(h.db.carbs_goal,null);assert.equal(h.db.fat_goal,null);assert.equal(JSON.stringify(h.ctx.state.meals),meals);
});

test('stale goals and failed writes preserve input and never report success',async()=>{
 const h=harness();await h.open();h.input('protein').value='120';h.setDb({carbs_goal:200,protein_goal:90,fat_goal:50});await h.save();
 assert.equal(h.db.protein_goal,90);assert.equal(h.input('protein').value,'120');assert.equal(h.dialog.open,true);assert.match(h.text(),/다른 화면이나 기기/);
 const offline=harness();await offline.open();offline.input('fat').value='60';offline.setFailure({code:'NETWORK'});await offline.save();
 assert.equal(offline.db.fat_goal,50);assert.equal(offline.input('fat').value,'60');assert.match(offline.text(),/저장 결과를 확인하지 못/);assert.doesNotMatch(offline.text(),/목표를 저장했어요/);
});

test('account switch hides previous goals, closes editor and rejects late old responses',async()=>{
 const delayed=deferred();let wait=false;const h=harness({run:call=>wait&&call.kind==='read'?delayed.promise:undefined});await h.open();h.input('protein').value='125';wait=true;
 const refresh=h.panel.refresh();h.setDb(null);h.setUser(null);assert.equal(h.dialog.open,false);assert.equal(h.input('protein').value,'');assert.match(h.text(),/로그인 후 목표 설정/);
 delayed.resolve({data:{carbs_goal:999,protein_goal:400,fat_goal:400},error:null});await refresh;await flush();assert.doesNotMatch(h.text(),/999g|400g/);
});

test('shared coach goal event refreshes home without replacing an open form draft',async()=>{
 const h=harness();await h.open();h.input('carbs').value='190';h.setDb({carbs_goal:200,protein_goal:85,fat_goal:50});h.ctx.dispatchEvent(new Event('meallog:nutrition-goals'));await flush();
 assert.equal(h.input('carbs').value,'190');assert.match(h.text(),/65g 남음/);await h.save();assert.match(h.text(),/다른 화면이나 기기/);
});

test('initial goal read can be closed immediately and unknown nutrients suspend only their comparisons',async()=>{
 const delay=deferred();let pending=false;const h=harness({run:c=>pending&&c.kind==='read'?delay.promise:undefined});await flush();pending=true;
 h.find('button','목표 수정').onclick();await flush();h.find('button','닫기').onclick();assert.equal(h.dialog.open,false);
 delay.resolve({data:{carbs_goal:200,protein_goal:100,fat_goal:50},error:null});await flush();assert.equal(h.dialog.open,false);
 h.ctx.state.meals[0].foods[0].protein=null;h.ctx.MealLogNutritionGoals.render();assert.match(h.text(),/목표 비교 보류/);assert.match(h.text(),/140g 남음/);
});
