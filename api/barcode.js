const num=v=>{const m=String(v??'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);const n=m?Number(m[0]):0;return Number.isFinite(n)?n:0};
const txt=v=>String(v??'').trim(), norm=s=>txt(s).toLowerCase().replace(/\([^)]*\)/g,'').replace(/[^0-9a-z가-힣]/g,'');
const pick=(o,...ks)=>{for(const k of ks)if(o?.[k]!=null&&txt(o[k]))return o[k];return ''};
const hasKorean=s=>/[가-힣]/.test(txt(s));
function amountUnit(v){
  const s=txt(v).replace(/,/g,'');
  const m=s.match(/(\d+(?:\.\d+)?)\s*(㎖|ml|mℓ|g|kg|㎏|l|ℓ)/i);
  if(!m)return {amount:0,unit:''};
  let amount=Number(m[1]);
  const raw=String(m[2]).toLowerCase();
  if(raw==='kg'||raw==='㎏')return {amount:amount*1000,unit:'g'};
  if(raw==='l'||raw==='ℓ')return {amount:amount*1000,unit:'mL'};
  if(raw==='ml'||raw==='㎖'||raw==='mℓ')return {amount,unit:'mL'};
  return {amount,unit:'g'};
}
function packageAmount(quantity){const q=txt(quantity).replace(/,/g,'');if(!/^\d+(?:\.\d+)?\s*(?:㎖|ml|mℓ|g|kg|㎏|l|ℓ)$/i.test(q))return {amount:0,unit:''};return amountUnit(q);}
function items(data){const r=data?.body?.items??data?.response?.body?.items??data?.items??[];return Array.isArray(r)?r:Array.isArray(r?.item)?r.item:r?.item?[r.item]:[]}
async function mfdsSearch(q,key){const u=new URL('https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo03/getFoodNtrCpntDbInq03');[['serviceKey',key],['type','json'],['pageNo','1'],['numOfRows','30'],['FOOD_NM_KR',q]].forEach(x=>u.searchParams.set(...x));const r=await fetch(u,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(7000)});return r.ok?items(await r.json()):[]}
function mapMfds(o){const basis=txt(pick(o,'SERVING_SIZE','nutConSrtrQua','NUT_CONTSERVING')||'100g'),foodSize=txt(pick(o,'FOOD_SIZE','foodSize','SERVING_WT','FOOD_WEIGHT')),bi=amountUnit(basis),pi=amountUnit(foodSize);return{name:txt(pick(o,'FOOD_NM_KR','foodNmKr','foodNm','FOOD_NM')),maker:txt(pick(o,'MAKER_NM','companyNm','mkrNm','MFR_NM','CMPNY_NM','BSSH_NM')),reportNo:txt(pick(o,'ITEM_REPORT_NO','PRDLST_REPORT_NO')),basis,foodSize,nutritionBase:bi.amount||100,nutritionUnit:bi.unit||'g',productAmount:pi.amount||0,unit:pi.unit||bi.unit||'g',calories:num(pick(o,'AMT_NUM1','enerc','ENERC_KCAL')),protein:num(pick(o,'AMT_NUM3','prot','PROT_G')),fat:num(pick(o,'AMT_NUM4','fatce','FATCE_G')),carbs:num(pick(o,'AMT_NUM6','chocdf','CHOCDF_G')),source:'mfds'}}
function sim(a,b){a=norm(a);b=norm(b);if(!a||!b)return 0;if(a===b)return 1;if(a.includes(b)||b.includes(a))return .82;return 0}
function makerSim(a,b){a=norm(a);b=norm(b);if(!a||!b)return 0;return a===b?1:(a.includes(b)||b.includes(a))?.85:0}
function chooseOfficial(offName,offMaker,offQty,raw){
 const clean=v=>norm(v).replace(/주식회사|유한회사/g,'');
 const maker=clean(offMaker),qty=amountUnit(offQty);if(!maker)return null;
 const candidates=raw.map(mapMfds).filter(m=>norm(m.name)===norm(offName)&&clean(m.maker)===maker&&(!qty.unit||m.nutritionUnit===qty.unit));
 const unique=new Map(candidates.map(m=>[[m.name,m.maker,m.nutritionBase,m.nutritionUnit,m.calories,m.carbs,m.protein,m.fat].join('|'),m]));
 if(unique.size!==1)return null;
 const m=[...unique.values()][0];
 // Do not convert missing official fields into zero-valued nutrition.
 const originals=raw.filter(o=>norm(o.FOOD_NM_KR)===norm(m.name)&&clean(o.MAKER_NM)===maker);
 if(!originals.some(o=>['AMT_NUM1','AMT_NUM3','AMT_NUM4','AMT_NUM6'].every(k=>o[k]!=null&&txt(o[k])!==''&&Number.isFinite(Number(o[k]))&&Number(o[k])>=0)))return null;
 return {...m,matchScore:1,matchEvidence:{name:1,maker:1}};
}

