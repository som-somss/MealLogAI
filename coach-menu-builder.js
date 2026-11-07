const nutrients=['calories','carbs','protein','fat'];
const key=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s_()·]/g,'').replace(/달걀/g,'계란').replace(/치킨/g,'닭');
const sum=foods=>Object.fromEntries(nutrients.map(k=>[k,Math.round(foods.reduce((s,f)=>s+f[k],0)*10)/10]));
const foodId=f=>key(f.name)+'|'+key(f.manualBrand||f.brand||f.maker);
export function roleOf(f){
 if(f.unit!=='g')return null;const name=f.name.replace(/_/g,' '),density=f.calories/Number(f.nutritionBase)*100;
 if(/튀김|감자칩|과자|케이크|파우더|분말|가루|소스|드레싱|삼겹살|슈크림|초코|단팥|양갱|맛탕|카스테라/.test(name))return null;
 if(/^(흰쌀밥|쌀밥|잡곡밥|현미밥|보리밥|기장밥|식빵|통밀.*빵|고구마|오트밀)/.test(name)&&density>=70&&density<=400)return 'carb';
 if(/^(닭가슴살|삶은\s*계란|달걀 삶은것$|두부$|두부부침$|달걀찜|계란찜|연어.*구이|고등어.*구이|소고기.*구이|참치.*물)/.test(name)&&f.protein/Number(f.nutritionBase)*100>=4&&density<=320)return 'protein';
 if(/^(브로콜리|오이$|토마토$|방울토마토|양상추$|양배추$|시금치나물|콩나물무침|샐러드 (채소|새싹|양상추))/.test(name)&&density<=160)return 'vegetable';
 return null;
}
function portion(f,grams){const base=Number(f.nutritionBase);return {name:f.name,grams,unit:f.unit,manualBrand:f.brand||f.maker||'',source:f.source||'site-reference',foodCode:f.foodCode||null,sourceUrl:f.sourceUrl||null,nutritionBase:base,...Object.fromEntries(nutrients.map(k=>[k,Math.round(f[k]*grams/base*1000)/1000]))};}
function sameMenu(a,b){return a.length===b.length&&a.map(foodId).sort().join(';')===b.map(foodId).sort().join(';');}
export function buildMenus(ctx){
 const catalog=ctx.catalog||[];if(!catalog.length)return [];
 const prefs=ctx.preferences||{},confirmed=(ctx.memories||[]).filter(m=>m.status==='confirmed');
 const excluded=[...confirmed.filter(m=>m.category==='preference'&&m.preference==='dislike').map(m=>key(m.food_name)),...(prefs.exclude||[]).map(key)];
 if(prefs.vegetarian)excluded.push(...['닭','소고기','돼지','연어','고등어','참치','새우','멸치','육수'].map(key));
 const likes=confirmed.filter(m=>m.category==='preference'&&m.preference==='like').map(m=>key(m.food_name));
 const remembered=[...(ctx.foods||[]).map(m=>m.food?.name),...confirmed.filter(m=>m.category==='portion').map(m=>m.food_name)].filter(Boolean).map(key);
 const blocked=new Set((ctx.memories||[]).filter(m=>m.status==='deleted'&&m.category==='portion').map(m=>m.memory_key));
 const allowed=f=>!excluded.some(n=>key(f.name).includes(n))&&!blocked.has([String(f.name).normalize('NFKC').toLowerCase().replace(/\s/g,''),String(f.brand||f.maker||'').normalize('NFKC').toLowerCase().replace(/\s/g,''),f.unit].join('|'))&&!(prefs.noRice&&/밥/.test(f.name));
 const pools={carb:[],protein:[],vegetable:[]},names=new Set();
 const choices=catalog.filter(allowed).map(f=>({f,role:roleOf(f)})).filter(x=>x.role).sort((a,b)=>{
  const value=f=>(likes.some(n=>key(f.name).includes(n))?50:0)+(remembered.some(n=>key(f.name).includes(n))?20:0)+(!f.maker&&!f.brand?8:0)+(f.source==='mfds-snapshot'?5:0)-f.name.length*.1;
  return value(b.f)-value(a.f)||a.f.name.localeCompare(b.f.name,'ko');
 });
 for(const {f,role} of choices){const identity=key(f.name);if(names.has(identity))continue;names.add(identity);if(pools[role].length<20)pools[role].push(f);}
 const today=(ctx.days||[]).find(d=>d.meal_date===ctx.day),remaining=Number(ctx.goal_kcal)>0?Math.max(0,ctx.goal_kcal-(today?.nutrients?.calories?.value||0)):null;
 const target=prefs.light?350:remaining!==null&&remaining>0?Math.max(350,Math.min(600,remaining)):500;
 const previous=(ctx.combinations||[]).map(m=>m.foods||[]),result=[];
 for(const carb of pools.carb)for(const protein of pools.protein)for(const veg of pools.vegetable){
  const bread=/빵/.test(carb.name);
  if(bread&&(/고등어|연어|소고기/.test(protein.name)||/나물|무침|볶음/.test(veg.name)))continue;
  for(const amount of (prefs.light?[80,100,120]:[100,140,180])){
   const proteinGrams=protein.protein/Number(protein.nutritionBase)*100>=18?(prefs.highProtein?120:100):150;
   const foods=[portion(carb,amount),portion(protein,proteinGrams),portion(veg,100)],totals=sum(foods);
   if(totals.calories<(prefs.light?220:300)||totals.calories>(prefs.light?450:700)||totals.protein<(prefs.highProtein?25:12)||totals.fat>(prefs.light?18:28)||previous.some(old=>sameMenu(old,foods)))continue;
   if(prefs.include?.length&&!prefs.include.every(n=>foods.some(f=>key(f.name).includes(key(n)))))continue;
   const liked=foods.some(f=>likes.some(n=>key(f.name).includes(n)));
   const score=-Math.abs(totals.calories-target)-(prefs.light?totals.fat*3:0)+(prefs.highProtein?totals.protein*2:0)+(liked?20:0);
   result.push({title:foods.map(f=>f.name.replace(/^고구마_/, '').replace(/_/g,' ')).join(' · ')+' 한 접시',foods,totals,liked,generated:true,general:true,preparation:bread?'표시한 양의 빵을 준비하고, 조리한 단백질 식품과 채소를 곁들여 오픈 샌드위치로 구성해요. 실제 식품의 조리법과 영양표를 확인해 주세요.':'표시한 양의 곡류와 단백질 반찬을 준비하고, 채소를 곁들여 한 끼로 구성해요. 실제 식품의 조리법과 영양표를 확인해 주세요.',reason:'사이트 음식으로 새로 구성 · 곡류 + 단백질 + 채소'+(prefs.light?' · 가벼운 식사 요청 반영':'')+(prefs.highProtein?' · 단백질 우선':''),score});
  }
 }
 result.sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title,'ko'));
 const selected=[];const proteins=new Set(),carbs=new Set(),vegetables=new Set(),menus=new Set();
 const family=(food,role)=>{const n=key(food.name);return role==='protein'?(/닭/.test(n)?'닭':/계란/.test(n)?'계란':/두부/.test(n)?'두부':n):role==='carb'?(/밥/.test(n)?'밥':/고구마/.test(n)?'고구마':/빵/.test(n)?'빵':n):(/토마토/.test(n)?'토마토':n);};
 // Offer distinct proteins and bases, rather than three portion variants of one meal.
 for(const strict of [true,false])for(const m of result){if(selected.length>=3)break;const p=family(m.foods[1],'protein'),c=family(m.foods[0],'carb'),v=family(m.foods[2],'vegetable'),id=m.foods.map(foodId).join(';');if(menus.has(id)||(strict&&(proteins.has(p)||carbs.has(c)||vegetables.has(v))))continue;selected.push(m);proteins.add(p);carbs.add(c);vegetables.add(v);menus.add(id);}
 return selected.map(({score,...m})=>m);
}
