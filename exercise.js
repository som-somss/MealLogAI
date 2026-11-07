(function(root){'use strict';
 const core=root.MealLogExerciseCore,$=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 let controller;const fmt=n=>Number(n||0).toLocaleString('ko-KR');
 function mount({client,getUser,prepare,onChange}){
  let owner=null,epoch=0,data=null,loadedDay=null,loading=false,busy=false,draft=null,loadAgain=false,recentRecords=[],recentLoading=false,recentMode='recent',recentVersion=0;
  const generation=()=>localStorage.getItem('meallog-reset-generation-v1:'+owner),key=()=> 'meallog-exercise-draft-v1:'+owner;
  const notice=s=>$('exerciseStatus').textContent=s;
  function persist(){if(owner&&draft)localStorage.setItem(key(),JSON.stringify(draft));}
  function discard(){if(owner)localStorage.removeItem(key());draft=null;$('exerciseEditor').hidden=true;}
  function clearRecent(){recentVersion++;recentRecords=[];recentLoading=false;$('repeatExercises').replaceChildren();}
  function reset(){clearRecent();epoch++;data=null;loadedDay=null;loading=false;busy=false;discard();render();}
  function accountChanged(){const next=getUser()?.id||null;if(next===owner)return;clearRecent();epoch++;owner=next;data=null;loadedDay=null;loading=false;busy=false;draft=null;$('exerciseEditor').hidden=true;notice('');render();if(owner)void refresh();}
  function render(){
   const box=$('exerciseContent'),home=$('homeExerciseContent');if(!box||!home)return;
   $('exerciseDate').value=selectedDate;$('exerciseDate').max=localDateKey(new Date());$('exerciseAdd').disabled=!owner||busy;$('exerciseEditorFields').disabled=busy;$('exerciseExport').disabled=!owner;
   for(const target of [box,home])target.replaceChildren();
   if(!owner){for(const target of [box,home])target.append(el('p','로그인하면 운동 기록을 저장할 수 있어요.','muted'));return;}
   if(!data||loadedDay!==selectedDate){for(const target of [box,home])target.append(el('p',loading?'활동 기록을 불러오는 중이에요.':'활동 기록을 확인해 주세요.','muted'));return;}
   const m=data.metrics;
   for(const target of [box,home]){
    const hero=el('div',undefined,'exerciseHero'),top=el('div',undefined,'exerciseHeroTop'),copy=el('div');copy.append(el('span','활동으로 소모한 예상 열량'),el('strong',m.has_estimate?fmt(m.total_kcal)+' kcal':'아직 계산 전이에요.'));const mascot=el('div',undefined,'exerciseMascot');mascot.setAttribute('aria-hidden','true');mascot.append(document.querySelector('[data-view="exercise"] .tabIcon').cloneNode(true));top.append(copy,mascot);hero.append(top);const track=el('div',undefined,'exerciseSplitTrack'),steps=el('i'),workout=el('i'),total=Number(m.total_kcal)||0;steps.style.width=(total?Number(m.step_kcal||0)/total*100:0)+'%';workout.style.width=(total?Number(m.workout_kcal||0)/total*100:0)+'%';track.setAttribute('aria-hidden','true');track.append(steps,workout);hero.append(track);
    const split=el('div',undefined,'exerciseSplit');split.append(el('span','👟 걸음 '+(m.step_kcal==null?'미계산':fmt(m.step_kcal)+' kcal')),el('span','🏋️ 운동 '+fmt(m.workout_kcal)+' kcal'));hero.append(split);target.append(hero);
    if(!m.weight_available)target.append(el('p','체중을 기록하면 소모량을 계산할 수 있어요. 실제 체중은 친구에게 공개하지 않아요.','exerciseNote'));
    if(m.unestimated)target.append(el('p','시간 또는 체중이 없는 운동 '+m.unestimated+'건은 합계에서 제외했어요.','exerciseNote'));
   }
   const overview=el('div',undefined,'exerciseOverview');const stepCard=el('div',undefined,'exerciseOverviewCard'),workCard=el('div',undefined,'exerciseOverviewCard');stepCard.append(el('small','👟 이날의 걸음'),el('strong',fmt(m.steps)+' 걸음'));const stepEdit=el('button','걸음 수 직접 입력','exerciseTextButton');stepEdit.type='button';stepEdit.onclick=()=>$('editSteps').click();stepCard.append(stepEdit);const minutes=data.records.reduce((n,r)=>n+(Number(r.minutes)||0),0);workCard.append(el('small','🌱 이날 한 운동'),el('strong',fmt(minutes)+' 분'),el('small',data.records.length+'개의 운동을 기록했어요.'));overview.append(stepCard,workCard);box.append(overview);
   const list=el('div',undefined,'exerciseLogs');list.append(el('h3','차곡차곡 운동 기록'));
   for(const r of data.records){const c=core.catalog.find(c=>c.id===r.exercise_id),card=el('article',undefined,'exerciseLog'),icon=el('span',c?.category==='time'?'👟':'🏋️','exerciseLogIcon');icon.setAttribute('aria-hidden','true');card.append(icon);card.append(el('strong',c?.name||'운동'),el('span',r.kcal==null?'미계산':fmt(r.kcal)+' kcal','exerciseKcal'));
    card.append(el('p',c?.category==='time'?r.minutes+'분':r.sets.map(s=>(c?.category==='bodyweight'?'':s.weight+'kg × ')+s.reps+'회').join(' / ')+(r.minutes?' · '+r.minutes+'분':''),'muted'));
    if(r.in_steps)card.append(el('small','걸음 소모량에 포함 · 운동 합계에서는 제외','exerciseNote'));
    const actions=el('div',undefined,'exerciseActions');for(const [text,fn] of [['수정',()=>open(r)],['삭제',()=>remove(r)]]){const b=el('button',text,'secondary');b.type='button';b.disabled=busy;b.onclick=fn;actions.append(b);}card.append(actions);list.append(card);
   }
   if(!data.records.length)list.append(el('p','가볍게 움직인 오늘도 남겨 볼까요?','muted'));box.append(list);
   const saved=localStorage.getItem(key());$('exerciseResume').hidden=!saved||!!draft;
  }
  async function refresh(){if(!owner)return;if(loading){loadAgain=true;return;}const token=epoch,id=owner,day=selectedDate;loading=true;render();try{
    await prepare();if(token!==epoch||id!==owner)return;
    const r=await client.rpc('ml_exercise_day',{p_day:day});if(r.error)throw r.error;
    if(token!==epoch||id!==owner||day!==selectedDate)return;
    if(!r.data||r.data.date!==day||!Array.isArray(r.data.records)||!r.data.metrics)throw Error('invalid_response');
    data=r.data;loadedDay=day;if(draft)prediction();notice('');
   }catch(e){if(token===epoch)notice('활동 기록을 불러오지 못했어요. 새로고침해 주세요.');}
   finally{if(token===epoch){loading=false;render();if(loadAgain){loadAgain=false;void refresh();}}}
  }
  function renderHook(){render();if(owner&&loadedDay!==selectedDate&&!loading)void refresh();}
  function open(record){
   if(!owner||busy)return;if(draft&&!confirm('작성 중인 운동을 닫고 다른 운동을 열까요?'))return;
   $('exerciseSearchPanel').hidden=true;draft=record?{...structuredClone(record),key:crypto.randomUUID(),generation:generation()}:{id:crypto.randomUUID(),record_date:selectedDate,exercise_id:'walk',minutes:30,sets:[],in_steps:true,revision:0,key:crypto.randomUUID(),generation:generation()};
   persist();editor();$('exerciseEditor').scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  function collect(){if(!draft||busy)return;draft.minutes=$('exerciseMinutes').value===''?null:Number($('exerciseMinutes').value);draft.in_steps=$('exerciseInSteps').checked;
   draft.sets=[...$('exerciseSets').querySelectorAll('.exerciseSet')].map(row=>({weight:row.querySelector('[data-field="weight"]')?Number(row.querySelector('[data-field="weight"]').value):0,reps:row.querySelector('[data-field="reps"]').value===''?NaN:Number(row.querySelector('[data-field="reps"]').value)}));
   draft.key=crypto.randomUUID();persist();prediction();
  }
  function prediction(){if(!draft)return;const kg=loadedDay===draft.record_date?Number(data?.weight_kg):null,value=core.estimate(draft.exercise_id,draft.minutes,kg),needsWeight=!(kg>0&&kg<=500);$('exercisePrediction').textContent=needsWeight?'칼로리 계산에는 본인 체중이 필요해요. 아래에서 운동 날짜 또는 그 이전의 체중을 기록해 주세요.':draft.minutes==null?'운동 시간을 입력하면 예상 칼로리를 계산해요. 세트 기록만 저장해도 괜찮아요.':value==null?'운동 시간을 1~1,440분으로 입력해 주세요.':'예상 '+fmt(value)+' kcal'+(draft.in_steps?' · 걸음 소모량에 포함':'' );$('exerciseWeightNeeded').hidden=!needsWeight;document.querySelectorAll('[data-exercise-minute]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.exerciseMinute)===draft.minutes)));$('exerciseSave').disabled=busy||!core.validate(draft);}
  function editor(){if(!draft)return;const c=core.catalog.find(c=>c.id===draft.exercise_id);if(!c)return;const form=$('exerciseEditor');form.hidden=false;$('exerciseChosen').textContent=c.name+' · '+draft.record_date;
   $('exerciseMinutesLabel').textContent=c.category==='time'?'운동 시간 (분)':'운동 시간 (분, 선택)';$('exerciseMinutes').value=draft.minutes??'';$('exerciseMinutes').required=c.category==='time';$('exerciseInSteps').checked=draft.in_steps;$('exerciseOverlap').hidden=!c.overlap;
   const sets=$('exerciseSets');sets.replaceChildren();$('exerciseStrength').hidden=c.category==='time';
   if(c.category!=='time')draft.sets.forEach((s,i)=>{const row=el('div',undefined,'exerciseSet');row.append(el('span',(i+1)+'세트'));
    if(c.category!=='bodyweight'){const l=el('label','무게 kg'),input=el('input');input.type='number';input.min='0';input.max='1000';input.step='0.1';input.value=s.weight??'';input.dataset.field='weight';input.required=true;l.append(input);row.append(l);}
    const l=el('label','반복 횟수'),reps=el('input');reps.type='number';reps.min='1';reps.max='500';reps.step='1';reps.value=s.reps??'';reps.required=true;reps.dataset.field='reps';l.append(reps);row.append(l);
    const del=el('button','−','secondary');del.type='button';del.setAttribute('aria-label',(i+1)+'세트 삭제');del.disabled=draft.sets.length===1;del.onclick=()=>{collect();draft.sets.splice(i,1);persist();editor();};row.append(del);sets.append(row);
   });$('exerciseSetAdd').disabled=draft.sets.length>=10;prediction();render();
  }
  function search(){const list=$('exerciseSearchResults');list.replaceChildren();const query=$('exerciseSearch').value.trim();list.hidden=!query;if(!query)return;const results=core.search(query);for(const c of results){const b=el('button',undefined,'exerciseChoice');b.append(el('strong',c.name),el('small',c.category==='time'?'시간으로 기록 · 선택하기 →':'무게·횟수·세트로 기록 · 선택하기 →'));b.type='button';b.disabled=!owner||busy;b.onclick=()=>{if(draft&&!confirm('작성 중인 운동을 새 운동으로 바꿀까요?'))return;draft=null;open();draft.exercise_id=c.id;draft.minutes=c.category==='time'?30:null;draft.sets=c.category==='time'?[]:[{weight:0,reps:10},{weight:0,reps:10},{weight:0,reps:10}];draft.in_steps=c.overlap;persist();editor();};list.append(b);}if(!results.length)list.append(el('p','다른 운동명이나 기구 이름으로 검색해 주세요.','muted'));}
  async function send(value,isDelete=false){if(busy||!owner)return;const token=epoch,id=owner;busy=true;if(draft)prediction();render();try{
    await prepare();if(token!==epoch||owner!==id)return;
    if(value.generation!==generation()){discard();throw Error('record_reset_reload_required');}
    const r=await client.rpc('ml_save_exercise',{p_id:value.id,p_day:value.record_date,p_exercise:value.exercise_id,p_minutes:value.minutes,p_sets:value.sets,p_in_steps:value.in_steps,p_revision:value.revision,p_key:value.key,p_delete:isDelete});if(r.error)throw r.error;
    if(token!==epoch||owner!==id)return;if(!isDelete)discard();await refresh();onChange?.();notice(isDelete?'운동 기록을 삭제했어요.':'운동 기록을 저장했어요.');
   }catch(e){if(token===epoch){const msg=String(e.message||e);notice(msg.includes('reset')?'기록이 초기화되었어요. 새로 기록해 주세요.':msg.includes('conflict')?'다른 기기에서 바뀐 기록이에요. 새로고침 후 다시 열어 주세요.':'저장하지 못했어요. 입력 내용을 보관했으니 다시 시도해 주세요.');}}
   finally{if(token===epoch){busy=false;render();if(draft)prediction();}}
  }
  function remove(r){if(confirm('이 운동 기록 1건을 삭제할까요?'))void send({...r,key:crypto.randomUUID(),generation:generation()},true);}

  function renderRecent(){
   const box=$('repeatExercises');box.replaceChildren();
   for(const mode of ['recent','frequent'])$('repeatExercise'+(mode==='recent'?'Recent':'Frequent')).setAttribute('aria-pressed',String(mode===recentMode));
   if(recentLoading){box.append(el('p','이전 운동을 불러오는 중이에요.','muted'));return;}
   const items=root.MealLogRepeat.ranked(recentRecords,'exercise',recentMode).filter(i=>core.catalog.some(c=>c.id===i.value.exercise_id));
   if(!items.length){box.append(el('p','운동을 기록하면 여기에 모아 드려요.','muted'));return;}
   for(const item of items){const r=item.value,c=core.catalog.find(c=>c.id===r.exercise_id),b=el('button',undefined,'repeatChoice');b.type='button';b.disabled=busy||!owner;
    b.append(el('strong',c.name),el('small',(r.minutes?r.minutes+'분':'시간 미입력')+(r.sets?.length?' · '+r.sets.length+'세트':'')+(recentMode==='frequent'?' · '+item.count+'번 기록':'')));
    b.onclick=()=>{if(!owner||busy)return;if(draft&&!confirm('작성 중인 운동을 닫고 이전 운동을 불러올까요?'))return;draft=root.MealLogRepeat.exerciseDraft(r,selectedDate,generation());$('exerciseSearchPanel').hidden=true;persist();editor();notice('이전 운동을 불러왔어요. 시간과 세트를 확인한 뒤 저장해 주세요.');$('exerciseEditor').scrollIntoView({block:'nearest',behavior:'smooth'});};box.append(b);
   }
  }
  async function loadRecent(){
   const ticket=++recentVersion,token=epoch,id=owner,gen=generation();if(!id)return;recentRecords=[];recentLoading=true;renderRecent();
   try{await prepare();if(ticket!==recentVersion||token!==epoch||id!==owner)return;const rows=[];
    for(let offset=0;offset<=1000000;offset+=200){const r=await client.rpc('ml_exercise_export',{p_offset:offset});if(r.error)throw r.error;
     if(ticket!==recentVersion||token!==epoch||id!==owner||gen!==generation())return;if(!Array.isArray(r.data))throw Error('invalid_response');rows.push(...r.data);if(r.data.length<200)break;}
    recentRecords=rows;
   }catch(e){if(ticket===recentVersion&&token===epoch)notice('이전 운동을 불러오지 못했어요. 검색으로 새로 기록할 수 있어요.');}
   finally{if(ticket===recentVersion&&token===epoch){recentLoading=false;renderRecent();}}
  }
  $('repeatExerciseRecent').onclick=()=>{recentMode='recent';renderRecent();};
  $('repeatExerciseFrequent').onclick=()=>{recentMode='frequent';renderRecent();};

  $('exerciseAdd').onclick=()=>{$('exerciseSearch').value='';search();$('exerciseSearchPanel').hidden=false;void loadRecent();$('exerciseSearch').focus();};$('exerciseSearch').oninput=search;
  $('exerciseSearchClose').onclick=()=>$('exerciseSearchPanel').hidden=true;
  document.querySelectorAll('[data-exercise-minute]').forEach(b=>b.onclick=()=>{if(!draft||busy)return;$('exerciseMinutes').value=b.dataset.exerciseMinute;collect();});
  $('exerciseEditor').oninput=collect;$('exerciseEditor').onsubmit=e=>{e.preventDefault();if(draft&&core.validate(draft))void send(structuredClone(draft));};
  $('exerciseCancel').onclick=()=>{if(!busy&&confirm('작성 중인 운동을 지울까요?')){discard();render();}};
  $('exerciseSetAdd').onclick=()=>{collect();if(draft.sets.length<10)draft.sets.push({...draft.sets.at(-1)});persist();editor();};
  $('exerciseResume').onclick=()=>{try{const saved=JSON.parse(localStorage.getItem(key()));if(saved.generation!==generation()||!core.catalog.some(c=>c.id===saved.exercise_id)){localStorage.removeItem(key());notice('초기화 전 작성한 내용은 다시 불러올 수 없어요.');render();return;}draft=saved;editor();}catch{notice('작성 내용을 읽지 못했어요.');}};
  function recordWeight(){if(busy)return;document.querySelector('[data-view="weight"]').click();$('weightDate').value=draft?.record_date||selectedDate;}
  $('exerciseRefresh').onclick=()=>void refresh();$('exerciseSteps').onclick=()=>$('editSteps').click();$('exerciseWeight').onclick=recordWeight;$('exerciseWeightNeeded').onclick=recordWeight;
  $('exerciseDate').onchange=()=>{const day=$('exerciseDate').value;if(/^\d{4}-\d{2}-\d{2}$/.test(day)&&day>='2000-01-01'&&day<=localDateKey(new Date())){selectedDate=day;root.render();}};
  $('exerciseExport').onclick=async()=>{if(!owner)return;const ticket=epoch;try{const rows=[];for(let offset=0;offset<=1000000;offset+=200){const r=await client.rpc('ml_exercise_export',{p_offset:offset});if(r.error)throw r.error;if(ticket!==epoch)return;if(!Array.isArray(r.data))throw Error('invalid_response');rows.push(...r.data);if(r.data.length<200)break;}const b=new Blob([JSON.stringify({type:'MealLogAI-exercise-history',exportedAt:new Date().toISOString(),records:rows},null,2)],{type:'application/json'}),a=el('a');a.href=URL.createObjectURL(b);a.download='MealLogAI-운동내역-'+selectedDate+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);notice('운동 내역을 내려받았어요. 이 파일은 보관용이며 자동 복원은 지원하지 않아요.');}catch{notice('운동 내역을 내려받지 못했어요. 다시 시도해 주세요.');}};
  $('homeExerciseOpen').onclick=()=>{document.querySelector('[data-view="exercise"]').click();void refresh();};
  document.querySelector('[data-view="exercise"]').addEventListener('click',()=>void refresh());
  setInterval(()=>{if(owner&&!document.hidden&&(!$('exerciseView').hidden||!$('diaryView').hidden))void refresh();},15000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&owner)void refresh();});
  render();return controller={accountChanged,refresh,reset,render:renderHook};
 }
 root.MealLogExercise={mount,render:()=>controller?.render(),reset:()=>controller?.reset()};
})(window);


