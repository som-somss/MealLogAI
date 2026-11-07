(function(root){
 'use strict';
 function create({userId,client,storage,isCurrent=()=>true,newId=()=>crypto.randomUUID(),now=()=>Date.now()}){
  const prefix='meallog-water-event-v1:'+userId+':',archiveKey='meallog-water-before-sync-v1:'+userId;
  let clock=0;
  const check=()=>{if(!isCurrent())throw Error('계정이 바뀌었어요. 다시 시도해 주세요.');};
  function pending(){
   const result=[];
   for(let i=0;i<storage.length;i++){const key=storage.key(i);if(!key?.startsWith(prefix))continue;
    const event=JSON.parse(storage.getItem(key));
    if(!event||key!==prefix+event.id||!Number.isInteger(event.delta)||!event.date)throw Error('물 기록 복구가 필요해요.');
    result.push(event);
   }
   return result.sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
  }
  function record(date,delta){
   check();if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isInteger(delta)||!delta||Math.abs(delta)>100000)throw Error('물 기록의 날짜와 양을 확인해 주세요.');
   clock=Math.max(now(),clock+1);const event={id:newId(),date,delta,order:clock};
   storage.setItem(prefix+event.id,JSON.stringify(event));return event;
  }
  function archive(activity){check();if(storage.getItem(archiveKey)===null)storage.setItem(archiveKey,JSON.stringify(activity));}
  function reconcile(rows,activity){
   check();const remote=new Map(rows.map(r=>[r.activity_date,r])),events=pending();
   const dates=new Set([...Object.keys(activity),...remote.keys(),...events.map(e=>e.date)]),result={};
   for(const date of dates){
    const local=activity[date]||{},r=remote.get(date);let water=Math.max(0,Number(r?.water)||0);
    for(const e of events)if(e.date===date)water=Math.max(0,water+e.delta);
    let history=local.waterHistoryV2&&Array.isArray(local.waterHistory)?[...local.waterHistory]:[];
    if(history.reduce((sum,n)=>sum+n,0)>water)history=[];
    result[date]={...local,steps:Math.max(Number(local.steps)||0,Number(r?.steps)||0),water,waterHistory:history,waterHistoryV2:true};
   }
   return result;
  }
  async function sync(activity){
   check();
   for(const event of pending()){
    check();const {error}=await client.rpc('apply_water_event',{p_event_id:event.id,p_date:event.date,p_delta:event.delta});
    if(error)throw error;check();storage.removeItem(prefix+event.id);
   }
   const {data,error}=await client.from('daily_activity').select('*').eq('user_id',userId);
   if(error)throw error;check();return reconcile(data||[],activity);
  }
  return {record,pending,reconcile,sync,archive,archiveKey};
 }
 root.MealLogWaterSync={create};
 if(typeof module==='object'&&module.exports)module.exports=root.MealLogWaterSync;
})(typeof globalThis!=='undefined'?globalThis:this);
