(()=>{'use strict';
 function create({client,getUser,onUsage,fetcher=(...a)=>fetch(...a)}){
  let history=[],owner=null,sequence=0,controller=null,inFlight=false;
  function clear(){sequence++;controller?.abort();controller=null;history=[];owner=null;inFlight=false;}
  async function send(message,selectedDate){
   const user=getUser()?.id;if(!user)throw Error('로그인한 뒤 이용해 주세요.');
   if(owner&&owner!==user)clear();if(inFlight)throw Error('앞선 답변을 기다려 주세요.');
   owner=user;const ticket=sequence;inFlight=true;const pending=new AbortController();controller=pending;const timer=setTimeout(()=>pending.abort(),45000);
   const check=()=>{if(ticket!==sequence||getUser()?.id!==user)throw Error('계정이 바뀌어 대화를 중단했어요.');};
   try{
    const {data,error}=await client.auth.getSession();check();if(error||data.session?.user?.id!==user||!data.session?.access_token)throw Error('로그인 상태를 확인해 주세요.');
    const response=await fetcher('/api/meal-assistant',{method:'POST',headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({message,selected_date:selectedDate,history:history.slice(-6)}),cache:'no-store',signal:pending.signal});check();
    const result=await response.json();check();if(result.usage)onUsage?.(result.usage,user);if(!response.ok||result.ok!==true){const error=Error(result.message||'AI 연결을 확인해 주세요. 기본 입력은 계속 이용할 수 있어요.');error.code=result.code;throw error;}
    const d=result.interpretation;if(!d||!['add','edit','repeat','clarify'].includes(d.intent)||typeof d.reply!=='string'||typeof d.food_query!=='string')throw Error('응답을 읽지 못했어요. 다시 알려 주세요.');
    const earlierRequests=history.filter(turn=>turn.role==='user').map(turn=>turn.content).reverse();
    history=[...history,{role:'user',content:message},{role:'assistant',content:d.reply}].slice(-6);
    return {...d,sourceText:message,earlierRequests};
   }catch(error){if(ticket!==sequence||getUser()?.id!==user)throw Error('계정이 바뀌어 대화를 중단했어요.');if(error.name==='AbortError')throw Error('답변이 늦어지고 있어요. 문장은 유지했으니 다시 시도해 주세요.');throw error;}
   finally{clearTimeout(timer);if(ticket===sequence){inFlight=false;controller=null;}}
  }
  return{send,clear,get history(){return history.map(x=>({...x}));}};
 }
 function candidates(d,rows,selectedDay,today,requireFull=false){
  if(d.intent==='add' && (d.items?.length||0)<=1 && /지난\s*번|저번|전에\s*(?:먹|기록)|같은\s*제품/.test(d.sourceText||'')){
   const repeat=candidates({...d,intent:'repeat',source_date:null,source_meal_type:null},rows,selectedDay,today,true);
   if(repeat.items.length)return repeat;
  }
  const C=MealLogFoodCore,source=d.source_date||selectedDay;
  const eligible=rows.filter(r=>(d.intent==='repeat'&&!d.source_date?r.meal_date<=today:r.meal_date===source)&&(!d.source_meal_type||r.meal_type===d.source_meal_type)).sort((a,b)=>b.meal_date.localeCompare(a.meal_date)).slice(0,100);
  const all=eligible.flatMap(row=>(row.foods||[]).map((food,index)=>({row,food,index}))),q=C.key(d.food_query);
  const requests=[d.sourceText,...(d.intent==='repeat'?d.earlierRequests||[]:[])].map(C.key);
  const ranked=all.map(item=>{
   const names=[item.food.name,item.food.barcodeProduct?.name,item.food.barcodeProduct?.maker,item.food.manualBrand].filter(Boolean);
   const terms=[...new Set(names.flatMap(name=>name.split(/[^\p{L}\p{N}]+/u).map(C.key)).filter(term=>term.length>=2))];
   const evidence=requests.map(request=>terms.filter(term=>request.includes(term)).length);
   let uncovered=q;
   for(const term of [...terms].sort((a,b)=>b.length-a.length))uncovered=uncovered.replace(term,'');
   const full=!!q&&(uncovered===''||MealLogFoodQuery.matches(d.food_query,item.food)||names.some(name=>C.key(name).includes(q)));
   const partial=!!q&&names.some(name=>q.includes(C.key(name)));
   return {item,evidence,full,partial};
  }).filter(x=>x.full||(!requireFull&&x.partial));
  let preferred=ranked;
  for(let i=0;i<requests.length&&preferred.length>1;i++){
   const best=Math.max(...preferred.map(x=>x.evidence[i]));
   preferred=preferred.filter(x=>x.evidence[i]===best);
  }
  const complete=preferred.filter(x=>x.full);
  const matches=(complete.length?complete:preferred).map(x=>x.item);
  return{kind:d.intent,day:source,items:(matches.length||requireFull?matches:all).slice(0,100),destination:d.target_date||(d.intent==='repeat'?today:selectedDay),recent:d.intent==='repeat'&&!d.source_date};
 }
 function quantity(d,food,db){if(d.quantity_unit==='unknown')return null;if(d.quantity_unit==='same')return Number(food.grams);if(d.quantity_unit==='ratio')return Number(food.grams)*d.quantity_value;try{return MealLogFoodCore.amount(String(d.quantity_value)+d.quantity_unit,food,db);}catch(error){if(d.intent==='repeat'&&d.quantity_unit==='개'&&d.quantity_value===1&&/당 양을 몰라요/.test(error.message))return null;throw error;}}
 function statedTime(text){
  const matches=[...String(text).matchAll(/(?<!\d)(오전|오후)?\s*(\d{1,2})\s*(?:시\s*(?:(\d{1,2})\s*분|반)?|:\s*(\d{2}))/g)];
  if(matches.length!==1)return null;
  const [,period,hour,minutes,colonMinutes]=matches[0];
  let h=Number(hour);const m=Number(minutes??colonMinutes??(matches[0][0].endsWith('반')?30:0));
  if(h>23||m>59||(period&&(h<1||h>12)))return null;
  if(period)h=h%12+(period==='오후'?12:0);
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
 }
 window.MealLogAssistantClient={create,candidates,quantity,statedTime};
})();
