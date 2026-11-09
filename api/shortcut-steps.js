import { readFileSync } from 'node:fs';
const config=readFileSync(new URL('../supabase-config.js',import.meta.url),'utf8');
const database=config.match(/https:\/\/[a-z]+\.supabase\.co/)?.[0],publicKey=config.match(/sb_publishable_[a-zA-Z0-9_-]+/)?.[0];
const LIMIT=4096,error=(status,code,message,field)=>({status,code,error:message,...(field?{field}:{})});
function headersError(req){
 if(!/^Bearer mlsteps_[a-f0-9]{64}$/.test(String(req.headers?.authorization||'')))return error(401,'invalid_key','연결 키를 확인해 주세요.');
 if(String(req.headers?.['content-type']||'').split(';')[0].trim().toLowerCase()!=='application/json')return error(415,'invalid_content_type','요청 본문을 JSON으로 설정해 주세요.');
}
function parseBody(raw){
 if(Buffer.isBuffer(raw)||raw instanceof Uint8Array){if(raw.byteLength>LIMIT)throw Error('large');raw=Buffer.from(raw).toString('utf8');}
 for(let i=0;i<2&&typeof raw==='string';i++){if(Buffer.byteLength(raw,'utf8')>LIMIT)throw Error('large');raw=JSON.parse(raw.replace(/^\uFEFF/,'').trim());}
 if(!raw||Array.isArray(raw)||typeof raw!=='object')throw Error('structure');
 if(Buffer.byteLength(JSON.stringify(raw),'utf8')>LIMIT)throw Error('large');
 return raw;
}
function text(v){return v.normalize('NFKC').replace(/[\u200B\u200E\u200F\u061C\u2066-\u2069\uFEFF]/g,'').trim();}
export function validate(req){
 const header=headersError(req);if(header)return header;
 let body;try{body=parseBody(req.body);}catch(e){return e.message==='large'?error(413,'body_too_large','전송 내용이 너무 커요. 날짜와 걸음 수만 보내 주세요.'):error(400,'invalid_json','JSON 본문을 확인해 주세요. date와 steps 항목을 넣어 주세요.');}
 const keys=Object.keys(body);if(!keys.includes('date')||!keys.includes('steps')||keys.some(k=>!['date','steps'].includes(k)))return error(400,'invalid_fields','JSON 본문에는 date와 steps 두 항목만 넣어 주세요. 빈 이름의 항목이나 다른 항목은 지워 주세요.');
 const date=typeof body.date==='string'?text(body.date):'';let validDate=false;
 try{validDate=/^\d{4}-\d{2}-\d{2}$/.test(date)&&date>='2000-01-01'&&date<='2100-01-01'&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;}catch{}
 if(!validDate)return error(400,'invalid_date','date는 2026-10-20처럼 yyyy-MM-dd 형식의 날짜로 보내 주세요.','date');
 let steps=body.steps;
 if(typeof steps==='string'){const value=text(steps);if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.0+)?$/.test(value))return error(400,'invalid_steps','steps는 0~100,000 사이의 정수로 보내 주세요. 숫자 또는 숫자로 된 텍스트를 사용할 수 있어요.','steps');steps=Number(value.replace(/,/g,''));}
 if(typeof steps!=='number'||!Number.isSafeInteger(steps)||steps<0||steps>100000)return error(400,'invalid_steps','steps는 0~100,000 사이의 정수로 보내 주세요. 소수나 단위는 넣지 마세요.','steps');
 return{key:String(req.headers.authorization).slice(7),body:{date,steps}};
}
function fail(res,input){return res.status(input.status).json({ok:false,code:input.code,message:input.error,...(input.field?{field:input.field}:{})});}
async function requestBody(req){
 if(req.body!==undefined)return req.body;
 if(typeof req[Symbol.asyncIterator]!=='function')return undefined;
 const chunks=[];let size=0;for await(const chunk of req){const b=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=b.length;if(size>LIMIT)throw Error('large');chunks.push(b);}return Buffer.concat(chunks);
}
export async function handle(req,res,fetcher=fetch){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return fail(res,error(405,'method_not_allowed','POST 요청만 지원해요.'));}
 const header=headersError(req);if(header)return fail(res,header);
 if(Number(req.headers?.['content-length'])>LIMIT)return fail(res,error(413,'body_too_large','전송 내용이 너무 커요. 날짜와 걸음 수만 보내 주세요.'));
 let body;try{body=await requestBody(req);}catch(e){return fail(res,e.message==='large'?error(413,'body_too_large','전송 내용이 너무 커요. 날짜와 걸음 수만 보내 주세요.'):error(400,'invalid_json','JSON 본문을 다시 확인해 주세요.'));}
 const input=validate({headers:req.headers,body});if(input.status)return fail(res,input);
 if(!database||!publicKey)return fail(res,error(503,'service_unavailable','연결 준비 중이에요. 잠시 후 다시 시도해 주세요.'));
 try{const r=await fetcher(database+'/rest/v1/rpc/ml_shortcut_steps',{method:'POST',headers:{apikey:publicKey,'Content-Type':'application/json'},body:JSON.stringify({p_key:input.key,p_day:input.body.date,p_steps:input.body.steps}),signal:AbortSignal.timeout(10000)}),d=await r.json();
  if(!r.ok){if(d.code==='28000')return fail(res,error(401,'invalid_key','연결이 만료되었거나 해제됐어요. 설정에서 키를 다시 만들어 주세요.'));
   if(d.code==='22023')return fail(res,error(400,'invalid_day','한국 시간 기준 오늘 날짜를 보내 주세요. 과거 또는 미래 날짜는 저장하지 않아요.','date'));
   if(d.message==='shortcut_rate_limit')return fail(res,error(429,'rate_limited','오늘 전송 횟수를 넘었어요. 내일 다시 시도해 주세요.'));
   return fail(res,error(503,'service_unavailable','저장하지 못했어요. 잠시 후 다시 시도해 주세요.'));}
  if(d?.ok!==true)throw Error('invalid_response');return res.status(200).json({ok:true,message:'걸음 수를 전달했어요. MealLogAI 운동 탭에서 새로고침해 주세요.'});
 }catch{return fail(res,error(503,'service_unavailable','저장하지 못했어요. 잠시 후 다시 시도해 주세요.'));}
}
export default handle;
