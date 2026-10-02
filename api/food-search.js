function num(v){
  const m=String(v??'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);
  const x=m?Number(m[0]):0;
  return Number.isFinite(x)?x:0;
}
function txt(v){ return String(v??'').trim(); }
function itemsOf(data){
  const raw=data?.body?.items ?? data?.response?.body?.items ?? data?.items ?? [];
  if(Array.isArray(raw)) return raw;
  if(Array.isArray(raw?.item)) return raw.item;
  return raw?.item ? [raw.item] : [];
}
function parseAmount(s){
  const t=txt(s);
  const m=t.match(/([\d,.]+)\s*(mL|ml|g|G|kg|KG|L|l)\b/);
  if(!m) return {amount:num(t)||100,unit:'g'};
  let amount=num(m[1]), unit=m[2].toLowerCase();
  if(unit==='kg'){amount*=1000;unit='g'}
  if(unit==='l'){amount*=1000;unit='ml'}
  return {amount:amount||100,unit:unit==='ml'?'mL':'g'};
}
function mfdsItem(o){
  const serving=txt(o.SERVING_SIZE||o.NUTRI_AMOUNT_SERVING||o.DISH_ONE_SERVING||'100g');
  const a=parseAmount(serving);
  return {
    source:'mfds',
    name:txt(o.FOOD_NM_KR),
    maker:txt(o.MAKER_NM),
    basis:serving||`${a.amount}${a.unit}`,
    foodSize:serving||`${a.amount}${a.unit}`,
    weight:a.amount,
    nutritionBase:a.amount,
    productAmount:a.amount,
    displayAmount:a.amount,
    unit:a.unit,
    calories:num(o.AMT_NUM1),
    protein:num(o.AMT_NUM3),
    fat:num(o.AMT_NUM4),
    carbs:num(o.AMT_NUM7)
  };
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  const q=txt(req.query?.q);
  if(q.length<2) return res.status(200).json({items:[],errors:[]});

  const key=txt(process.env.FOOD_API_KEY);
  const mfds=[], off=[], errors=[];

  if(key){
    try{
      const u=new URL('https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo03/getFoodNtrCpntDbInq03');
      u.searchParams.set('serviceKey',key);
      u.searchParams.set('type','json');
      u.searchParams.set('pageNo','1');
      u.searchParams.set('numOfRows','20');
      u.searchParams.set('FOOD_NM_KR',q);
      const r=await fetch(u,{headers:{Accept:'application/json'}});
      const data=await r.json();
      if(!r.ok) errors.push('MFDS_HTTP_'+r.status);
      for(const o of itemsOf(data)){
        const x=mfdsItem(o);
        if(x.name) mfds.push(x);
      }
    }catch(e){ errors.push('MFDS'); }
  }else errors.push('MFDS_KEY');

  // 보조 제품 DB: 식약처에 없는 해외/바코드 제품 검색용
  try{
    const u=new URL('https://world.openfoodfacts.org/cgi/search.pl');
    u.searchParams.set('search_terms',q);
    u.searchParams.set('search_simple','1');
    u.searchParams.set('action','process');
    u.searchParams.set('json','1');
    u.searchParams.set('page_size','12');
    const r=await fetch(u,{headers:{'User-Agent':'MealLogAI/1.0'}});
    const d=await r.json();
    for(const p of (d.products||[])){
      const name=txt(p.product_name_ko||p.product_name||p.generic_name_ko||p.generic_name);
      if(!name) continue;
      const nu=p.nutriments||{}, qty=txt(p.quantity||p.serving_size||'');
      const a=parseAmount(qty||'100g');
      off.push({
        source:'off',name,maker:txt(p.brands),barcode:txt(p.code),
        foodSize:qty,basis:'100g/mL',weight:100,nutritionBase:100,
        displayAmount:a.amount,productAmount:a.amount,unit:a.unit,
        calories:num(nu['energy-kcal_100g']??nu['energy-kcal']),
        carbs:num(nu.carbohydrates_100g??nu.carbohydrates),
        protein:num(nu.proteins_100g??nu.proteins),
        fat:num(nu.fat_100g??nu.fat)
      });
    }
  }catch(e){ errors.push('OFF'); }

  const seen=new Set(),items=[];
  for(const x of [...mfds,...off]){
    const k=(x.name+'|'+x.maker).toLowerCase().replace(/\s/g,'');
    if(seen.has(k)) continue;
    seen.add(k); items.push(x);
    if(items.length>=24) break;
  }
  return res.status(200).json({items,errors});
}
