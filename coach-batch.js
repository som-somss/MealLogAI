import {createHash} from 'node:crypto';
import {editRequest,editHelp,foodMatches,foodUnit,recipe,amountFor,choicesReply,resolveAddedFood} from './coach-edit.js';
import {koreaDay} from './coach-core.js';

const key=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/\s/g,'');
const help=message=>editHelp((message||'변경할 음식과 양을 각각 적어 주세요. 예: “오늘 점심 오이 100g과 바나나 50g을 추가하고, 마요네즈를 빼고, 계란후라이를 삶은 계란 한 알로 바꿔줘”.')+' 아직 어느 쪽도 수정하지 않았어요.');
const ending='(?:줘요?|주세요|줄래요?|주실래요?|주고)';
const actionPattern=new RegExp('(?:(추가|제거|삭제|제외|교체|대체|변경|수정|조정)\\s*(?:해\\s*'+ending+'|하고)|(넣어|빼|바꿔|고쳐|줄여|늘려)\\s*'+ending+'|(넣|빼|바꾸|고치|줄이|늘리)고)(?=[,.!?。！？;\\s]|$)','g');
const leading=/^(?:(?:응|네|그럼|그러면|그리고|오늘|어제|방금|마지막|최근에|아침|점심|저녁|간식|식사|기록|음식|저장한|저장된|연결된|내|그|조합|둘\s*다|모두|함께|같이|\d{4}-\d{1,2}-\d{1,2})(?:으로|에서|에는|에도|이랑|하고|랑|의|에|도|만|을|를|과|와)?(?:\s+|$))+/;
const clean=s=>s.trim().replace(/^[,.;!?。！？\s]*(?:그리고\s+)?/,'').trim();
function kindOf(match){const v=match[1]||match[2]||match[3];return /추가|넣/.test(v)?'add':/제거|삭제|제외|^빼$/.test(v)?'remove':'change';}

// Split only explicit edit verbs and explicit list separators; never ask a model
// to invent or silently discard operations. Every clause must parse successfully.
export function batchRequest(question,selectedDate,today=koreaDay()) {
 const text=question.normalize('NFKC').trim();
 const commands=[...text.matchAll(actionPattern)];
 if(!commands.length)return null;
 let cursor=0;const groups=commands.map(command=>{const body=clean(text.slice(cursor,command.index));cursor=command.index+command[0].length;return {body,command,kind:kindOf(command)};});
 const tail=text.slice(cursor);
 const named=text.match(/[“‘"']([^“”‘’"']{1,80})[”’"']\s*조합/)||text.match(/저장한\s+([^,.!?\n]{1,80}?)\s*조합/)||text.match(/([^\s,.!?]{1,80})\s+조합/);
 let first=groups[0].body;
 if(named && first.includes(named[0]))first=first.replace(named[0],'조합');
 const prefix=first.match(leading)?.[0]||'';
 groups[0].body=first.slice(prefix.length).trim();
 let contextPrefix=prefix;
 if(named && groups[0].body!==first && groups[0].body.indexOf(named[0])===-1 && prefix.includes('조합') && !tail.includes(named[0]))contextPrefix=prefix.replace('조합',named[0]);
 const pieces=[];
 for(const group of groups){
  const splitter=group.kind==='remove'?/[,;\n]+|\s+(?:그리고|및)\s+|(?:와|과|하고|이랑|랑)\s+/:/[,;\n]+|\s+(?:그리고|및)\s+|(?<=[0-9gLl개알분기팩잔줄각])(?:과|와|하고|이랑|랑)\s+/;
  for(const body of group.body.split(splitter).map(clean))pieces.push({body,kind:group.kind});
 }
 if(commands.length===1&&pieces.length===1)return null;
 if(pieces.length<2||pieces.length>10)return help('한 요청에서 최대 10개 변경을 처리할 수 있어요.');
 if(/하지\s*마|하지\s*않|넣지|빼지|말고|취소|나중에|다음에|만약|한다면|하면|방법|어떻게|추천|제안/.test(text)||commands.at(-1)[0].endsWith('고'))return help();
 const context=editRequest(contextPrefix+' 일괄대상 1g으로 수정해줘'+tail,selectedDate,today);
 if(!context||context.reply||context.food!=='일괄대상')return help('하나의 날짜·식사와 조합을 지정해 주세요. 여러 날짜나 끼니는 나눠 요청해 주세요.');
 const operations=[];
 for(const [i,piece] of pieces.entries()){
  const verb=piece.kind==='add'?'추가해줘':piece.kind==='remove'?'빼줘':'바꿔줘';
  const parsed=editRequest(piece.body+' '+verb,context.day,today);
  if(!parsed||parsed.reply||parsed.mealType||parsed.comboName||parsed.scope!=='both'||parsed.day!==context.day||parsed.latest||parsed.requireCombo||parsed.food.length>200)return help(`${i+1}번째 변경을 확인해 주세요. 음식마다 작업을 적고, 추가·교체·양 수정에는 양도 적어 주세요.`);
  operations.push({operation:parsed.operation||'resize',food:parsed.food,replacementFood:parsed.replacementFood,amount:parsed.amount,unit:parsed.unit});
 }
 const {food,amount,unit,...scope}=context;
 return {...scope,operation:'batch',operations,selections:{}};
}

