function safeErrorDetail(data){
  const s = data?.OpenAPI_ServiceResponse ?? data?.openAPI_ServiceResponse ?? null;
  const h = s?.cmmMsgHeader ?? s?.CmmMsgHeader ?? null;
  return {
    errMsg: h?.errMsg ?? null,
    returnAuthMsg: h?.returnAuthMsg ?? null,
    returnReasonCode: h?.returnReasonCode ?? null
  };
}

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store, max-age=0");
  const q=String(req.query?.q||"").trim();
  const key=process.env.FOOD_API_KEY;

  if(!key) return res.status(200).json({
    diagnostic:true,route:"/api/food-diagnostic",query:q,
    foodApiKeyConfigured:false,message:"FOOD_API_KEY_NOT_SET"
  });

  if(q.length<2) return res.status(200).json({
    diagnostic:true,route:"/api/food-diagnostic",query:q,
    foodApiKeyConfigured:true,message:"QUERY_TOO_SHORT"
  });

  const results=[];
  for(const param of ["FOOD_NM_KR","foodNm"]){
    try{
      const u=new URL("https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo03/getFoodNtrCpntDbInq03");
      u.searchParams.set("serviceKey",key);
      u.searchParams.set("type","json");
      u.searchParams.set("pageNo","1");
      u.searchParams.set("numOfRows","5");
      u.searchParams.set(param,q);

      const r=await fetch(u);
      const text=await r.text();
      let data=null,parseError=null;
      try{ data=JSON.parse(text); }catch(e){ parseError=String(e?.message||e); }

      const raw=data?.body?.items ?? data?.response?.body?.items ?? data?.items ?? null;
      const items=Array.isArray(raw)?raw:Array.isArray(raw?.item)?raw.item:raw?.item?[raw.item]:[];
      const first=items[0]||null;

      results.push({
        test:param,
        httpStatus:r.status,
        ok:r.ok,
        jsonParsed:!!data,
        parseError,
        serviceError:safeErrorDetail(data),
        responseHeader:data?.header ?? data?.response?.header ?? null,
        totalCount:data?.body?.totalCount ?? data?.response?.body?.totalCount ?? data?.totalCount ?? null,
        itemCount:items.length,
        firstItemKeys:first&&typeof first==="object"?Object.keys(first):[],
        firstItem:first,
        rawPreview:data?null:text.slice(0,1000)
      });
    }catch(e){
      results.push({test:param,error:String(e?.message||e)});
    }
  }

  return res.status(200).json({
    diagnostic:true,
    diagnosticVersion:"error-detail-v2",
    route:"/api/food-diagnostic",
    query:q,
    foodApiKeyConfigured:true,
    apiKeyReturned:false,
    results
  });
}
