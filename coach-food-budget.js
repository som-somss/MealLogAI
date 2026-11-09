const nutrients=['calories','carbs','protein','fat'];
const key=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const rounded=n=>Math.round(n*10)/10;
export function parseFoodRequest(question){
 if(!/칼로리|열량|초과|넘|얼마나|어느\s*정도|몇\s*(g|그램|개)|먹어도|먹으면|먹을까|먹을\s*수/.test(question))return null;
 const qty=question.match(/(-?\d+(?:\.\d+)?|한|두|세|반)\s*(kg|킬로그램|g|그램|ml|mL|밀리리터|리터|L|개|줄|마리|인분|팩|봉)(?![a-z])/i);
 let query=(question.split(/먹|칼로리|열량|얼마나|몇\s*(?:g|그램|개)|어느\s*정도/)[0]||'').trim();
 query=query.replace(/\d{4}-\d{2}-\d{2}/g,'').replace(/^(?:(?:오늘|어제|내가|나는|저는|지금|저녁에|점심에|아침에|간식으로|추가로)\s*)+/,'');
 if(qty)query=query.replace(qty[0],'');
 query=query.replace(/(?:을|를|은|는|이|가)\s*$/,'').replace(/\s+/g,' ').trim();
 if(query.length<2||query.length>80||/^(뭐|뭘|무엇|어떻게|가볍게|가벼운|음식|내|제|이거|그거|이것|식사|오늘|어제|많이|적게|단백질|단백질이|탄수화물|지방)$/.test(query)||/부족|목표|섭취|기록|추천|가볍게|어떻게|많이|뭐|뭘/.test(query))return null;
 const amount=qty?Number(({한:1,두:2,세:3,반:.5})[qty[1]]??qty[1]):null;
 if(amount!==null&&(!Number.isFinite(amount)||amount<=0||amount>100000))return {query,invalidAmount:true};
 const rawUnit=qty?.[2],unit=/^(kg|킬로그램)$/i.test(rawUnit||'')?'g':/^(g|그램)$/i.test(rawUnit||'')?'g':/^(ml|밀리리터)$/i.test(rawUnit||'')?'mL':/^(l|리터)$/i.test(rawUnit||'')?'mL':rawUnit;
 return {query,multiple:/랑|하고|및|\+|와\s|과\s/.test(query),amount:amount===null?null:amount*(/^(kg|킬로그램|l|리터)$/i.test(rawUnit||'')?1000:1),unit:unit||null};
}
export function findFoodMatches(query,foods){
 const q=key(query),isDish=/세트|무침|키트|소스|초고추장|국수|도시락|비빔|야채/.test(query);
 const seen=new Set();const found=foods.filter(f=>f&&typeof f.name==='string'&&Number.isFinite(f.calories)&&f.calories>=0&&Number.isFinite(Number(f.nutritionBase))&&Number(f.nutritionBase)>0&&['g','mL','개','인분'].includes(f.unit)).map(f=>({f,exact:key(f.name)===q||(f.aliases||[]).some(a=>key(a)===q),match:key(f.name).includes(q)||(f.aliases||[]).some(a=>key(a).includes(q))})).filter(x=>x.match&&(isDish||!/세트|무침|키트|소스|초고추장|국수|도시락|비빔|야채/.test(x.f.name)));
 const exact=found.filter(x=>x.exact);const choices=exact.length?exact:found;
 const plain=choices.filter(x=>!x.f.maker&&!x.f.brand);const selected=plain.length?plain:choices;
 return selected.sort((a,b)=>Number(b.exact)-Number(a.exact)||a.f.name.length-b.f.name.length||a.f.name.localeCompare(b.f.name,'ko')).filter(({f})=>{const k=[f.name,f.maker||f.brand,f.unit,f.nutritionBase,...nutrients.map(n=>f[n])].join('|');if(seen.has(k))return false;seen.add(k);return true;}).slice(0,3).map(x=>x.f);
}
export async function lookupFood(request,catalog,fetcher=fetch){
 const local=findFoodMatches(request.query,catalog);if(local.length)return {matches:local,source:'사이트 음식 검색 데이터'};
 try{const response=await fetcher('https://meallogai.vercel.app/api/food-search?q='+encodeURIComponent(request.query)+'&remote=1&page=1',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('search');const data=await response.json();return {matches:findFoodMatches(request.query,Array.isArray(data.items)?data.items:[]),source:'사이트 제품 DB 검색 · 식약처',failed:!!data.errors?.length};}
 catch{return {matches:[],source:'사이트 제품 DB 검색',failed:true};}
}
function requestedAmount(request,f){
 if(request.amount===null)return null;if(request.unit===f.unit)return request.amount;
 if(f.unit==='g'&&Array.isArray(f.portions)){const portion=f.portions.find(p=>Array.isArray(p)&&new RegExp('^1\\s*'+request.unit+'$').test(p[0]));if(portion&&Number(portion[1])>0)return request.amount*Number(portion[1]);}
 return NaN;
}
function maximum(remaining,f){if(f.calories<=0)return null;const raw=remaining*Number(f.nutritionBase)/f.calories;const step=['g','mL','개'].includes(f.unit)?1:.1;return Math.floor((raw+1e-10)/step)*step;}
export function foodBudget(ctx){
 const request=ctx.foodRequest,lookup=ctx.foodLookup||{},matches=lookup.matches||[],days=ctx.days||[],day=days.find(d=>d.meal_date===ctx.day),consumed=Number(day?.nutrients?.calories?.value||0),goal=Number(ctx.goal_kcal),remaining=goal>0?Math.max(0,goal-consumed):null;
 const warnings=['기록된 식사와 선택한 음식 기준의 예상값이에요. 빠진 식사·제품 종류·실제 영양표에 따라 달라져요. 함께 먹는 밥·쌈·소스·음료는 별도로 더해야 해요.'],evidence=[`${ctx.day} meals.foods 서버 합산 + user_settings 열량 목표`,lookup.source||'음식 검색'];
 const answer=(reply,suggestions=[],extra={})=>({reply,suggestions,warnings,evidence,...extra});
 if(request.needsFood)return answer('어떤 음식의 양을 비교할까요? 음식명과 기준 양을 함께 알려 주세요. 예: “과메기 100g”.');
 if(request.needsAmount)return answer(`“${request.query}”의 기준 양이 아직 없어 비율로 계산할 수 없어요. 반으로 줄이거나 늘리기 전의 양을 g·mL 또는 개수로 알려 주세요.`);
 if(request.multiple)return answer('음식마다 먹을 양이 필요해요. 우선 음식 하나와 양을 알려 주세요. 예: “과메기 100g 먹으면 목표를 넘을까?”');
 if(request.invalidAmount)return answer('먹을 양을 0보다 큰 값으로 알려 주세요. 예: “과메기 100g”.');
 if(!matches.length)return answer(lookup.failed?`“${request.query}” 영양정보 검색을 완료하지 못했어요. 연결 후 다시 질문하거나 제품 영양표를 알려 주세요. 열량을 임의로 추정하지 않을게요.`:`사이트 음식 DB에서 “${request.query}”의 영양정보를 찾지 못했어요. 정확한 음식·제품명이나 영양표를 알려 주시면 남은 열량과 비교할 수 있어요.`);
 if(!day||day.nutrients?.calories?.missing>0)warnings.unshift('식사 기록 또는 열량 정보가 빠져 있어 목표 이내라고 확정할 수 없어요. 아래는 현재 기록만 기준으로 한 계산이에요.');
 for(const f of matches)evidence.push(`${f.name}${f.maker?' · '+f.maker:''}: ${f.nutritionBase}${f.unit}당 ${f.calories}kcal · ${f.source||'사이트 참고값'}${f.foodCode?' · '+f.foodCode:''}`);
 const lines=[];
 if(remaining===null){lines.push('열량 목표가 설정되지 않아 초과 여부와 먹을 수 있는 양을 계산할 수 없어요. 설정에서 목표를 확인해 주세요.');for(const f of matches)lines.push(`${f.name}: ${f.nutritionBase}${f.unit}당 ${f.calories}kcal`);return answer(lines.join('\n'));}
 if(consumed>=goal){lines.push(`이미 기록상 ${consumed}kcal로 목표 ${goal}kcal${consumed>goal?'를 '+rounded(consumed-goal)+'kcal 넘었어요.':'에 도달했어요.'} 추가로 먹으면 그만큼 열량이 더해져요.`);}
 else lines.push(`기록상 ${consumed}kcal를 먹었고, 목표 ${goal}kcal까지 ${rounded(remaining)}kcal가 남아 있어요.`);
 const details=matches.map(f=>{const amount=requestedAmount(request,f);return {f,amount,limit:maximum(remaining,f),added:Number.isFinite(amount)?f.calories*amount/Number(f.nutritionBase):null};});
 if(request.amount!==null&&details.every(d=>Number.isFinite(d.amount))){
  const above=details.map(d=>consumed+d.added>goal+1e-8);
  lines.unshift(above.every(Boolean)?`${request.query} ${request.amount}${request.unit}를 더 먹으면 확인된 음식 기준으로는 목표 열량을 넘어요.`:above.every(x=>!x)?`${request.query} ${request.amount}${request.unit}를 더 먹어도 현재 기록 기준으로는 목표 열량 이내예요.`:'제품·종류에 따라 목표 초과 여부가 달라요. 아래 음식별 계산을 확인해 주세요.');
  for(const d of details)lines.push(`${d.f.name}: ${rounded(d.amount)}${d.f.unit} 약 ${rounded(d.added)}kcal → 오늘 예상 ${rounded(consumed+d.added)}kcal (${consumed+d.added>goal?'목표보다 '+rounded(consumed+d.added-goal)+'kcal 초과':'목표까지 '+rounded(goal-consumed-d.added)+'kcal 남음'})`);
 }else{
  if(request.amount!==null)lines.unshift(`“${request.amount}${request.unit}”를 음식 무게로 확정할 수 없어요. g·mL 또는 제품 영양표 기준의 양을 알려 주세요. 임의로 한 개의 무게를 정하지 않을게요.`);
  else lines.unshift(`먹을 양과 ${matches.length>1?'음식 종류에 따라 달라요.':'제품 영양정보에 따라 달라요.'} ${request.query}의 영양정보를 찾아 남은 열량과 비교했어요.`);
  for(const d of details)lines.push(`${d.f.name}: ${d.f.nutritionBase}${d.f.unit}당 ${d.f.calories}kcal · 이 양을 더 먹으면 오늘 예상 ${rounded(consumed+d.f.calories)}kcal${d.limit===null?' · 열량이 0으로 표기돼 최대량은 계산하지 않아요.':` · 이 음식만 먹는다고 가정할 때 계산상 ${rounded(d.limit)}${d.f.unit}까지 목표 이내`}`);
 }
 const unitSet=new Set(matches.map(f=>f.unit));
 if(remaining>0&&unitSet.size===1&&details.every(d=>d.limit!==null)){
  const conservative=Math.min(...details.map(d=>d.limit));
  lines.push(`${matches.length>1?'확인한 종류 중 열량이 높은 쪽을 기준으로 하면':'이 음식 기준으로는'} 약 ${rounded(conservative)}${matches[0].unit}가 기록상 남은 열량으로 계산한 상한이에요. 이 양을 다 먹으라는 권장은 아니며, 곁들이는 음식 열량도 남겨 주세요.`);
 }
 const suggestions=[];
 if(remaining>0)for(const d of details){
  if(d.limit===null||d.limit<=0||nutrients.some(k=>typeof d.f[k]!=='number'||!Number.isFinite(d.f[k])))continue;
  const amount=request.amount!==null&&Number.isFinite(d.amount)&&d.amount<=d.limit?d.amount:Math.min(Number(d.f.nutritionBase),d.limit);
  if(amount<=0)continue;const food={name:d.f.name,grams:amount,unit:d.f.unit,manualBrand:d.f.brand||d.f.maker||'',foodCode:d.f.foodCode||null,source:d.f.source||'site-reference',...Object.fromEntries(nutrients.map(k=>[k,Math.round(d.f[k]*amount/Number(d.f.nutritionBase)*1000)/1000]))};
  suggestions.push({title:d.f.name+' '+rounded(amount)+d.f.unit,foods:[food],totals:Object.fromEntries(nutrients.map(k=>[k,rounded(food[k])])),reason:'선택한 음식의 양별 계산 · 현재 기록 기준',preparation:'실제 먹을 제품·종류와 양을 확인한 뒤 기록해 주세요. 곁들이는 음식은 포함하지 않았어요.'});
 }
 return answer(lines.join('\n'),suggestions,{food_analysis:true});
}
