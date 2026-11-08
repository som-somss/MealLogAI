(()=>{
 'use strict';
 const C=window.MealLogNutritionCore,columns='carbs_goal,protein_goal,fat_goal',fmt=n=>Number(n.toFixed(1)).toLocaleString('ko-KR');
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(text,action)=>{const n=node('button',text,'secondary');n.type='button';n.onclick=action;return n;};
 let connection=null,owner=null,targets=C.goals(),loaded=false,loadError='',epoch=0,readVersion=0,editing=false,saving=false,base=null;
 const card=node('section',null,'nutritionGoals panel');card.setAttribute('aria-label','영양 목표와 진행률');
 const head=node('div',null,'nutritionGoalsHead'),title=node('h2','영양 목표'),edit=button('목표 설정',()=>void open());head.append(title,edit);
 const dateLabel=node('small',null,'nutritionGoalsDate'),rows=node('div',null,'nutritionGoalRows'),notice=node('p',null,'nutritionGoalsNotice');notice.setAttribute('role','status');
 card.append(head,dateLabel,rows,notice);document.querySelector('.summary')?.after(card);
 const dialog=node('dialog',null,'nutritionGoalsDialog');dialog.setAttribute('aria-label','영양 목표 설정');
 const form=node('form'),heading=node('div',null,'nutritionGoalsHead'),close=button('닫기',()=>{if(!saving){editing=false;epoch++;dialog.close();}});heading.append(node('h2','내 영양 목표'),close);
 form.append(heading,node('p','매일 비교할 목표량을 직접 입력해 주세요. 비워 두면 해당 목표를 사용하지 않아요.','nutritionGoalsHint'));
 const inputs={};for(const {key,label,max} of C.fields){const wrap=node('label',label+' 목표 (g)'),input=node('input');input.type='number';input.min='0';input.max=String(max);input.step='any';input.inputMode='decimal';input.setAttribute('aria-label',label+' 목표 g');wrap.append(input);form.append(wrap);inputs[key]=input;}
 form.append(node('p','단백질 목표는 AI 코치와 함께 사용해요. 목표는 현재 설정 기준이며, 과거 날짜를 볼 때도 같은 목표와 비교해요.','nutritionGoalsHint'));
 const message=node('p');message.setAttribute('role','status');message.setAttribute('aria-live','polite');
 const submit=node('button','목표 저장');submit.type='submit';form.append(message,submit);dialog.append(form);document.body.append(dialog);
 dialog.addEventListener('cancel',e=>{if(saving)e.preventDefault();else{editing=false;epoch++;}});
 function lock(value,loading=false){saving=value&&!loading;close.disabled=saving;submit.disabled=value;for(const input of Object.values(inputs))input.disabled=value;}
 function check(ticket,id){if(ticket!==epoch||!id||connection?.getUser()?.id!==id)throw Error('계정이나 화면이 바뀌었어요. 다시 열어 주세요.');}
 function render(){
  if(typeof state==='undefined'||typeof selectedDate==='undefined')return;
  const meals=(state.meals||[]).filter(m=>m.time?.slice(0,10)===selectedDate),foods=meals.flatMap(m=>m.foods||[]);
  title.textContent='영양 목표';dateLabel.textContent=selectedDate+' 기록 · 현재 설정한 하루 목표';rows.replaceChildren();
  const totals=C.summarize(foods,loaded?targets:{});
  for(const item of totals){
   const row=node('div',null,'nutritionGoalRow nutritionGoal-'+item.key),line=node('div',null,'nutritionGoalLine');line.append(node('strong',item.label),node('span',(item.missing?'확인된 ':'')+fmt(item.consumed)+'g'+(item.goal?' / '+fmt(item.goal)+'g':'')));row.append(line);
   if(item.percent!==null){const track=node('div',null,'nutritionGoalTrack'),fill=node('i');track.setAttribute('role','progressbar');track.setAttribute('aria-label',item.label+' 목표 대비 기록량');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',String(Math.min(100,item.percent)));track.setAttribute('aria-valuetext',fmt(item.consumed)+'g / 목표 '+fmt(item.goal)+'g · '+fmt(item.percent)+'%');fill.style.width=Math.min(100,item.percent)+'%';track.append(fill);row.append(track);}
   row.append(node('small',item.missing?'영양정보 미입력 '+item.missing+'개 · 목표 비교 보류':!loaded?(loadError?'목표 불러오기 필요':owner?'목표 확인 중…':'로그인 후 목표 설정'):!item.goal?'목표 미설정':!foods.length?'아직 기록 없음':item.over>0?'설정한 목표보다 '+fmt(item.over)+'g 많아요':item.remaining===0?'설정한 목표에 도달했어요':fmt(item.remaining)+'g 남음'));rows.append(row);
  }
  notice.textContent=loadError||(!meals.length?'아직 식사 기록이 없어요. 실제로 먹지 않았다는 뜻은 아니에요.':totals.some(item=>item.missing>0)?'영양소별 확인된 값만 합산해요. 미입력 정보를 채우면 목표와 비교할 수 있어요.':'기록한 음식 기준이에요. 빠진 식사가 있는지 함께 확인해 주세요.');
  edit.textContent=loadError?'목표 다시 불러오기':loaded&&Object.values(targets).some(v=>v!=null)?'목표 수정':'목표 설정';
 }
 async function query(q){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{return await q.abortSignal(controller.signal);}finally{clearTimeout(timer);}}
 async function read(id){const r=await query(connection.client.from('ai_coach_settings').select(columns).eq('user_id',id).maybeSingle());if(r.error)throw r.error;return r.data;}
 async function refresh(){const id=connection?.getUser()?.id,version=++readVersion;if(!id){loaded=false;targets=C.goals();loadError='';render();return;}
  try{const data=await read(id);if(id!==connection?.getUser()?.id||version!==readVersion)return;targets=C.goals(data);loaded=true;loadError='';}
  catch{if(id!==connection?.getUser()?.id||version!==readVersion)return;loaded=false;loadError='목표를 불러오지 못했어요. 연결 후 다시 불러와 주세요.';}render();
 }
 async function open(){
  if(saving||editing)return;const id=connection?.getUser()?.id;if(!id){loadError='로그인하면 영양 목표를 저장하고 다른 기기에서도 사용할 수 있어요.';render();document.querySelector('#accountBtn')?.click();return;}
  document.querySelector('#settingsDialog')?.close();editing=true;const ticket=++epoch;lock(true,true);for(const input of Object.values(inputs))input.value='';message.textContent='현재 목표를 불러오는 중…';dialog.showModal();
  try{const data=await read(id);check(ticket,id);base=data;targets=C.goals(data);loaded=true;loadError='';for(const {key} of C.fields)inputs[key].value=targets[key]??'';message.textContent='입력한 목표는 저장한 뒤 적용돼요.';render();}
  catch(e){if(ticket===epoch){base=undefined;message.textContent='목표를 불러오지 못했어요. 창을 닫고 다시 열어 주세요.';}}
  finally{if(ticket===epoch){lock(false);submit.disabled=base===undefined;}}
 }
 form.onsubmit=async e=>{
  e.preventDefault();if(saving||base===undefined||!form.reportValidity())return;const ticket=epoch,id=connection?.getUser()?.id;
  try{const values=C.payload(Object.fromEntries(C.fields.map(({key})=>[key,inputs[key].value])));check(ticket,id);lock(true);message.textContent='목표를 저장하는 중…';
   let q;if(base===null)q=connection.client.from('ai_coach_settings').insert({user_id:id,...values});
   else{q=connection.client.from('ai_coach_settings').update({...values,updated_at:new Date().toISOString()}).eq('user_id',id);for(const {key} of C.fields){const k=key+'_goal';q=base[k]==null?q.is(k,null):q.eq(k,base[k]);}}
   const r=await query(q.select(columns).maybeSingle());check(ticket,id);if(r.error||!r.data)throw Error(r.error?.code==='23505'||!r.error?'다른 화면이나 기기에서 목표가 바뀌었어요. 창을 닫고 다시 확인해 주세요.':'저장 결과를 확인하지 못했어요. 입력은 유지했으니 연결 후 다시 시도해 주세요.');
   targets=C.goals(r.data);base=r.data;loaded=true;loadError='';editing=false;dialog.close();render();notice.textContent='영양 목표를 저장했어요. AI 코치에도 같은 단백질 목표를 사용해요.';window.dispatchEvent(new Event('meallog:nutrition-goals'));
  }catch(e){if(ticket===epoch)message.textContent=e.message||'목표를 저장하지 못했어요.';}
  finally{if(ticket===epoch)lock(false);}
 };
 function accountChanged(){const id=connection?.getUser()?.id||null;if(owner===id)return;owner=id;epoch++;readVersion++;targets=C.goals();loaded=false;loadError='';editing=false;base=undefined;lock(false);dialog.close();for(const input of Object.values(inputs))input.value='';render();void refresh();}
 window.addEventListener('meallog:nutrition-goals',()=>void refresh());
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!editing)void refresh();});
 const settings=document.querySelector('#settingsDialog .settingsBody');if(settings){const section=node('section',null,'nutritionGoalsSettings');section.append(node('h3','영양 목표'),node('p','탄수화물·단백질·지방 목표를 설정하고 기록과 비교해요.'),button('영양 목표 설정',()=>void open()));settings.append(section);}
 window.MealLogNutritionGoals={render,mount(options){connection=options;accountChanged();render();return {accountChanged,refresh};}};render();
})();
