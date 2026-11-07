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
    history=[...history,{role:'user',content:message},{role:'assistant',content:d.reply}].slice(-6);return d;
   }catch(error){if(ticket!==sequence||getUser()?.id!==user)throw Error('계정이 바뀌어 대화를 중단했어요.');if(error.name==='AbortError')throw Error('답변이 늦어지고 있어요. 문장은 유지했으니 다시 시도해 주세요.');throw error;}
   finally{clearTimeout(timer);if(ticket===sequence){inFlight=false;controller=null;}}
  }
  return{send,clear,get history(){return history.map(x=>({...x}));}};
 }
 function candidates(d,rows,selectedDay,today){const C=MealLogFoodCore,source=d.source_date||selectedDay;
  const eligible=rows.filter(r=>(d.intent==='repeat'&&!d.source_date?r.meal_date<=today:r.meal_date===source)&&(!d.source_meal_type||r.meal_type===d.source_meal_type)).sort((a,b)=>b.meal_date.localeCompare(a.meal_date)).slice(0,100);
  const all=eligible.flatMap(row=>(row.foods||[]).map((food,index)=>({row,food,index}))),q=C.key(d.food_query);
  const matches=all.filter(x=>[x.food.name,x.food.barcodeProduct?.maker].filter(Boolean).some(n=>C.key(n).includes(q)||q.includes(C.key(n))));
  return{kind:d.intent,day:source,items:(matches.length?matches:all).slice(0,100),destination:d.target_date||(d.intent==='repeat'?today:selectedDay),recent:d.intent==='repeat'&&!d.source_date};
 }
 function quantity(d,food,db){if(d.quantity_unit==='unknown')return null;if(d.quantity_unit==='same')return Number(food.grams);if(d.quantity_unit==='ratio')return Number(food.grams)*d.quantity_value;return MealLogFoodCore.amount(String(d.quantity_value)+d.quantity_unit,food,db);}
 window.MealLogAssistantClient={create,candidates,quantity};
})();
