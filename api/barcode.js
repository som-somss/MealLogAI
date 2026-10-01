export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=86400, stale-while-revalidate=604800');
  const code=String(req.query?.code||'').replace(/\D/g,'');
  if(code.length<8) return res.status(400).json({error:'INVALID_BARCODE'});
  try{
    const u=`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=code,product_name,product_name_ko,brands,quantity,nutriments`;
    const r=await fetch(u,{headers:{'User-Agent':'MealLogAI/1.0 (personal nutrition app)'}}); const d=await r.json();
    if(d.status!==1||!d.product)return res.status(404).json({found:false,code});
    const p=d.product,n=p.nutriments||{},num=(...v)=>{for(const x of v){const z=Number(x);if(Number.isFinite(z))return z}return 0};
    res.status(200).json({found:true,code,name:p.product_name_ko||p.product_name||'',maker:p.brands||'',quantity:p.quantity||'',calories:num(n['energy-kcal_100g'],n['energy-kcal']),carbs:num(n.carbohydrates_100g,n.carbohydrates),protein:num(n.proteins_100g,n.proteins),fat:num(n.fat_100g,n.fat)});
  }catch(e){res.status(500).json({error:'BARCODE_API_ERROR'});}
}
