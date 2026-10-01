const num=v=>{const m=String(v??'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);const n=m?Number(m[0]):0;return Number.isFinite(n)?n:0};
const pick=(o,...ks)=>{for(const k of ks)if(o?.[k]!==undefined&&o[k]!==null&&String(o[k]).trim()!=='')return o[k];return ''};
const hasKorean=s=>/[가-힣]/.test(String(s||''));
function amountUnit(v){const s=String(v||'').trim();const m=s.match(/(\d+(?:\.\d+)?)\s*(ml|mL|㎖|g|kg)/i);if(!m)return {amount:0,unit:''};let amount=Number(m[1]),unit=m[2].toLowerCase();if(unit==='kg'){amount*=1000;unit='g'}return {amount,unit:unit==='ml'?'mL':'g'};}
function basisInfo(v){const x=amountUnit(v);return {nutritionBase:x.amount||100,unit:x.unit||'g'};}
async function mfdsSearch(q,key){
  if(!key||!q||q.length<2)return [];
  const u=new URL('https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo03/getFoodNtrCpntDbInq03');
  u.searchParams.set('serviceKey',key);u.searchParams.set('type','json');u.searchParams.set('pageNo','1');u.searchParams.set('numOfRows','10');u.searchParams.set('FOOD_NM_KR',q);
  const r=await fetch(u);if(!r.ok)return [];const data=await r.json();const raw=data?.body?.items||data?.response?.body?.items||data?.items||[];return Array.isArray(raw)?raw:(raw?.item||[]);
}
function mapMfds(o){const basis=String(pick(o,'nutConSrtrQua','NUT_CONTSERVING','NUTR_CONT_SERVING','SERVING_SIZE')||'100g'),foodSize=String(pick(o,'foodSize','FOOD_SIZE','SERVING_SIZE','SERVING_WT')||''),bi=basisInfo(basis),pi=amountUnit(foodSize);return {name:String(pick(o,'FOOD_NM_KR','foodNmKr','foodNm','FOOD_NM','DESC_KOR')||''),maker:String(pick(o,'companyNm','mkrNm','MFR_NM','CMPNY_NM','makerNm','MAKER_NM','BSSH_NM')||''),basis,foodSize,weight:bi.nutritionBase,nutritionBase:bi.nutritionBase,productAmount:pi.amount||bi.nutritionBase,displayAmount:pi.amount||bi.nutritionBase,unit:pi.unit||bi.unit,calories:num(pick(o,'enerc','ENERC_KCAL','ENERGY_KCAL','ENERGY','NUTR_CONT1','AMT_NUM1')),carbs:num(pick(o,'chocdf','CHOCDF_G','CHOCDF','CARBOHYDRATE_G','NUTR_CONT2','AMT_NUM7')),protein:num(pick(o,'prot','PROT_G','PROT','PROTEIN_G','NUTR_CONT3','AMT_NUM3')),fat:num(pick(o,'fatce','FATCE_G','FAT_G','FAT','NUTR_CONT4','AMT_NUM4')),source:'mfds'};}
export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=86400, stale-while-revalidate=604800');
  const code=String(req.query?.code||'').replace(/\D/g,'');if(code.length<8)return res.status(400).json({error:'INVALID_BARCODE'});
  try{
    const u=`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=code,product_name,product_name_ko,generic_name_ko,brands,quantity,nutriments`;
    const r=await fetch(u,{headers:{'User-Agent':'MealLogAI/1.0 (personal nutrition app)'}});const d=await r.json();if(d.status!==1||!d.product)return res.status(404).json({found:false,code});
    const p=d.product,n=p.nutriments||{},offName=p.product_name_ko||p.generic_name_ko||p.product_name||'',maker=p.brands||'';
    let official=null;const key=process.env.FOOD_API_KEY;
    if(key){const queries=[p.product_name_ko,p.generic_name_ko,p.product_name].filter(x=>hasKorean(x));for(const q of queries){const a=await mfdsSearch(q,key);if(a.length){official=mapMfds(a[0]);break}}}
    if(official)return res.status(200).json({found:true,code,...official,barcodeName:offName,quantity:p.quantity||'',matchedOfficial:true});
    const nnum=(...v)=>{for(const x of v){const z=Number(x);if(Number.isFinite(z))return z}return 0};
    const qi=amountUnit(p.quantity||''),base=100;res.status(200).json({found:true,code,name:offName,maker,quantity:p.quantity||'',weight:base,nutritionBase:base,productAmount:qi.amount||base,displayAmount:qi.amount||base,unit:qi.unit||'g',basis:'100g',calories:nnum(n['energy-kcal_100g'],n['energy-kcal']),carbs:nnum(n.carbohydrates_100g,n.carbohydrates),protein:nnum(n.proteins_100g,n.proteins),fat:nnum(n.fat_100g,n.fat),source:'openfoodfacts',matchedOfficial:false});
  }catch(e){res.status(500).json({error:'BARCODE_API_ERROR'});}
}