export default async function handler(req,res){res.setHeader('Cache-Control','no-store');const code=txt(req.query?.code).replace(/\D/g,'');if(!/^(?:\d{8}|\d{12,14})$/.test(code))return res.status(400).json({error:'INVALID_BARCODE'});try{const r=await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=code,product_name,product_name_ko,generic_name_ko,brands,quantity,nutriments`,{headers:{'User-Agent':'MealLogAI/1.0'},signal:AbortSignal.timeout(8000)});if(r.status!==404&&!r.ok)throw Error('UPSTREAM');const d=await r.json();if(d.status!==1||!d.product)return res.status(404).json({found:false,code});const p=d.product,n=p.nutriments||{},offName=txt(p.product_name_ko||p.generic_name_ko||p.product_name),offMaker=txt(p.brands),offQty=txt(p.quantity),qi=packageAmount(offQty,offName),key=process.env.FOOD_API_KEY;let official=null;if(key){try{const all=[];for(const q of [...new Set([p.product_name_ko,p.generic_name_ko,p.product_name].map(txt))].filter(x=>hasKorean(x)&&x.length>=2))all.push(...await mfdsSearch(q.slice(0,80),key));official=chooseOfficial(offName,offMaker,offQty,all)}catch{ /* barcode nutrition remains available if official DB is offline */ }}const amount=qi.amount||official?.productAmount||100,unit=qi.unit||official?.unit||'g';if(official)return res.status(200).json({found:true,code,...official,barcodeName:offName,barcodeMaker:offMaker,quantity:offQty,productAmount:amount,displayAmount:amount,packageAmountKnown:qi.amount>0,unit,source:'mfds+off',matchedOfficial:true,matchConfidence:'high'});const required=['energy-kcal_100g','carbohydrates_100g','proteins_100g','fat_100g'];if(required.some(k=>n[k]==null||n[k]===''||!Number.isFinite(Number(n[k]))||Number(n[k])<0))return res.status(200).json({found:true,code,name:offName,maker:offMaker,quantity:offQty,productAmount:amount,displayAmount:amount,packageAmountKnown:qi.amount>0,unit,nutritionComplete:false});const get=k=>Number(n[k]),liquid=unit==='mL';return res.status(200).json({found:true,code,name:offName,maker:offMaker,barcodeName:offName,barcodeMaker:offMaker,quantity:offQty,productAmount:amount,displayAmount:amount,packageAmountKnown:qi.amount>0,unit,nutritionBase:100,nutritionUnit:liquid?'mL':'g',basis:liquid?'100mL':'100g',calories:get('energy-kcal_100g'),carbs:get('carbohydrates_100g'),protein:get('proteins_100g'),fat:get('fat_100g'),source:'off',matchedOfficial:false,matchConfidence:'unverified'})}catch(e){return res.status(500).json({error:'BARCODE_API_ERROR'})}}
