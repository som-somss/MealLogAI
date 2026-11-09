(function(root){'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 function ranked(records,kind,mode='recent'){
  const groups=new Map();
  for(const r of records||[]){
   const time=String(kind==='food'?r.time:r.record_date||'');
   for(const value of kind==='food'?(r.foods||[]):[r]){
    const key=kind==='food'?String(value.name||'').trim().toLowerCase().replace(/\s+/g,''):value.exercise_id;
    if(!key)continue;const old=groups.get(key);
    if(!old)groups.set(key,{key,count:1,time,value:clone(value)});
    else{old.count++;if(time>old.time){old.time=time;old.value=clone(value);}}
   }
  }
  return [...groups.values()].sort((a,b)=>(mode==='frequent'?b.count-a.count:0)||b.time.localeCompare(a.time)||a.key.localeCompare(b.key)).slice(0,8);
 }
 function exerciseDraft(record,day,generation){return {id:crypto.randomUUID(),record_date:day,exercise_id:record.exercise_id,minutes:record.minutes??null,sets:clone(record.sets||[]),in_steps:!!record.in_steps,revision:0,key:crypto.randomUUID(),generation};}
 root.MealLogRepeat={ranked,exerciseDraft};
})(typeof window==='object'?window:globalThis);
