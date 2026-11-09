(()=>{'use strict';
 const key=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/\s/g,'');
 const foodKey=(name,brand='',unit='g')=>key(name)+'|'+key(brand)+'|'+unit;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
 const btn=(text,fn)=>{const b=node('button',text);b.type='button';b.onclick=fn;return b;};
 function recommend(memories,legacy,combos){
  const active=memories.filter(m=>m.status==='confirmed'),blocked=new Set(memories.filter(m=>m.status==='deleted').map(m=>m.category+'|'+m.memory_key));
  const dislikes=active.filter(m=>m.category==='preference'&&m.preference==='dislike').map(m=>key(m.food_name));
  const likes=active.filter(m=>m.category==='preference'&&m.preference==='like').map(m=>key(m.food_name));
  const allowed=f=>!dislikes.some(n=>key(f.name).includes(n));
  const portions=active.filter(m=>m.category==='portion').map(m=>({food:{...m.food,manualBrand:m.brand},title:m.food_name,reason:'사용자 확인 · '+m.food.grams+(m.food.unit||'g')}));
  const old=legacy.filter(m=>!blocked.has('portion|'+foodKey(m.food.name,m.brand,m.food.unit||'g'))).map(m=>({food:{...m.food,manualBrand:m.brand},title:m.food.name,reason:'기존에 승인한 음식·양'}));
  const seen=new Set(),items=[];
  for(const m of [...portions,...old]){const k=foodKey(m.food.name,m.food.manualBrand,m.food.unit);if(allowed(m.food)&&!seen.has(k)){seen.add(k);items.push({...m,foods:[m.food],liked:likes.some(n=>key(m.food.name).includes(n))});}}
  for(const c of combos)if(c.foods?.length&&c.foods.every(allowed))items.push({title:c.name,foods:c.foods,reason:'내가 승인한 조합',liked:c.foods.some(f=>likes.some(n=>key(f.name).includes(n)))});
  return items.sort((a,b)=>Number(b.liked)-Number(a.liked));
 }
 function mount({client,getUser,prepare,onChoose}){
  const host=document.querySelector('#settingsDialog .settingsBody')||document.querySelector('#mealRecords')||document.body;
  const launch=node('section');launch.className='personalMemoryLaunch';launch.append(node('h3','나를 알아가는 MealLog AI'),node('p','취향과 식사량을 기억해 다음 기록을 편하게 도와드려요.'),btn('AI 기억 관리',()=>open()));host.prepend(launch);
  const dialog=node('dialog');dialog.className='personalMemoryDialog';dialog.setAttribute('aria-label','AI 기억 관리');
  const head=node('div');head.className='personalMemoryHead';const close=btn('닫기',()=>{if(!busy){epoch++;dialog.close();}});head.append(node('h2','AI 기억 관리'),close);
  const content=node('div'),status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');dialog.append(head,content,status);document.body.append(dialog);
  let busy=false,epoch=0,owner=null,items=[],legacy=[],combos=[],learning=false;
  dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();else epoch++;});
  async function task(fn){if(busy)return;busy=true;close.disabled=true;const id=getUser()?.id,ticket=epoch;const check=()=>{if(!id||getUser()?.id!==id||ticket!==epoch)throw Error('계정이 바뀌었어요. 다시 열어 주세요.');};status.textContent='확인 중…';
   try{await prepare();check();await fn(check,id);check();}catch(e){if(ticket===epoch)status.textContent='완료하지 못했어요. '+(e.message||'연결을 확인하고 다시 시도해 주세요.')+' 입력 내용은 화면에 남아 있어요.';}finally{busy=false;close.disabled=false;}}
  async function read(check,id){const results=await Promise.all([client.from('user_ai_memories').select('*').eq('user_id',id).order('updated_at',{ascending:false}),client.from('user_settings').select('ai_memory_learning').eq('user_id',id).single(),client.from('food_memories').select('*').eq('user_id',id),client.from('meal_combinations').select('*').eq('user_id',id)]);check();for(const r of results)if(r.error)throw r.error;[items,learning,legacy,combos]=[results[0].data,results[1].data.ai_memory_learning,results[2].data,results[3].data];}
  async function open(){document.querySelector('#settingsDialog')?.close();owner=getUser()?.id;epoch++;dialog.showModal();if(!owner){content.replaceChildren(node('p','로그인한 뒤 이용해 주세요.'));return;}content.replaceChildren();await task(async(check,id)=>{await read(check,id);draw();status.textContent='';});}
  async function change(m,patch){await task(async(check,id)=>{const r=await client.from('user_ai_memories').update(patch).eq('user_id',id).eq('id',m.id).eq('revision',m.revision).select('id').single();check();if(r.error)throw Error(r.error.code==='PGRST116'?'다른 기기에서 변경됐어요. 화면을 다시 열어 주세요.':r.error.message);await read(check,id);draw();status.textContent='서버에 저장했어요. 기존 식단은 그대로 유지돼요.';});}
  function remove(m){if(busy||!confirm('이 기억을 삭제할까요? 같은 항목은 자동으로 다시 학습하지 않아요. 기존 식단은 유지돼요.'))return;void change(m,{status:'deleted',food:m.food});}
  function draw(){content.replaceChildren(node('p','직접 확인한 기억만 입력·추천에 활용해요. 추정은 사실이나 취향으로 단정하지 않아요.'));
   const label=node('label'),toggle=node('input');toggle.type='checkbox';toggle.checked=learning;label.className='memoryToggle';label.append(toggle,node('span','새로운 습관 자동 학습'));content.append(label,node('p','기본 꺼짐 · 켜면 최근 90일 중 3일 이상 반복한 음식의 최근 양을 제안해요. 끄면 새 제안이 멈추고 기존 기억은 보존돼요.'));
   toggle.onchange=()=>{const next=toggle.checked;toggle.checked=learning;void task(async(check,id)=>{const r=await client.from('user_settings').update({ai_memory_learning:next}).eq('user_id',id).select('ai_memory_learning').single();check();if(r.error)throw r.error;learning=r.data.ai_memory_learning;toggle.checked=learning;if(learning){const result=await client.rpc('meallog_learn_memories');check();if(result.error)throw result.error;}await read(check,id);draw();status.textContent=learning?'자동 학습을 켰어요. 추정은 확인 전까지 사용하지 않아요.':'자동 학습을 껐어요. 기존 기억은 보존했어요.';});};
   content.append(btn('음식 취향 직접 추가',()=>{if(!busy)editor();}));
   const confirmed=items.filter(m=>m.status==='confirmed'),proposed=items.filter(m=>m.status==='proposed'),deleted=items.filter(m=>m.status==='deleted');
   for(const [title,list] of [['사용자 확인 · '+confirmed.length+'개',confirmed],['AI 추정 · 확인 대기 '+proposed.length+'개',proposed]]){content.append(node('h3',title));if(!list.length)content.append(node('p','아직 없어요.'));for(const m of list){const card=node('section');card.className='personalMemoryCard';card.append(node('small',m.source==='ai'?'반복 기록 기반 AI 추정'+(m.status==='confirmed'?' · 사용자가 확인함':' · 아직 미확인'):'사용자 직접 입력'),node('h4',m.food_name+(m.brand?' · '+m.brand:'')),node('p',m.category==='preference'?(m.preference==='like'?'좋아해요':'추천에서 제외해요'):'기억한 양 '+m.food.grams+(m.food.unit||'g')));if(m.source==='ai')card.append(node('p',m.evidence_count+'일의 기록 · 추정 신뢰도 '+Math.round(Number(m.confidence)*100)+'% · 평소 양인지 확인해 주세요.'));if(m.status==='proposed')card.append(btn('확인하고 사용',()=>void change(m,{status:'confirmed'})));card.append(btn('수정',()=>{if(!busy)editor(m);}),btn(m.status==='proposed'?'제안 삭제·재학습 차단':'기억 삭제',()=>remove(m)));content.append(card);}}
   content.append(node('h3','내 기억으로 추천'),node('p','좋아하는 음식 우선 · 싫어하는 음식이 포함된 메뉴는 제외해요. 선택 후 이번 양을 확인하고 식단을 저장해 주세요.'));
   const suggestions=recommend(items,legacy,combos);for(const s of suggestions.slice(0,8))content.append(btn(s.title+' · '+s.reason,()=>{if(busy)return;epoch++;dialog.close();onChoose(s.foods,s.reason);}));if(!suggestions.length)content.append(node('p','확인한 식사량이나 기존 음식·조합 기억이 있으면 여기에 제안해요.'));
   const details=node('details');details.append(node('summary','자동 재학습 차단 '+deleted.length+'개'));for(const m of deleted)details.append(node('p',m.food_name+' · '+(m.category==='portion'?'식사량':'취향')+' · 삭제됨'));details.append(node('p','삭제된 내용은 추천에 사용하지 않아요. 재생성 차단용 식별 정보는 계정에 남겨 둬요.'));content.append(details);
   content.append(btn('기억 백업 내려받기',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({exportedAt:new Date().toISOString(),memories:items,foodMemories:legacy,combinations:combos,learning},null,2)],{type:'application/json'}));const a=node('a');a.href=url;a.download='MealLog-personal-memory.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}));
  }
  function editor(m){const form=node('form'),name=node('input');name.value=m?.food_name||'';name.required=true;name.maxLength=200;name.disabled=!!m;const label=node('label','음식 이름');label.append(name);form.append(node('h3',m?'기억 수정':'음식 취향 추가'),label);let value;
   if(m?.category==='portion'){value=node('input');value.type='number';value.min='.001';value.max='100000';value.step='any';value.value=m.food.grams;const l=node('label','기억할 양 ('+(m.food.unit||'g')+')');l.append(value);form.append(l);}else{value=node('select');value.setAttribute('aria-label','음식 취향');for(const [v,t] of [['like','좋아해요'],['dislike','추천에서 제외해요']]){const o=node('option',t);o.value=v;value.append(o);}value.value=m?.preference||'like';const l=node('label','음식 취향');l.append(value);form.append(l);}
   const submit=node('button','확인하고 저장');submit.type='submit';form.append(submit,btn('취소',()=>{if(!busy)draw();}));content.replaceChildren(form);status.textContent='내가 확인한 내용으로 저장해요. 식단 기록은 변경하지 않아요.';
   form.onsubmit=e=>{e.preventDefault();if(busy||!form.reportValidity())return;if(m){let patch={status:'confirmed'};if(m.category==='portion'){try{patch.food=MealLogFoodCore.scaled(m.food,value.value);}catch(error){status.textContent=error.message;return;}}else patch.preference=value.value;void change(m,patch);return;}
    void task(async(check,id)=>{const payload={user_id:id,category:'preference',memory_key:foodKey(name.value.trim(),'', 'preference'),food_name:name.value.trim(),preference:value.value,source:'user',status:'confirmed'};if(!payload.food_name)throw Error('음식 이름을 입력해 주세요.');const r=await client.from('user_ai_memories').insert(payload).select('id').single();check();if(r.error)throw Error(r.error.code==='23505'?'이미 기억하거나 재학습을 차단한 음식이에요. 기존 항목을 확인해 주세요.':r.error.message);await read(check,id);draw();status.textContent='음식 취향을 저장했어요.';});};
  }
  return {accountChanged(){if(owner!==getUser()?.id){epoch++;owner=null;items=[];legacy=[];combos=[];content.replaceChildren();dialog.close();}},reset(){epoch++;items=[];content.replaceChildren();dialog.close();}};
 }
 window.MealLogPersonalMemory={mount,recommend,foodKey};
})();

