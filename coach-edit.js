import {koreaDay, validDay} from './coach-core.js';

const key = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
const nutrients = ['calories', 'carbs', 'protein', 'fat'];
const guidance = '아직 수정하지 않았어요. 예: “오늘 점심 계란후라이를 50g으로 수정해줘”. 식사와 같은 구성의 저장 조합도 함께 수정해요. 한쪽만 바꾸려면 “식사만” 또는 “조합만”이라고 알려 주세요.';
export const editHelp = (reply = guidance, pending = null) => ({reply, mode:'음식 양 수정 안내', warnings:[], evidence:[], suggestions:[], record_edit:{status:'needs_details'}, edit_pending:pending});

export function editRequest(question, selectedDate, today = koreaDay()) {
  const text = question.normalize('NFKC').trim();
  if (!/수정|변경|조정|바꿔|바꾸|고쳐|고치|줄여|줄이|늘려|늘리/.test(text)) return null;
  if (/하지\s*마|하지\s*않|말고|취소|나중에|다음에|만약|한다면|하면|방법|어떻게|추천|제안/.test(text)) return editHelp();
  const command = /(?:(?:수정|변경|조정)\s*해|바꿔|고쳐|줄여|늘려)\s*(?:줘요?|주세요|줄래요?|주실래요?)(?=[.!?。！？\s]|$)/;
  if (!command.test(text)) return editHelp();
  const dates = text.match(/\d{4}-\d{1,2}-\d{1,2}/g) || [];
  const relative = [...new Set(text.match(/오늘|어제/g) || [])];
  if (dates.length > 1 || relative.length > 1 || dates.length && relative.length || /그제|지난|내일|모레|\d+월|\d+일\s*전/.test(text)) return editHelp();
  const day = dates[0] || (relative[0] === '어제' ? new Date(Date.parse(today)-86400000).toISOString().slice(0,10) : relative[0] === '오늘' ? today : selectedDate);
  if (!validDay(day) || day > today || day < '2000-01-01') return editHelp();
  const types = [...new Set(text.match(/아침|점심|저녁|간식/g) || [])];
  if (types.length > 1) return editHelp('수정할 끼니 하나를 지정해 주세요. 아직 수정하지 않았어요.');
  const quantityPattern = /(-?\d+(?:\.\d+)?|한|두|세|네|반)\s*(킬로그램|그램|밀리리터|리터|kg|mL|ml|g|L|알|개|인분|공기|팩|잔|줄|조각)(?:으로|로)?/g;
  const quantities = [...text.replace(/\d{4}-\d{1,2}-\d{1,2}/g,'').matchAll(quantityPattern)];
  const relativeAmount = /절반|반만|두\s*배/.test(text);
  if (quantities.length !== 1 || relativeAmount) return editHelp('변경할 최종 양 하나를 알려 주세요. 예: “오늘 점심 계란후라이를 50g으로 수정해줘”. 아직 수정하지 않았어요.');
  const token = [...text.matchAll(quantityPattern)].at(-1);
  let amount = ({한:1,두:2,세:3,네:4,반:0.5})[token[1]] ?? Number(token[1]);
  let unit = ({킬로그램:'kg',그램:'g',밀리리터:'mL',리터:'L',ml:'mL',알:'개'})[token[2]] || token[2];
  if (unit === 'kg' || unit === 'L') {amount *= 1000; unit = unit === 'kg' ? 'g' : 'mL';}
  if (!Number.isFinite(amount) || amount < 0.001 || amount > 100000) return editHelp('수정할 양은 0보다 큰 값으로 알려 주세요. 아직 수정하지 않았어요.');
  let prefix = text.slice(0,token.index).trim();
  let comboName = null;
  const quoted = text.match(/[“‘"']([^“”‘’"']{1,80})[”’"']\s*조합/);
  const named = quoted || text.match(/저장한\s+([^,.!?\n]{1,80}?)\s*조합/) || text.match(/([^\s,.!?]{1,80})\s+조합/);
  if (named && !['저장한','저장된','내','그','연결된','식사'].includes(named[1])) {
    comboName = named[1].trim();
    prefix = prefix.replace(named[0],'조합');
  }
  const onlyMeal = /(?:식사|기록|아침|점심|저녁|간식)(?:\s*기록)?\s*만/.test(text);
  const onlyCombo = /조합\s*만/.test(text);
  if (onlyMeal && onlyCombo) return editHelp();
  const scope = onlyMeal ? 'meal' : onlyCombo ? 'combination' : 'both';
  if (scope === 'combination' && !comboName) return editHelp('어떤 저장 조합을 수정할지 이름을 알려 주세요. 예: “시오콘부볶음밥 조합만 계란후라이를 50g으로 수정해줘”. 아직 수정하지 않았어요.');
  prefix = prefix.replace(/\d{4}-\d{1,2}-\d{1,2}/g,' ').replace(/[“”‘’"',]/g,' ');
  const context = /^(?:(?:응|네|그럼|그러면|그리고|오늘|어제|방금|마지막|최근에|아침|점심|저녁|간식|식사|기록|음식|저장한|저장된|연결된|내|그|조합|둘\s*다|모두|함께|같이)(?:으로|에서|에는|에도|이랑|하고|랑|의|에|도|만|을|를|과|와)?(?:\s+|$))+/;
  prefix = prefix.replace(context,'').replace(/\s*양(?:을|은|도)?\s*$/,'').replace(/(?:을|를|은|는|도)\s*$/,'').trim();
  if (!prefix || prefix.length > 200 || /기록|조합|\s(?:그리고|와|과|랑)|빼|제외|추가|먹은|저장한/.test(prefix)) return editHelp();
  // A suffix may specify the other destination, but never a second food/change.
  const suffix = text.slice(token.index+token[0].length).replace(command,'').replace(named?.[0] || /$^/,'').replace(/[.!?。！？,]/g,'').replace(/\s/g,'');
  if (suffix && !/^(?:식사|점심|아침|저녁|간식|기록|저장한|저장된|연결된|내|그|조합|도|만|을|를|과|와|이랑|랑|하고|둘다|모두|함께|같이|으로|로)*$/.test(suffix)) return editHelp();
  return {day,mealType:types[0]||null,latest:/방금|마지막/.test(text),food:prefix,amount,unit,comboName,scope,requireCombo:scope==='combination'||/조합/.test(text)};
}

function foodMatches(food, query, catalog) {
  const name = key(food.name?.split(' · ')[0]), q = key(query);
  if (name === q) return true;
  if (catalog.some(f=>key(f.name)===name && (f.aliases||[]).some(alias=>key(alias)===q))) return true;
  const fried = ['계란후라이','계란프라이','달걀후라이','달걀프라이'];
  return fried.includes(name) && fried.includes(q);
}
const foodUnit = food => ({ml:'mL'})[food.unit] || food.unit || food.barcodeProduct?.unit || 'g';
function amountFor(food, request, catalog) {
  const unit = foodUnit(food);
  if (unit === request.unit) return request.amount;
  if (['g','mL'].includes(request.unit)) throw Error(`이 음식은 ${unit} 단위로 기록되어 있어요. 같은 단위의 양을 알려 주세요.`);
  const candidates = catalog.filter(f => key(f.name)===key(food.name) && (f.unit||'g')===unit);
  const values = new Set();
  for (const entry of candidates) for (const [label,value] of entry.portions||[]) {
    const normalized = String(label).replace(/\s/g,'').replace('알','개');
    if (normalized === '1'+request.unit && Number(value)>0) values.add(Number(value));
  }
  if (values.size!==1) throw Error(`이 음식의 ${request.unit}당 중량을 확인할 수 없어요. ${unit} 단위로 수정할 양을 알려 주세요.`);
  const amount=request.amount*[...values][0];
  if (!Number.isFinite(amount)||amount<0.001||amount>100000) throw Error('변경할 양을 확인해 주세요.');
  return amount;
}
function recipe(foods) {
  return JSON.stringify((foods||[]).map(f=>[key(f.name),key(f.manualBrand||f.barcodeProduct?.maker),foodUnit(f),Number(f.grams),...nutrients.map(n=>f[n]==null?null:Number(f[n]))]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
}
function choicesReply(request, selectedDate, choices, message) {
  const offered=choices.slice(0,10);
  return editHelp(message+' 아직 수정하지 않았어요.\n'+offered.map((c,i)=>`${i+1}. ${c.label}`).join('\n')+'\n원하는 번호를 “선택 1”처럼 답해 주세요.',{version:1,request,selected_date:selectedDate,created_at:new Date().toISOString(),choices:offered});
}
export function editChoice(question, messages, selectedDate, now=Date.now()) {
  const match=question.trim().match(/^(?:선택\s*)?([1-9]|10)(?:번)?[.!\s]*$/);
  if (!match) return null;
  const latest=messages.find(m=>m.role==='assistant');
  const pending=latest?.metadata?.edit_pending;
  if (!pending) return null;
  const age=now-Date.parse(pending.created_at);
  if (pending.version!==1 || pending.selected_date!==selectedDate || !Number.isFinite(age) || age<0 || age>15*60*1000) return editHelp('수정 대상 확인 시간이 지났거나 날짜가 바뀌었어요. 수정 요청을 다시 알려 주세요. 아직 수정하지 않았어요.');
  const choice=pending.choices?.[Number(match[1])-1];
  if (!choice) return editHelp('안내된 선택 번호로 다시 요청해 주세요. 아직 수정하지 않았어요.');
  return {...pending.request,...choice.selection};
}

// The resolver sees only rows obtained using the authenticated user's session.
// All writes are revalidated atomically in the database using these snapshots.
export function resolveEdit(request, meals, combinations, catalog, selectedDate) {
  if (meals.length>100 || combinations.length>500) return editHelp('대상 기록이 많아요. 끼니와 조합 이름을 지정해 주세요. 아직 수정하지 않았어요.');
  let meal=null, mealIndex=null, combo=null, comboIndex=null;
  if (request.scope!=='combination') {
    let rows=meals.filter(m=>m.meal_date===request.day && (!request.mealType||m.meal_type===request.mealType));
    if (request.latest) rows=rows.slice().sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,1);
    let candidates=rows.flatMap(m=>(m.foods||[]).map((f,i)=>({row:m,index:i,food:f})).filter(c=>foodMatches(c.food,request.food,catalog)));
    if (request.mealId) candidates=candidates.filter(c=>c.row.id===request.mealId && c.index===request.mealIndex);
    if (!candidates.length) return editHelp(`${request.day} ${request.mealType||''} 기록에서 “${request.food}”을 찾지 못했어요. 음식 이름과 날짜를 확인해 주세요. 아직 수정하지 않았어요.`);
    if (candidates.length>1) return choicesReply(request,selectedDate,candidates.map(c=>({label:`${c.row.meal_type} · ${c.row.meal_time ? new Date(c.row.meal_time).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'}) : '시간 미입력'} · ${c.food.name} ${c.food.grams}${foodUnit(c.food)} (음식 ${c.index+1})`,selection:{mealId:c.row.id,mealIndex:c.index}})),'같은 음식이 여러 식사 기록에 있어요. 어느 기록을 수정할까요?');
    meal=candidates[0].row; mealIndex=candidates[0].index;
  }
  if (request.scope!=='meal') {
    let candidates=combinations.filter(c=>c.approved_at && (request.comboName?key(c.name)===key(request.comboName):meal && c.meal_type===meal.meal_type && recipe(c.foods)===recipe(meal.foods)));
    if (request.comboId) candidates=candidates.filter(c=>c.id===request.comboId);
    if (!candidates.length && (request.requireCombo||request.comboId)) return editHelp('함께 수정할 저장 조합을 찾지 못했어요. 조합 이름을 지정하거나 “식사만”이라고 요청해 주세요. 아직 어느 쪽도 수정하지 않았어요.');
    if (candidates.length>1) return choicesReply({...request,mealId:meal?.id,mealIndex},selectedDate,candidates.map(c=>({label:c.name,selection:{comboId:c.id}})),'함께 수정할 조합이 여러 개예요. 어떤 조합을 수정할까요?');
    combo=candidates[0]||null;
    if (combo) {
      let matches=combo.foods.map((food,index)=>({food,index})).filter(c=>foodMatches(c.food,request.food,catalog));
      if (request.comboIndex!=null) matches=matches.filter(c=>c.index===request.comboIndex);
      if (!matches.length) return editHelp(`“${combo.name}” 조합에 “${request.food}”이 없어 수정하지 않았어요.`);
      if (matches.length>1) return choicesReply({...request,mealId:meal?.id,mealIndex,comboId:combo.id},selectedDate,matches.map(c=>({label:`${combo.name} · 음식 ${c.index+1} · ${c.food.name} ${c.food.grams}${foodUnit(c.food)}`,selection:{comboIndex:c.index}})),'조합에 같은 음식이 여러 개예요. 어떤 항목을 수정할까요?');
      comboIndex=matches[0].index;
    }
  }
  try {
    return {
      meal:meal?{id:meal.id,index:mealIndex,amount:amountFor(meal.foods[mealIndex],request,catalog),expected:meal.foods}:null,
      combination:combo?{id:combo.id,index:comboIndex,amount:amountFor(combo.foods[comboIndex],request,catalog),expected:combo.foods,revision:combo.revision}:null,
      request
    };
  } catch (error) {return editHelp(error.message+' 아직 어느 쪽도 수정하지 않았어요.');}
}
