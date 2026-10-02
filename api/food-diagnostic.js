function safeErrorDetail(data){
  const s=data?.OpenAPI_ServiceResponse ?? data?.openAPI_ServiceResponse ?? null;
  const h=s?.cmmMsgHeader ?? s?.CmmMsgHeader ?? null;
  return {
    errMsg:h?.errMsg ?? null,
    returnAuthMsg:h?.returnAuthMsg ?? null,
    returnReasonCode:h?.returnReasonCode ?? null
  };
}
function parseItems(data){
  const raw=data?.body?.items ?? data?.response?.body?.items ?? data?.items ?? null;
  return Array.isArray(raw)?raw:Array.isArray(raw?.item)?raw.item:raw?.item?[raw.item]:[];
}
async function runTest(label,url){
  try{
    const r=await fetch(url,{headers:{Accept:"application/json"}});
    const text=await r.text();
    let data=null,parseError=null;
    try{data=JSON.parse(text)}catch(e){parseError=String(e?.message||e)}
    const items=parseItems(data);
    return {
      test:label,httpStatus:r.status,ok:r.ok,jsonParsed:!!data,parseError,
      serviceError:safeErrorDetail(data),
      responseHeader:data?.header ?? data?.response?.header ?? null,
      totalCount:data?.body?.totalCount ?? data?.response?.body?.totalCount ?? data?.totalCount ?? null,
      itemCount:items.length,
      firstItem:items[0]||null,
      rawPreview:data?null:text.slice(0,700)
    };
  }catch(e){return {test:label,error:String(e?.message||e)}}
}
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store, max-age=0");
  const q=String(req.query?.q||"").trim();
  const key=String(process.env.FOOD_API_KEY||"").trim();
  if(!key)return res.status(200).json({diagnostic:true,version:"encoding-test-v3",foodApiKeyConfigured:false});
  if(q.length<2)return res.status(200).json({diagnostic:true,version:"encoding-test-v3",foodApiKeyConfigured:true,message:"QUERY_TOO_SHORT"});

  const base="https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo03/getFoodNtrCpntDbInq03";

  // A: URLSearchParams가 환경변수 값을 그대로 다시 인코딩하는 현재 방식
  const a=new URL(base);
  a.searchParams.set("serviceKey",key);
  a.searchParams.set("type","json");
  a.searchParams.set("pageNo","1");
  a.searchParams.set("numOfRows","5");
  a.searchParams.set("FOOD_NM_KR",q);

  // B: 환경변수 값이 이미 percent-encoded라면 1회 decode 후 URLSearchParams에 전달
  let decodedKey=key;
  try{decodedKey=decodeURIComponent(key)}catch(_){}
  const b=new URL(base);
  b.searchParams.set("serviceKey",decodedKey);
  b.searchParams.set("type","json");
  b.searchParams.set("pageNo","1");
  b.searchParams.set("numOfRows","5");
  b.searchParams.set("FOOD_NM_KR",q);

  // C: serviceKey 부분만 문자열로 직접 붙여 encoded key를 보존
  const c=base+"?serviceKey="+key+
    "&type=json&pageNo=1&numOfRows=5&FOOD_NM_KR="+encodeURIComponent(q);

  const results=[];
  results.push(await runTest("A_CURRENT_URLSEARCHPARAMS",a.toString()));
  results.push(await runTest("B_DECODE_ONCE_THEN_URLSEARCHPARAMS",b.toString()));
  results.push(await runTest("C_PRESERVE_KEY_STRING",c));

  return res.status(200).json({
    diagnostic:true,
    diagnosticVersion:"encoding-test-v3",
    route:"/api/food-diagnostic",
    query:q,
    foodApiKeyConfigured:true,
    apiKeyReturned:false,
    keyLooksPercentEncoded:/%[0-9A-Fa-f]{2}/.test(key),
    results
  });
}
