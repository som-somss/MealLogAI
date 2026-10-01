export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');
  const q=String(req.query?.q||'').trim();
  if(q.length<2) return res.status(200).json({items:[]});
  const key=process.env.FOOD_API_KEY;
  const n=v=>{const m=String(v??'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);const x=m?Number(m[0]):0;return Number.isFinite(x)?x:0};
  const pick=(o,...ks)=>{for(const k of ks)if(o?.[k]!==undefined&&o[k]!==null&&String(o[k]).trim()!=='')return o[k];return ''};
  const mfds=[]; const off=[]; const errors=[];
  if(key){
    try{
      const u=new URL('https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo03/getFoodNtrCpntDbInq03');
      u.searchParams.set('serviceKey',key);u.searchParams.set('type','json');u.searchParams.set('pageNo','1');u.searchParams.set('numOfRows','20');u.searchParams.set('FOOD_NM_KR',q);
      const r=await fetch(u); const data=await r.json();
      const raw=data?.body?.items || data?.response?.body?.items || data?.items || [];
      const arr=Array.isArray(raw)?raw:(raw?.item||[]);
      for(const o of arr){
        const name=String(pick(o,'FOOD_NM_KR','foodNmKr','foodNm','FOOD_NM','DESC_KOR')||'').trim(); if(!name)continue;
        mfds.push({source:'mfds',name,
          maker:String(pick(o,'companyNm','mkrNm','MFR_NM','CMPNY_NM','makerNm','MAKER_NM','BSSH_NM')||''),
          basis:String(pick(o,'nutConSrtrQua','NUT_CONTSERVING','NUTR_CONT_SERVING','SERVING_SIZE')||'100g'),
          foodSize:String(pick(o,'foodSize','FOOD_SIZE','SERVING_SIZE','SERVING_WT')||''),
          weight:n(pick(o,'nutConSrtrQua','NUT_CONTSERVING','NUTR_CONT_SERVING'))||100,
          nutritionBase:n(pick(o,'nutConSrtrQua','NUT_CONTSERVING','NUTR_CONT_SERVING'))||100,
          productAmount:n(pick(o,'foodSize','FOOD_SIZE','SERVING_SIZE','SERVING_WT'))||n(pick(o,'nutConSrtrQua','NUT_CONTSERVING','NUTR_CONT_SERVING'))||100,
          displayAmount:n(pick(o,'foodSize','FOOD_SIZE','SERVING_SIZE','SERVING_WT'))||n(pick(o,'nutConSrtrQua','NUT_CONTSERVING','NUTR_CONT_SERVING'))||100,
          calories:n(pick(o,'enerc','ENERC_KCAL','ENERGY_KCAL','ENERGY','NUTR_CONT1','AMT_NUM1')),
          carbs:n(pick(o,'chocdf','CHOCDF_G','CHOCDF','CARBOHYDRATE_G','NUTR_CONT2','AMT_NUM7')),
          protein:n(pick(o,'prot','PROT_G','PROT','PROTEIN_G','NUTR_CONT3','AMT_NUM3')),
          fat:n(pick(o,'fatce','FATCE_G','FAT_G','FAT','NUTR_CONT4','AMT_NUM4'))});
      }
    }catch(e){errors.push('MFDS')}
  } else errors.push('MFDS_KEY');
  // 영문 제품명/브랜드 검색 보완: Open Food Facts. 식약처 결과와 함께 표시한다.
  try{
    const u=new URL('https://world.openfoodfacts.org/cgi/search.pl');
    u.searchParams.set('search_terms',q);u.searchParams.set('search_simple','1');u.searchParams.set('action','process');u.searchParams.set('json','1');u.searchParams.set('page_size','12');
    const r=await fetch(u,{headers:{'User-Agent':'MealLogAI/1.0'}}); const d=await r.json();
    for(const p of (d.products||[])){
      const name=String(p.product_name_ko||p.product_name||p.generic_name_ko||p.generic_name||'').trim(); if(!name)continue;
      const nu=p.nutriments||{}; const qty=String(p.quantity||p.serving_size||''); const amount=n(qty)||100;
      off.push({source:'off',name,maker:String(p.brands||''),barcode:String(p.code||''),foodSize:qty,basis:'100g/ml',weight:100,nutritionBase:100,displayAmount:amount,productAmount:amount,
        calories:n(nu['energy-kcal_100g']??nu['energy-kcal']),carbs:n(nu.carbohydrates_100g??nu.carbohydrates),protein:n(nu.proteins_100g??nu.proteins),fat:n(nu.fat_100g??nu.fat)});
    }
  }catch(e){errors.push('OFF')}
  const seen=new Set(),items=[];
  for(const x of [...mfds,...off]){const k=(x.name+'|'+x.maker).toLowerCase().replace(/\s/g,'');if(seen.has(k))continue;seen.add(k);items.push(x);if(items.length>=24)break}
  res.status(200).json({items,errors});
}
