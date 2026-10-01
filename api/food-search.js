export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');
  const q=String(req.query?.q||'').trim();
  if(q.length<2) return res.status(200).json({items:[]});
  const key=process.env.FOOD_API_KEY;
  if(!key) return res.status(503).json({error:'FOOD_API_KEY_NOT_SET',items:[]});
  try{
    const u=new URL('https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo03/getFoodNtrCpntDbInq03');
    u.searchParams.set('serviceKey',key);u.searchParams.set('type','json');u.searchParams.set('pageNo','1');u.searchParams.set('numOfRows','20');u.searchParams.set('FOOD_NM_KR',q);
    const r=await fetch(u); const data=await r.json();
    const raw=data?.body?.items || data?.response?.body?.items || data?.items || [];
    const arr=Array.isArray(raw)?raw:(raw?.item||[]);
    const n=v=>{const m=String(v??'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);const x=m?Number(m[0]):0;return Number.isFinite(x)?x:0};
    const pick=(o,...ks)=>{for(const k of ks)if(o?.[k]!==undefined&&o[k]!==null&&String(o[k]).trim()!=='')return o[k];return ''};
    const items=arr.map(o=>({
      name:String(pick(o,'FOOD_NM_KR','FOOD_NM','foodNm','DESC_KOR')||''),
      maker:String(pick(o,'MFR_NM','CMPNY_NM','makerNm','MAKER_NM','BSSH_NM')||''),
      basis:String(pick(o,'NUT_CONTSERVING','NUTR_CONT_SERVING','SERVING_SIZE','NUTR_CONT1','AMT_NUM1')||'100g'),
      weight:n(pick(o,'FOOD_SIZE','SERVING_SIZE','SERVING_WT','NUT_CONTSERVING','NUTR_CONT_SERVING'))||100,
      calories:n(pick(o,'ENERC_KCAL','ENERGY_KCAL','ENERGY','NUTR_CONT1','AMT_NUM1')),
      carbs:n(pick(o,'CHOCDF_G','CHOCDF','CARBOHYDRATE_G','NUTR_CONT2','AMT_NUM7')),
      protein:n(pick(o,'PROT_G','PROT','PROTEIN_G','NUTR_CONT3','AMT_NUM3')),
      fat:n(pick(o,'FATCE_G','FAT_G','FAT','NUTR_CONT4','AMT_NUM4'))
    })).filter(x=>x.name);
    res.status(200).json({items});
  }catch(e){res.status(500).json({error:'FOOD_API_ERROR',items:[]});}
}
