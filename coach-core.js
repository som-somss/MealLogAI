import {buildMenus} from './coach-menu-builder.js';
import {parseFoodRequest,foodBudget} from './coach-food-budget.js';
const nutrients=['calories','carbs','protein','fat'];
export function validDay(day){return typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day;}
export const koreaDay=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export function plan(question,selected,today=koreaDay()){
 if(!validDay(selected)||selected>today||selected<'2000-01-01')throw Error('분석 날짜를 확인해 주세요. 미래 날짜는 분석할 수 없어요.');
 const explicit=question.match(/\d{4}-\d{1,2}-\d{1,2}/g)||[];
 if(explicit.length>1||explicit.some(d=>!validDay(d)))throw Error('분석할 날짜 하나를 YYYY-MM-DD 형식으로 선택해 주세요.');
 let day=explicit[0]||selected;
 if(/오늘|어제/.test(question)&&!explicit.length)day=today;
 const nextMeal = question.match(/먹었[^.!?\n]{0,12}[.!?,\s]*(?=(?:오늘\s*)?(?:아침|점심|저녁|간식)(?:으로|에는|은|에|때|\s))/);
 const request = nextMeal ? question.slice(nextMeal.index + nextMeal[0].length).trim() : question;
 const explicitMenu = /(?:뭐|뭘|무엇을?)\s*(?:먹|고르)|(?:음식|메뉴|식사)\s*(?:를\s*)?(?:추천|골라)/.test(request) ||
   (request !== question && /추천|뭘|메뉴/.test(request));
 const light=/가볍게|가벼운|부담\s*없|간단[하히].*먹|헤비하지|저칼로리|(?:칼로리|열량)(?:가|이)?\s*(?:적|낮|가벼)/.test(request)&&!/가볍게.*말고|가벼운.*말고/.test(request);
 let kind=/이번\s*주|최근\s*7일|일주일|주간/.test(question)?'week':/자주|기억|평소|취향/.test(question)?'memory':/뭐\s*먹|뭘\s*먹|추천|메뉴|저녁|아침|점심/.test(question)||light?'recommend':/어제/.test(question)?'yesterday':/단백질/.test(question)?'protein':/칼로리|열량|섭취|탄수|지방|합계/.test(question)?'today':'general';
 if (explicitMenu && (kind !== 'week' || request !== question)) kind = /자주|기억|평소|취향/.test(request) ? 'memory' : 'recommend';
 const foodRequest = explicitMenu ? null : parseFoodRequest(request);
 if(foodRequest&&kind!=='week'){kind='food';if(/어제/.test(request)&&!/오늘/.test(request)&&!explicit.length)day=new Date(Date.parse(today)-86400000).toISOString().slice(0,10);}
 if(day>today||day<'2000-01-01')throw Error('분석 날짜를 확인해 주세요.');
 if(/그제|지난주|지난달|내일|모레|\d+일\s*전|\d+월\s*\d+일/.test(question))throw Error('원하는 날짜를 날짜 선택란에서 지정하고 질문해 주세요. 최근 7일 분석도 선택한 날짜를 기준으로 해요.');
 const terms=['닭가슴살','계란','달걀','두부','연어','고등어','소고기','고구마','오트밀','식빵','브로콜리','토마토'];
 const exclude=terms.filter(n=>new RegExp(n+'(?:은|는|을|를)?\\s*(?:빼|제외|말고|싫|못|알레르기)').test(request));
 const include=terms.filter(n=>request.includes(n)&&!exclude.includes(n));
 return {kind,day,foodRequest,explicitMenu,request,preferences:{light,highProtein:/고단백|단백질.*(많|높|풍부)/.test(request),noRice:/밥\s*(없이|빼|말고)|밥은\s*제외/.test(request),vegetarian:/채식|고기\s*없이/.test(request),exclude,include,savedOnly:/저장한\s*조합|내\s*조합|기존\s*조합/.test(request)&&!/조합.*(말고|아닌|대신)|새로|새로운|새\s*조합/.test(request)}};
}
const key=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/\s/g,'');
const foodKey=f=>[key(f.name),key(f.manualBrand||f.brand||f.barcodeProduct?.maker),f.unit||'g'].join('|');
export function candidates(ctx){
 if(!ctx.preferences?.savedOnly)return buildMenus(ctx);
 const ms=ctx.memories||[],active=ms.filter(m=>m.status==='confirmed'),blocked=new Set(ms.filter(m=>m.status==='deleted'&&m.category==='portion').map(m=>m.memory_key));
 const dislikes=active.filter(m=>m.category==='preference'&&m.preference==='dislike').map(m=>key(m.food_name));
 const likes=active.filter(m=>m.category==='preference'&&m.preference==='like').map(m=>key(m.food_name));
 const allowed=f=>f&&typeof f.name==='string'&&Number(f.grams)>0&&!dislikes.some(n=>key(f.name).includes(n))&&!blocked.has(foodKey(f));
 const items=active.filter(m=>m.category==='portion'&&m.food).map(m=>({title:m.food_name,foods:[{...m.food,manualBrand:m.brand}],reason:'사용자가 확인한 식사량'}));
 items.push(...(ctx.foods||[]).map(m=>({title:m.food.name,foods:[{...m.food,manualBrand:m.brand}],reason:'승인한 음식 기억'})),...(ctx.combinations||[]).map(m=>({title:m.name,foods:m.foods,reason:'승인한 내 조합'})));
 const seen=new Set(),today=ctx.days?.find(d=>d.meal_date===ctx.day),remaining=Number(ctx.goal_kcal)>0?Math.max(0,ctx.goal_kcal-(today?.nutrients?.calories?.value||0)):null;
 const recent=ctx.days||[],proteinFocus=Number(ctx.settings?.protein_goal)>0&&recent.length&&recent.reduce((s,d)=>s+(d.nutrients?.protein?.value||0),0)/recent.length<Number(ctx.settings.protein_goal);
 const light=ctx.preferences?.light===true;
 const rank=list=>list.filter(m=>Array.isArray(m.foods)&&m.foods.length>0&&m.foods.length<=8&&m.foods.every(allowed)).map(m=>{
  const totals=Object.fromEntries(nutrients.map(k=>[k,m.foods.some(f=>f.nutritionStatus==='unknown'||typeof f[k]!=='number'||!Number.isFinite(f[k])||f[k]<0)?null:Math.round(m.foods.reduce((s,f)=>s+f[k],0)*10)/10]));
  const liked=m.foods.some(f=>likes.some(n=>key(f.name).includes(n)));
  return {...m,totals,liked,reason:m.reason+(light?' · 가벼운 식사 요청에 맞춰 열량·지방이 낮은 후보 우선':'')+(proteinFocus?' · 최근 기록일의 단백질과 내 목표 참고':''),score:(liked?100:0)+(proteinFocus&&totals.protein!==null?Math.min(100,totals.protein)*5:0)+(light?-(totals.calories??100000)-(totals.fat??10000)*10:(remaining!==null&&totals.calories!==null?-Math.abs(remaining-totals.calories):0))};
 }).filter(m=>!light||(m.totals.calories!==null&&m.totals.fat!==null&&m.totals.protein!==null&&m.totals.calories>=200&&m.totals.calories<=450&&m.totals.fat<=18&&m.totals.protein>=8));
 const ranked=rank(items);
 return ranked.sort((a,b)=>b.score-a.score).filter(m=>{const k=m.foods.map(foodKey).sort().join(';');if(seen.has(k))return false;seen.add(k);return true;}).slice(0,3).map(({score,...m})=>m);
}
export function compose(ctx){
 if(ctx.kind==='food')return foodBudget(ctx);
 const lines=[],warnings=[],days=ctx.days||[],today=days.find(d=>d.meal_date===ctx.day),n=today?.nutrients||{};
 const label={calories:'열량',carbs:'탄수화물',protein:'단백질',fat:'지방'};
 if(ctx.kind==='general')return {reply:'오늘 단백질, 선택한 날짜의 섭취량, 최근 7일 식습관, 기억한 음식 추천을 도와드려요. 분석할 날짜와 질문을 구체적으로 알려 주세요.',suggestions:[],warnings:[],evidence:['개인 식사 데이터 조회 없음']};
 if(ctx.kind==='week'){
  lines.push(`${ctx.from}~${ctx.to} 최근 7일 중 기록이 있는 날은 ${days.length}일이에요.`);
  for(const k of nutrients){const total=days.reduce((s,d)=>s+(d.nutrients?.[k]?.value||0),0);lines.push(`기록된 ${label[k]} 합계 ${Math.round(total*10)/10}${k==='calories'?'kcal':'g'}${days.length?' · 기록일 평균 '+Math.round(total/days.length*10)/10+(k==='calories'?'kcal':'g'):''}`);}
  lines.push('기록이 없는 날을 금식으로 해석하지 않아요. 빠진 식사를 먼저 채우면 주간 비교가 더 정확해져요.');
 }else if(ctx.kind==='yesterday'){
  for(const d of days)lines.push(`${d.meal_date}: 기록된 열량 ${d.nutrients?.calories?.value||0}kcal, 단백질 ${d.nutrients?.protein?.value||0}g (${d.meal_count}개 식사 기록)`);
  lines.push('이전 날의 섭취를 만회하려고 끼니를 거르기보다, 오늘도 평소 식사 간격을 유지하며 균형 있게 먹어 보세요.');
 }else{
  lines.push(`${ctx.day} · ${today?.meal_count||0}개 식사 기록 기준이에요.`);
  if(today)for(const k of ctx.kind==='protein'?['protein']:nutrients)lines.push(`기록된 ${label[k]} ${n[k]?.value||0}${k==='calories'?'kcal':'g'}${n[k]?.missing?' (영양정보 누락 포함 · 확인된 값만 합산)':''}`);
  for(const k of ctx.kind==='protein'?['protein']:['carbs','protein','fat']){
   const goal=Number(ctx.settings?.[k+'_goal']);if(!(goal>0)){if(ctx.kind==='protein')lines.push('단백질 목표가 설정되지 않아 부족량을 단정할 수 없어요. 홈의 영양 목표 또는 코치 설정에서 직접 입력할 수 있어요.');continue;}
   const amount=n[k]?.value||0,difference=Math.round(Math.abs(goal-amount)*10)/10;
   lines.push(`직접 설정한 ${label[k]} 목표 ${goal}g · `+(!today?'아직 식사 기록이 없어 목표 비교를 보류해요.':n[k]?.missing?'영양정보가 빠져 있어 목표 비교를 보류해요.':amount>goal?`기록상 목표보다 ${difference}g 많아요.`:`기록상 남은 양 ${difference}g이에요.`));
  }
  if(ctx.goal_kcal>0)lines.push(`내 열량 목표 ${ctx.goal_kcal}kcal${today?' · 기록상 남은 열량 '+Math.max(0,Math.round(ctx.goal_kcal-(n.calories?.value||0)))+'kcal':''}.`);
 }
 if(!today&&ctx.kind!=='week')warnings.push('선택 날짜에 식사 기록이 없어요. 실제로 먹지 않았다는 뜻은 아니에요.');
 if(days.some(d=>Object.values(d.nutrients||{}).some(v=>v.missing>0)))warnings.push('영양정보가 없는 음식은 합계에서 제외했어요. 합계는 실제 섭취보다 작을 수 있어요.');
 warnings.push('섭취 합계는 저장된 기록만 참고했어요. 기록 누락 여부를 확인하고, 특수 식이·알레르기는 직접 확인해 주세요.');
 const suggestions=['recommend','memory'].includes(ctx.kind)?candidates(ctx):[];
 if(['recommend','memory'].includes(ctx.kind)){
  if(suggestions.length){
   const first=suggestions[0];
   lines.unshift(`${ctx.preferences?.light?'가볍게 먹고 싶다면':'이번 식사는'} “${first.title}”${first.totals.calories!==null?' 약 '+first.totals.calories+'kcal':''}를 먼저 추천해요.`,first.foods.map(f=>f.name+' '+f.grams+(f.unit||'g')).join(' + ')+(ctx.preferences?.light?' · 남은 열량을 채우기보다 열량·지방이 낮고 단백질이 있는 후보를 골랐어요.':'.'));
   lines.push(first.generated?'사이트에 저장된 음식 데이터를 골라 새로운 식사를 구성했어요. 개인 기억은 취향을 반영하는 데 참고했으며, 기존에 저장한 조합을 그대로 추천한 것이 아니에요. 실제 제품·조리법·양에 따라 영양값이 달라져요.':'확인된 내 음식·조합 중 요청에 맞는 메뉴를 골랐어요.');
   if(ctx.preferences?.light)lines.push('가벼운 후보를 비교한 것이며 한 끼 섭취 목표나 제한량은 아니에요. 배고픔과 실제 식사량에 맞춰 조절해 주세요.');
  }else lines.push('제외한 음식과 요청 조건을 함께 만족하는 후보를 찾지 못했어요. 먹을 수 있는 음식이나 원하는 메뉴를 알려 주세요.');
  if(ctx.settings?.use_food_memory===false)lines.push('개인 기억 활용이 꺼져 있어요. 코치 설정에서 켤 수 있어요.');
 }
 return {reply:lines.join('\n'),suggestions,warnings,evidence:[`${ctx.from}~${ctx.to} meals.foods 서버 합산 · 한국 날짜 기준`,...(['recommend','memory'].includes(ctx.kind)&&ctx.settings?.use_food_memory!==false?['사용자 확인 기억·승인 음식·승인 조합 (최대 200/100/100개)']:[]),...(suggestions.some(m=>m.generated)?[`사이트 음식 검색과 동일한 음식 데이터 ${ctx.catalog?.length||0}개에서 재료 선정 · 영양 기준량에 맞춰 제안량 환산`]:[]),...(ctx.goal_kcal>0?['user_settings 열량 목표']:[])]};
}
