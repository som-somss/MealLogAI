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
    const arr=Array.isArray(raw)?raw:(raw?.item||[]); const n=v=>{const x=parseFloat(String(v??'').replace(/,/g,''));return Number.isFinite(x)?x:0};
    const pick=(o,...ks)=>{for(const k of ks)if(o?.[k]!==undefined&&o[k]!==null&&String(o[k]).trim()!=='')return o[k];return ''};
    const items=arr.map(o=>({
      name:String(pick(o,'FOOD_NM_KR','FOOD_NM','foodNm')||''), maker:String(pick(o,'MFR_NM','CMPNY_NM','makerNm')||''),
      basis:String(pick(o,'NUT_CONTSERVING','NUTR_CONT1','SERVING_SIZE','AMT_NUM1')||'100g'), weight:n(pick(o,'FOOD_SIZE','SERVING_SIZE','NUT_CONTSERVING'))||100,
      calories:n(pick(o,'AMT_NUM1','NUTR_CONT1','ENERGY','ENERC_KCAL')), carbs:n(pick(o,'AMT_NUM7','NUTR_CONT2','CHOCDF')), protein:n(pick(o,'AMT_NUM3','NUTR_CONT3','PROT')), fat:n(pick(o,'AMT_NUM4','NUTR_CONT4','FAT'))
    })).filter(x=>x.name);
    res.status(200).json({items});
  }catch(e){res.status(500).json({error:'FOOD_API_ERROR',items:[]});}
}