const snapshot=(meal,combo)=>createHash('sha256').update(JSON.stringify([meal&&[meal.id,meal.foods],combo&&[combo.id,combo.foods,combo.revision]])).digest('hex');
function wrapChoice(result,batch,index,selectedDate){
 if(!result.edit_pending)return help(`${index+1}번째 변경: `+result.reply);
 const choices=result.edit_pending.choices.map(c=>({label:c.label,selection:{selections:{...batch.selections,[index]:{...batch.selections?.[index],...c.selection}}}}));
 return choicesReply(batch,selectedDate,choices,`${index+1}번째 변경을 확인해 주세요. 모든 변경은 선택을 마친 뒤 함께 저장해요.`);
}

export function resolveBatchEdit(request,meals,combinations,catalog,selectedDate){
 if(!Array.isArray(request.operations)||request.operations.length<2||request.operations.length>10||meals.length>100||combinations.length>500)return help();
 let meal=null,combo=null;
 const sources=request.operations.filter(o=>o.operation!=='add');
 if(request.scope!=='combination'){
  let rows=meals.filter(m=>m.meal_date===request.day&&(!request.mealType||m.meal_type===request.mealType));
  if(request.latest)rows=rows.slice().sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,1);
  rows=rows.filter(m=>sources.every(o=>m.foods.some(f=>foodMatches(f,o.food,catalog))));
  if(request.mealId)rows=rows.filter(m=>m.id===request.mealId);
  if(!rows.length)return help('변경할 기존 음식들이 함께 들어 있는 식사 기록을 찾지 못했어요. 날짜·끼니와 음식 이름을 확인해 주세요.');
  if(rows.length>1)return choicesReply(request,selectedDate,rows.map(m=>({label:`${m.meal_type} · ${m.meal_time?new Date(m.meal_time).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'}):'시간 미입력'} · ${m.foods.map(f=>f.name).join(' + ')}`,selection:{mealId:m.id}})),'여러 변경을 반영할 식사 기록을 선택해 주세요.');
  meal=rows[0];
 }
 if(request.scope!=='meal'){
  let rows=combinations.filter(c=>c.approved_at&&(request.comboName?key(c.name)===key(request.comboName):meal&&c.meal_type===meal.meal_type&&recipe(c.foods)===recipe(meal.foods)));
  if(request.comboId)rows=rows.filter(c=>c.id===request.comboId);
  if(!rows.length&&(request.requireCombo||request.comboId))return help('함께 수정할 조합을 찾지 못했어요. 조합 이름을 확인하거나 “식사만”이라고 요청해 주세요.');
  if(rows.length>1)return choicesReply({...request,mealId:meal?.id},selectedDate,rows.map(c=>({label:c.name,selection:{comboId:c.id}})),'여러 변경을 반영할 저장 조합을 선택해 주세요.');
  combo=rows[0]||null;
 }
 const state=snapshot(meal,combo);
 if(request.targetState&&request.targetState!==state)return help('선택하는 동안 식사나 조합이 바뀌었어요. 최신 기록에서 전체 요청을 다시 보내 주세요.');
 const batch={...request,mealId:meal?.id,comboId:combo?.id,targetState:state};
 const targets=[{row:meal,type:'meal',field:'mealIndex',operations:[],used:new Set()},{row:combo,type:'combination',field:'comboIndex',operations:[],used:new Set()}].filter(t=>t.row);
 for(const [i,op] of request.operations.entries()){
  const selection=request.selections?.[i]||{};let food=null;
  if(['add','replace'].includes(op.operation)){
   const result=resolveAddedFood({...op,...selection},catalog,selectedDate,op.operation==='replace'?op.replacementFood:op.food);
   if(result.reply)return wrapChoice(result,batch,i,selectedDate);
   food=result.food;
  }
  for(const target of targets){
   const plan={operation:op.operation};
   if(op.operation!=='add'){
    let candidates=target.row.foods.map((f,index)=>({food:f,index})).filter(c=>foodMatches(c.food,op.food,catalog));
    if(selection[target.field]!=null)candidates=candidates.filter(c=>c.index===selection[target.field]);
    if(!candidates.length)return help(`${i+1}번째 변경: ${target.type==='meal'?'식사 기록':'저장 조합'}에서 “${op.food}”을 찾지 못했어요.`);
    if(candidates.length>1){
     const result=choicesReply(op,selectedDate,candidates.map(c=>({label:`${target.type==='meal'?'식사 기록':target.row.name} · 음식 ${c.index+1} · ${c.food.name} ${c.food.grams}${foodUnit(c.food)}`,selection:{[target.field]:c.index}})),'항목 선택');
     return wrapChoice(result,batch,i,selectedDate);
    }
    plan.index=candidates[0].index;
    if(target.used.has(plan.index))return help('같은 음식 항목에 변경이 두 번 지정됐어요. 항목마다 최종 변경 하나만 요청해 주세요.');
    target.used.add(plan.index);
    if(op.operation==='resize'){
     try{plan.amount=amountFor(candidates[0].food,op,catalog);}catch(error){return help(`${i+1}번째 변경: `+error.message);}
    }
   }
   if(food)plan.food=food;
   target.operations.push(plan);
  }
 }
 for(const target of targets){
  const count=target.row.foods.length+target.operations.filter(o=>o.operation==='add').length-target.operations.filter(o=>o.operation==='remove').length;
  if(count<1||count>(target.type==='meal'?100:8))return help('모든 변경을 반영한 뒤에도 식사는 1~100개, 조합은 1~8개의 음식이 있어야 해요. 변경 목록을 조정해 주세요.');
 }
 const target=type=>{const t=targets.find(t=>t.type===type);return t?{id:t.row.id,expected:t.row.foods,operations:t.operations,...(type==='combination'?{revision:t.row.revision}:{})}:null;};
 return {operation:'batch',meal:target('meal'),combination:target('combination'),request:batch};
}
