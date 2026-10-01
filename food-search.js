const num=v=>{const m=String(v??'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);const n=m?Number(m[0]):0;return Number.isFinite(n)?n:0};
const pick=(o,...ks)=>{for(const k of ks)if(o?.[k]!==undefined&&o[k]!==null&&String(o[k]).trim()!=='')return o[k];return ''};
const itemsOf=d=>{const raw=d?.body?.items||d?.response?.body?.items||d?.items||[];return Array.isArray(raw)?raw:(Array.isArray(raw?.item)?raw.item:(raw?.item?[raw.item]:[]))};

function mapMfds(o){
  const basis=String(pick(o,'nutConSrtrQua','NUT_CONTSERVING','NUTR_CONT_SERVING','SERVING_SIZE')||'100g');
  const foodSize=String(pick(o,'foodSize','FOOD_SIZE','SERVING_SIZE','SERVING_WT')||'');
  const base=num(basis)||100, amount=num(foodSize)||base;
  return {
    source:'mfds',
    name:String(pick(o,'FOOD_NM_KR','foodNmKr','foodNm','FOOD_NM','DESC_KOR')||'').trim(),
    maker:String(pick(o,'companyNm','mkrNm','MFR_NM','CMPNY_NM','makerNm','MAKER_NM','BSSH_NM')||'').trim(),
    basis,foodSize,weight:base,nutritionBase:base,productAmount:amount,displayAmount:amount,
    calories:num(pick(o,'enerc','ENERC_KCAL','ENERGY_KCAL','ENERGY','NUTR_CONT1','AMT_NUM1')),
    carbs:num(pick(o,'chocdf','CHOCDF_G','CHOCDF','CARBOHYDRATE_G','NUTR_CONT2','AMT_NUM7')),
    protein:num(pick(o,'prot','PROT_G','PROT','PROTEIN_G','NUTR_CONT3','AMT_NUM3')),
    fat:num(pick(o,'fatce','FATCE_G','FAT_G','FAT','NUTR_CONT4','AMT_NUM4'))
  };
}

async function getJson(url,timeout=5000){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
  try{
    const r=await fetch(url,{signal:c.signal,headers:{'Accept':'application/json'}});
    if(!r.ok)throw new Error('HTTP_'+r.status);
    return await r.json();
  }finally{clearTimeout(t)}
}

async function mfdsSearch(q,key){
  if(!key)return {items:[],status:'key-missing'};
  const endpoints=[
    ['https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo03/getFoodNtrCpntDbInq03','FOOD_NM_KR'],
    ['https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo03/getFoodNtrCpntDbInq03','foodNm'],
    ['https://api.data.go.kr/openapi/tn_pubr_public_nutri_info_api','foodNm']
  ];
  let hadResponse=false;
  for(const [base,param] of endpoints){
    try{
      const u=new URL(base);
      u.searchParams.set('serviceKey',key);
      u.searchParams.set('type','json');
      u.searchParams.set('pageNo','1');
      u.searchParams.set('numOfRows','50');
      u.searchParams.set(param,q);
      const d=await getJson(u,5000);
      hadResponse=true;
      const rows=itemsOf(d).map(mapMfds).filter(x=>x.name);
      if(rows.length)return {items:rows,status:'ok'};
    }catch(_){}
  }
  return {items:[],status:hadResponse?'empty':'error'};
}

async function offSearch(q){
  try{
    const u=new URL('https://world.openfoodfacts.org/cgi/search.pl');
    u.searchParams.set('search_terms',q);u.searchParams.set('search_simple','1');
    u.searchParams.set('action','process');u.searchParams.set('json','1');u.searchParams.set('page_size','10');
    const d=await getJson(u,2800),out=[];
    for(const p of d.products||[]){
      const name=String(p.product_name_ko||p.product_name||p.generic_name_ko||p.generic_name||'').trim();
      if(!name)continue;
      const n=p.nutriments||{},qty=String(p.quantity||p.serving_size||''),amount=num(qty)||100;
      out.push({source:'off',name,maker:String(p.brands||''),barcode:String(p.code||''),foodSize:qty,basis:'100g/ml',
        weight:100,nutritionBase:100,displayAmount:amount,productAmount:amount,
        calories:num(n['energy-kcal_100g']??n['energy-kcal']),carbs:num(n.carbohydrates_100g??n.carbohydrates),
        protein:num(n.proteins_100g??n.proteins),fat:num(n.fat_100g??n.fat)});
    }
    return {items:out,status:out.length?'ok':'empty'};
  }catch(_){return {items:[],status:'error'}}
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  const q=String(req.query?.q||'').trim();
  if(q.length<2)return res.status(200).json({items:[],sourceStatus:{mfds:'waiting',off:'waiting'}});
  const [mfds,off]=await Promise.all([mfdsSearch(q,process.env.FOOD_API_KEY),offSearch(q)]);
  const seen=new Set(),items=[];
  for(const x of [...mfds.items,...off.items]){
    const k=(x.name+'|'+x.maker).toLowerCase().replace(/\s/g,'');
    if(!k||seen.has(k))continue;seen.add(k);items.push(x);if(items.length>=24)break;
  }
  return res.status(200).json({items,sourceStatus:{mfds:mfds.status,off:off.status}});
}
