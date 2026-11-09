import {koreaDay, validDay} from './coach-core.js';

const key = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
const nutrients = ['calories', 'carbs', 'protein', 'fat'];
const guidance = '아직 수정하지 않았어요. 예: “오늘 점심 계란후라이를 50g으로 수정해줘”. 식사와 같은 구성의 저장 조합도 함께 수정해요. 한쪽만 바꾸려면 “식사만” 또는 “조합만”이라고 알려 주세요.';
export const editHelp = (reply = guidance, pending = null) => ({reply, mode:'음식 수정 안내', warnings:[], evidence:[], suggestions:[], record_edit:{status:'needs_details'}, edit_pending:pending});

export function editRequest(question, selectedDate, today = koreaDay()) {
  const replacement=replacementRequest(question,selectedDate,today);
  if (replacement) return replacement;
  const change=foodChangeRequest(question,selectedDate,today);
  return change || resizeRequest(question,selectedDate,today);
}

function replacementRequest(question, selectedDate, today) {
  const text=question.normalize('NFKC').trim();
  if (!/교체|대체|바꿔|바꾸|변경|수정/.test(text)) return null;
  const help=()=>editHelp('바꿀 음식과 새 음식의 양을 알려 주세요. 예: “오늘 점심 계란후라이를 오이 100g으로 바꿔줘”. 기존 음식 항목 전체를 교체해요. 아직 어느 쪽도 수정하지 않았어요.');
  const command=/(?:바꿔|(?:교체|대체|변경|수정)\s*해)\s*(?:줘요?|주세요|줄래요?|주실래요?)(?=[.!?。！？\s]|$)/g;
  const commands=[...text.matchAll(command)];
  const prefix=text.slice(0,commands[0]?.index??text.length).trim();
  const parts=prefix.match(/^(.*?)(?:[을를]\s+|\s+대신\s+)(.+)$/);
  if (!parts) return /교체|대체|대신/.test(text)?help():null;
  // A quantity immediately after the source particle is an ordinary resize.
  if (/^(?:-?\d+(?:\.\d+)?|한|두|세|네|반)\s*(?:킬로그램|그램|밀리리터|리터|kg|mL|ml|g|L|알|개|인분|공기|팩|잔|줄|조각)(?:으로|로)?(?:\s|$)/.test(parts[2])) return null;
  if (commands.length!==1 || /하지\s*마|하지\s*않|말고|취소|나중에|다음에|만약|한다면|하면|방법|어떻게|추천|제안|추가|넣어|빼|제거|삭제|제외/.test(text)) return help();
  const suffix=text.slice(commands[0].index+commands[0][0].length);
  const source=resizeRequest(parts[1]+' 1g으로 수정해줘'+suffix,selectedDate,today);
  const destination=resizeRequest(parts[2]+' 수정해줘',selectedDate,today);
  if (!source || source.reply || !destination || destination.reply) return help();
  if ([source.food,destination.food].some(f=>/전체|전부|모든|대신|\s(?:및|하고|이랑)|와\s|과\s|,|\+|\//.test(f)) || destination.comboName || destination.mealType) return help();
  return {...source,operation:'replace',replacementFood:destination.food,amount:destination.amount,unit:destination.unit};
}

function foodChangeRequest(question, selectedDate, today) {
  const text=question.normalize('NFKC').trim();
  if (!/추가|넣어|넣지|빼|빼지|빼주|제거|삭제|제외/.test(text)) return null;
  const help=()=>editHelp('추가하거나 뺄 음식 하나를 알려 주세요. 예: “오늘 점심 오이를 100g 추가해줘”, “오늘 점심 마요네즈를 빼줘”. 같은 구성의 저장 조합도 함께 반영해요. 아직 수정하지 않았어요.');
  if (/하지\s*마|하지\s*않|넣지|빼지|말고|취소|나중에|다음에|만약|한다면|하면|방법|어떻게|추천|제안/.test(text)) return help();
  const add=/(?:(?:추가)\s*해|넣어)\s*(?:줘요?|주세요|줄래요?|주실래요?)(?=[.!?。！？\s]|$)/g;
  const remove=/(?:(?:제거|삭제|제외)\s*해|빼)\s*(?:줘요?|주세요|줄래요?|주실래요?)(?=[.!?。！？\s]|$)/g;
  const adding=[...text.matchAll(add)],removing=[...text.matchAll(remove)];
  if (adding.length+removing.length!==1) return help();
  const operation=adding.length?'add':'remove',command=(adding[0]||removing[0]);
  const quantity=/(-?\d+(?:\.\d+)?|한|두|세|네|반)\s*(킬로그램|그램|밀리리터|리터|kg|mL|ml|g|L|알|개|인분|공기|팩|잔|줄|조각)/;
  const prefix=text.slice(0,command.index).trim();
  if (operation==='remove' && quantity.test(prefix.replace(/\d{4}-\d{1,2}-\d{1,2}/g,''))) return editHelp('음식을 통째로 빼려면 “마요네즈를 빼줘”, 양을 줄이려면 남길 최종 양으로 “마요네즈를 2g으로 수정해줘”라고 알려 주세요. 아직 수정하지 않았어요.');
  if (operation==='add' && !quantity.test(prefix)) return editHelp('추가할 양도 알려 주세요. 예: “오늘 점심 오이를 100g 추가해줘”. 아직 수정하지 않았어요.');
  const transformed=prefix+(operation==='remove'?' 1g으로':'')+' 수정해줘'+text.slice(command.index+command[0].length);
  const parsed=resizeRequest(transformed,selectedDate,today);
  if (!parsed || parsed.reply) return parsed || help();
  if (/전체|전부|모든|\s(?:및|하고|이랑)|와\s|과\s|,|\+|\//.test(parsed.food)) return help();
  return {...parsed,operation,...(operation==='remove'?{amount:null,unit:null}:{})};
}

function resizeRequest(question, selectedDate, today) {
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

export function foodMatches(food, query, catalog) {
  const name = key(food.name?.split(' · ')[0]), q = key(query);
  if (name === q) return true;
  if (catalog.some(f=>key(f.name)===name && (f.aliases||[]).some(alias=>key(alias)===q))) return true;
  const fried = ['계란후라이','계란프라이','달걀후라이','달걀프라이'];
  return fried.includes(name) && fried.includes(q);
}
export const foodUnit = food => ({ml:'mL'})[food.unit] || food.unit || food.barcodeProduct?.unit || 'g';
export function amountFor(food, request, catalog) {
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
export function recipe(foods) {
  return JSON.stringify((foods||[]).map(f=>[key(f.name),key(f.manualBrand||f.barcodeProduct?.maker),foodUnit(f),Number(f.grams),...nutrients.map(n=>f[n]==null?null:Number(f[n]))]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
}
export function choicesReply(request, selectedDate, choices, message) {
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
  const adding=request.operation==='add',removing=request.operation==='remove',replacing=request.operation==='replace';
  const resizing=!adding&&!removing&&!replacing;
  let addedFood=null;
  if (adding || replacing) {
    const selection=resolveAddedFood(request,catalog,selectedDate,replacing?request.replacementFood:request.food);
    if (selection.reply) return selection;
    addedFood=selection.food;
  }
  let meal=null, mealIndex=null, combo=null, comboIndex=null;
  if (request.scope!=='combination') {
    let rows=meals.filter(m=>m.meal_date===request.day && (!request.mealType||m.meal_type===request.mealType));
    if (request.latest) rows=rows.slice().sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,1);
    let candidates=adding?rows.map(m=>({row:m,index:null})):rows.flatMap(m=>(m.foods||[]).map((f,i)=>({row:m,index:i,food:f})).filter(c=>foodMatches(c.food,request.food,catalog)));
    if (request.mealId) candidates=candidates.filter(c=>c.row.id===request.mealId && c.index===request.mealIndex);
    if (!candidates.length) return editHelp(adding?`${request.day} ${request.mealType||''}에 추가할 기존 식사 기록을 찾지 못했어요. 날짜와 끼니를 확인해 주세요. 아직 수정하지 않았어요.`:`${request.day} ${request.mealType||''} 기록에서 “${request.food}”을 찾지 못했어요. 음식 이름과 날짜를 확인해 주세요. 아직 수정하지 않았어요.`);
    if (candidates.length>1) return choicesReply(request,selectedDate,candidates.map(c=>({label:`${c.row.meal_type} · ${c.row.meal_time ? new Date(c.row.meal_time).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'}) : '시간 미입력'} · ${adding?c.row.foods.map(f=>f.name).join(' + '):`${c.food.name} ${c.food.grams}${foodUnit(c.food)} (음식 ${c.index+1})`}`,selection:{mealId:c.row.id,mealIndex:c.index}})),'수정할 식사 항목이 여러 개예요. 어느 기록을 수정할까요?');
    meal=candidates[0].row; mealIndex=candidates[0].index;
  }
  if (request.scope!=='meal') {
    let candidates=combinations.filter(c=>c.approved_at && (request.comboName?key(c.name)===key(request.comboName):meal && c.meal_type===meal.meal_type && recipe(c.foods)===recipe(meal.foods)));
    if (request.comboId) candidates=candidates.filter(c=>c.id===request.comboId);
    if (!candidates.length && (request.requireCombo||request.comboId)) return editHelp('함께 수정할 저장 조합을 찾지 못했어요. 조합 이름을 지정하거나 “식사만”이라고 요청해 주세요. 아직 어느 쪽도 수정하지 않았어요.');
    if (candidates.length>1) return choicesReply({...request,mealId:meal?.id,mealIndex},selectedDate,candidates.map(c=>({label:c.name,selection:{comboId:c.id}})),'함께 수정할 조합이 여러 개예요. 어떤 조합을 수정할까요?');
    combo=candidates[0]||null;
    if (combo && !adding) {
      let matches=combo.foods.map((food,index)=>({food,index})).filter(c=>foodMatches(c.food,request.food,catalog));
      if (request.comboIndex!=null) matches=matches.filter(c=>c.index===request.comboIndex);
      if (!matches.length) return editHelp(`“${combo.name}” 조합에 “${request.food}”이 없어 수정하지 않았어요.`);
      if (matches.length>1) return choicesReply({...request,mealId:meal?.id,mealIndex,comboId:combo.id},selectedDate,matches.map(c=>({label:`${combo.name} · 음식 ${c.index+1} · ${c.food.name} ${c.food.grams}${foodUnit(c.food)}`,selection:{comboIndex:c.index}})),'조합에 같은 음식이 여러 개예요. 어떤 항목을 수정할까요?');
      comboIndex=matches[0].index;
    }
  }
  if (adding && (meal?.foods.length>=100 || combo?.foods.length>=8)) return editHelp('추가하면 음식 개수 제한을 넘어요. 저장 조합은 최대 8개, 식사 기록은 최대 100개까지 담을 수 있어요. 먼저 불필요한 음식을 빼 주세요. 아직 어느 쪽도 수정하지 않았어요.');
  if (removing && (meal?.foods.length<=1 || combo?.foods.length<=1)) return editHelp('마지막 음식을 빼면 식사나 조합이 비게 되어 수정하지 않았어요. 다른 음식을 먼저 추가하거나, 전체 삭제는 해당 기록 화면에서 진행해 주세요.');
  try {
    return {
      meal:meal?{id:meal.id,index:mealIndex,...(resizing?{amount:amountFor(meal.foods[mealIndex],request,catalog)}:{}),expected:meal.foods}:null,
      combination:combo?{id:combo.id,index:comboIndex,...(resizing?{amount:amountFor(combo.foods[comboIndex],request,catalog)}:{}),expected:combo.foods,revision:combo.revision}:null,
      request,operation:request.operation||'resize',food:addedFood
    };
  } catch (error) {return editHelp(error.message+' 아직 어느 쪽도 수정하지 않았어요.');}
}

const catalogKey=f=>JSON.stringify([f.name,f.brand||f.maker||'',f.unit,f.nutritionBase,...nutrients.map(n=>f[n]),f.portions||[]]);
export function resolveAddedFood(request,catalog,selectedDate,query=request.food) {
  const action=request.operation==='replace'?'새 음식으로 사용할':'추가할';
  const valid=catalog.filter(f=>f.name?.length<=200&&['g','mL','개','인분'].includes(f.unit)&&Number(f.nutritionBase)>0&&nutrients.every(n=>typeof f[n]==='number'&&Number.isFinite(f[n])&&f[n]>=0));
  const named=valid.filter(f=>key(f.name)===key(query));
  const exact=named.length?named:valid.filter(f=>foodMatches(f,query,[])||(f.aliases||[]).some(a=>key(a)===key(query)));
  let matches=exact.length?exact:valid.filter(f=>key([f.brand||f.maker||'',f.name].join(' ')).includes(key(query)));
  matches=[...new Map(matches.map(f=>[catalogKey(f),f])).values()];
  if(request.catalogId)matches=matches.filter(f=>catalogKey(f)===request.catalogId);
  if(!matches.length)return editHelp(action+' 음식을 앱 음식 자료에서 확인하지 못했어요. 음식 검색에 표시되는 정확한 이름으로 요청해 주세요. 아직 어느 쪽도 수정하지 않았어요.');
  if(matches.length>10)return editHelp('비슷한 음식이 많아요. 조리 방식이나 제품 이름을 더 자세히 알려 주세요. 아직 수정하지 않았어요.');
  if(matches.length>1)return choicesReply(request,selectedDate,matches.map(f=>({label:`${f.name}${f.brand||f.maker?' · '+(f.brand||f.maker):''} · ${f.nutritionBase}${f.unit}당 ${f.calories}kcal`,selection:{catalogId:catalogKey(f)}})),action+' 음식이 여러 개예요. 어떤 음식인가요?');
  try {
    const f=matches[0],grams=amountFor(f,request,[f]);
    const food={name:f.name,grams,unit:f.unit,manualBrand:f.brand||f.maker||'',...Object.fromEntries(nutrients.map(n=>[n,Math.round(f[n]*grams/Number(f.nutritionBase)*10000)/10000]))};
    if(nutrients.some(n=>!Number.isFinite(food[n])||food[n]>1000000))throw Error('추가할 양이 너무 커요. 양을 다시 확인해 주세요.');
    return {food};
  } catch(error) {return editHelp(error.message+' 아직 어느 쪽도 수정하지 않았어요.');}
}
