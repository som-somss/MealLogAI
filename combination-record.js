(()=>{
 'use strict';
 const C=window.MealLogCombinationCore,fmt=n=>Number(Number(n).toFixed(4)).toLocaleString('ko-KR');
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=fn;return b;};
 function input(label,type='number',value='',max=100000){const wrap=el('label',label),n=el('input');n.type=type;n.value=value??'';n.setAttribute('aria-label',label);if(type==='number'){n.min='.001';n.max=String(max);n.step='any';n.inputMode='decimal';}wrap.append(n);return {wrap,n};}
 function select(label,options,value){const wrap=el('label',label),n=el('select');n.setAttribute('aria-label',label);for(const [v,text]of options){const o=el('option',text);o.value=v;n.append(o);}n.value=value;wrap.append(n);return {wrap,n};}
 const summary=foods=>foods.map(f=>f.name+' '+fmt(f.grams)+(f.unit||'g')).join(' · ');
 const journal=id=>'meallog-combination-pending-v1:'+id;
 function mount({client,getUser,prepare,refresh,getDay,onManage}){
  let owner=getUser()?.id||null,epoch=0,busy=false,writing=false,controller=null,combinations=[],memories=[],pending=null;
  const launch=button('내 조합 다시 기록하기',()=>void open());launch.className='combinationRecordLaunch';document.querySelector('#mealRecords')?.before(launch);
  const dialog=el('dialog',null,'combinationRecordDialog');dialog.setAttribute('aria-label','내 조합 다시 기록하기');
  const header=el('div',null,'combinationRecordHead'),heading=el('h2','내 조합 다시 기록하기'),close=button('닫기',leave);header.append(heading,close);
  const body=el('fieldset',null,'combinationRecordBody'),message=el('p',null,'combinationRecordStatus');message.setAttribute('role','status');message.setAttribute('aria-live','polite');dialog.append(header,body,message);document.body.append(dialog);
  function leave(){if(writing)return;epoch++;controller?.abort();busy=false;body.disabled=false;dialog.close();}
  dialog.addEventListener('cancel',e=>{if(writing)e.preventDefault();else leave();});
  async function task(fn,write=false,onError){if(busy)return;const ticket=++epoch,id=getUser()?.id;if(!id)return;busy=true;writing=write;close.disabled=write;body.disabled=true;controller=new AbortController();const signal=controller.signal;
   const check=()=>{if(ticket!==epoch||getUser()?.id!==id||signal.aborted)throw Error('계정이나 화면이 바뀌었어요. 다시 열어 주세요.');};
   const query=async q=>{const timer=setTimeout(()=>controller?.signal===signal&&controller.abort(),20000);try{const r=await q.abortSignal(signal);check();if(r.error)throw r.error;return r.data;}finally{clearTimeout(timer);}};
   try{await prepare();check();await fn({id,check,query});}
   catch(e){if(ticket===epoch){message.textContent=errorText(e);onError?.();}}
   finally{if(ticket===epoch){busy=false;writing=false;close.disabled=false;body.disabled=false;}}
  }
  function errorText(e){const text=e.message||'';if(/combination_changed|PGRST116/.test(text)||e.code==='PGRST116')return '다른 화면에서 조합이나 분량이 바뀌었어요. 목록으로 돌아가 최신 내용을 불러와 주세요.';if(/basis_missing/.test(text))return '전체 인분 또는 완성 무게를 먼저 저장해 주세요.';if(/reset|generation/.test(text))return '기록이 초기화됐어요. 창을 닫고 다시 열어 주세요.';if(/recorded_meal_unavailable/.test(text))return '이미 저장했던 식사가 삭제됐어요. 새 기록이 필요하면 목록에서 다시 시작해 주세요.';return /invalid_|empty_meal|request_reused/.test(text)?'입력한 날짜·양과 요청을 확인해 주세요.':e instanceof Error&&!/fetch|abort|network/i.test(text)?text:'연결 또는 저장 결과를 확인하지 못했어요. 입력은 유지됩니다.';}
  function clearPending(){if(owner)localStorage.removeItem(journal(owner));pending=null;}
  function recover(){try{const p=JSON.parse(localStorage.getItem(journal(owner))||'null');return p?.owner===owner&&/^[a-f0-9-]{36}$/i.test(p.args?.p_request)&&p.args?.p_combination?p:null;}catch{return null;}}
  async function load(query,id){const [saved,approved]=await Promise.all([query(client.from('meal_combinations').select('*').eq('user_id',id).order('updated_at',{ascending:false}).limit(100)),query(client.from('food_memories').select('*').eq('user_id',id).order('updated_at',{ascending:false}).limit(1000))]);combinations=saved;memories=approved;}
  async function open(comboId,draft){if(busy)return;if(!getUser()){document.querySelector('#accountBtn')?.click();return;}owner=getUser().id;dialog.showModal();heading.textContent='내 조합 다시 기록하기';body.replaceChildren(el('p','내 조합을 불러오는 중…'));message.textContent='';pending=recover();if(pending){pendingView();return;}
   await task(async({query,id})=>{await load(query,id);if(draft){const meal=await query(client.from('meals').select('id,user_id,meal_date,meal_type,foods').eq('user_id',id).eq('id',draft.request_id).maybeSingle());if(meal){savedView(meal,true);return;}}
    if(comboId){const combo=combinations.find(c=>c.id===comboId)||await query(client.from('meal_combinations').select('*').eq('user_id',id).eq('id',comboId).single());if(draft&&combo.revision!==draft.revision)throw Error('대화 이후 조합이 바뀌었어요. 코치에게 다시 요청하거나 홈에서 최신 조합을 선택해 주세요.');editor(combo,draft);}else list();},false,()=>body.replaceChildren(el('p','조합을 아직 불러오지 못했어요.'),button('조합 다시 불러오기',()=>void open(comboId,draft))));
  }
  function openDraft(draft){const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
   if(!draft||draft.version!==1||!uuid(draft.request_id)||!uuid(draft.combination_id)||!Number.isInteger(draft.revision)||draft.revision<0||!/^\d{4}-\d{2}-\d{2}$/.test(draft.day)||!['아침','점심','저녁','간식'].includes(draft.meal_type)||!['whole','servings','weight'].includes(draft.mode)||typeof draft.quantity!=='number'||!Number.isFinite(draft.quantity)||draft.quantity<=0||draft.quantity>100000)throw Error('기록 초안 정보를 확인하지 못했어요. 코치에게 다시 요청해 주세요.');
   return open(draft.combination_id,structuredClone(draft));
  }
  function list(){heading.textContent='내 조합 다시 기록하기';message.textContent='';body.replaceChildren(el('p','저장한 재료를 불러와 이번에 먹은 양만 바꿔요. 기본 조합과 과거 기록은 유지돼요.'));
   if(!combinations.length)body.append(el('p','아직 내 조합이 없어요. 기존 식사를 조합으로 저장한 뒤 다시 사용할 수 있어요.'));
   for(const combo of combinations){const card=el('section',null,'combinationChoice');card.append(el('h3',combo.name),el('p',summary(combo.foods)),el('small',combo.yield_servings?'전체 '+fmt(combo.yield_servings)+'인분':'전체 인분 미설정'),button(combo.name+' 다시 기록',()=>editor(combo)));body.append(card);}
   if(combinations.length===100)body.append(el('small','최근 조합 100개를 보여드려요. 더 오래된 조합은 내 조합 관리에서 선택해 주세요.'));
   body.append(button('내 조합 만들기·관리',()=>{leave();onManage?.();}));
  }
  function editor(initial,draft){let combo=structuredClone(initial),overrides=[],preview=null;heading.textContent=combo.name;message.textContent=draft?'대화에서 요청한 날짜·끼니·양을 가져왔어요. 개인 분량은 재료별 버튼으로 선택해 주세요. 아직 식사로 저장하지 않았어요.':'';
   const form=el('form'),info=el('p','이번 식사에 먹은 양을 계산해요. 재료별 양 수정·제외는 이번 기록에만 적용돼요.','combinationHint');
   const date=input('기록 날짜','date',draft?.day||getDay()),time=input('식사 시각','time','12:00'),kind=select('식사 종류',['아침','점심','저녁','간식'].map(x=>[x,x]),draft?.meal_type||combo.meal_type);
   date.n.required=true;time.n.required=true;const when=el('div',null,'combinationWhen');when.append(date.wrap,time.wrap,kind.wrap);
   const mode=select('먹은 양의 기준',[['whole','조합 전체 기준'],['servings','인분으로 계산'],['weight','완성한 음식의 g으로 계산']],draft?.mode||'whole'),amount=input('먹은 양','number',draft?.quantity??1);amount.n.required=true;
   const calculation=el('p',null,'combinationCalculation'),rows=el('div'),totals=el('p',null,'combinationTotals');totals.setAttribute('aria-live','polite');
   const settings=el('details',null,'combinationBasis');settings.append(el('summary','전체 인분·완성 무게 설정'),el('p','아래 재료 전체가 몇 인분인지, 조리를 마친 음식 전체가 몇 g인지 입력해요. 원재료 무게를 더해 완성 무게로 사용하지 않아요.'));
   const servings=input('조합 전체 인분','number',combo.yield_servings,1000),weight=input('완성한 음식 전체 무게 (g)','number',combo.cooked_weight);
   const saveBasis=button('조합의 전체 분량 저장',()=>void task(async({id,query})=>{const values={yield_servings:C.optional(servings.n.value,1000),cooked_weight:C.optional(weight.n.value,100000),revision:combo.revision+1};
    let updated;try{updated=await query(client.from('meal_combinations').update(values).eq('id',combo.id).eq('user_id',id).eq('revision',combo.revision).select('*').single());}catch(e){const current=await query(client.from('meal_combinations').select('*').eq('id',combo.id).eq('user_id',id).single());if(current?.revision!==values.revision||current.yield_servings!==values.yield_servings||current.cooked_weight!==values.cooked_weight)throw e;updated=current;}
    combo=updated;combinations=combinations.map(c=>c.id===combo.id?combo:c);update(true);message.textContent='조합의 전체 분량을 저장했어요. 재료를 바꾸면 완성 무게는 다시 확인해 주세요.';
   },true));settings.append(servings.wrap,weight.wrap,saveBasis);
   const quick=el('div',null,'combinationQuick');for(const [label,value]of [['전체 그대로',1],['전체의 절반',.5],['전체의 ¼',.25]])quick.append(button(label,()=>{mode.n.value='whole';amount.n.value=String(value);overrides=[];update(true);}));
   const review=button('식사 저장 전 확인',()=>{if(!form.reportValidity())return;try{preview=C.calculate(combo,mode.n.value,amount.n.value,overrides);const args={p_request:draft?.request_id||crypto.randomUUID(),p_combination:combo.id,p_revision:combo.revision,p_day:date.n.value,p_time:date.n.value+'T'+time.n.value+':00+09:00',p_type:kind.n.value,p_mode:mode.n.value,p_quantity:Number(amount.n.value),p_overrides:overrides.map(o=>o.excluded?{index:o.index,excluded:true}:{index:o.index,amount:Number(o.amount)})};reviewView(args,preview,()=>{heading.textContent=combo.name;body.replaceChildren(form);message.textContent='';});}catch(e){message.textContent=e.message;}});
   function change(index,patch){overrides=overrides.filter(o=>o.index!==index);if(patch)overrides.push({index,...patch});update(false);}
   function paintRows(){rows.replaceChildren();combo.foods.forEach((food,index)=>{const card=el('section',null,'combinationIngredient'),o=overrides.find(x=>x.index===index);let normal=null;try{normal=C.scale(food,Number(food.grams)*C.basis(combo,mode.n.value,amount.n.value).ratio).grams;}catch{}
     const qty=input(food.name+' 이번 양 ('+(food.unit||'g')+')','number',o?.amount??normal??food.grams);qty.n.required=true;qty.n.disabled=!!o?.excluded;const exclude=el('input');exclude.type='checkbox';exclude.checked=!!o?.excluded;const label=el('label',null,'combinationExclude');label.append(exclude,el('span','이번 식사에서 제외'));
     qty.n.oninput=()=>change(index,{amount:qty.n.value});exclude.onchange=()=>{change(index,exclude.checked?{excluded:true}:null);paintRows();};
     const personal=el('div',null,'combinationPersonal');function paintPortions(){personal.replaceChildren();const saved=C.portions(food,memories,owner);for(const m of saved)personal.append(button('내 '+m.portion_label+' · '+fmt(m.food.grams)+(food.unit||'g'),()=>{change(index,{amount:Number(m.food.grams)});paintRows();}));}
     paintPortions();const memoryForm=el('div');card.append(el('h3',food.name),el('small','조합 전체 기준 '+fmt(food.grams)+(food.unit||'g')+(food.manualBrand?' · '+food.manualBrand:'')),qty.wrap,label,personal,
      button('이 음식의 개인 분량 기억',()=>portionEditor(memoryForm,food,qty.n.value,()=>{paintPortions();memoryForm.replaceChildren();})),memoryForm,button('이 재료를 계산된 양으로',()=>{change(index,null);paintRows();}));rows.append(card);
    });}
   function update(repaint=false){try{preview=C.calculate(combo,mode.n.value,amount.n.value,overrides);calculation.textContent=C.description(preview)+(overrides.length?' · 개별 수정 '+overrides.length+'개':'');totals.textContent=C.nutrients.map((k,i)=>['열량','탄수화물','단백질','지방'][i]+' '+(preview.totals[k]==null?'미입력 포함':fmt(preview.totals[k])+(k==='calories'?' kcal':'g'))).join(' · ');review.disabled=false;}
    catch(e){preview=null;calculation.textContent=e.message;totals.textContent='';review.disabled=true;}if(repaint)paintRows();}
   mode.n.onchange=()=>{overrides=[];amount.n.value='1';update(true);};amount.n.oninput=()=>{overrides=[];update(true);};
   form.onsubmit=e=>{e.preventDefault();review.click();};form.append(info,when,settings,mode.wrap,amount.wrap,quick,calculation,el('p','전체 기준이나 먹은 양을 바꾸면 개별 수정은 초기화돼요.','combinationHint'),rows,totals,review,button('조합 목록으로',list));body.replaceChildren(form);update(true);
  }
  function portionEditor(host,food,amount,onSaved){const name=input('내 분량 이름','text',''),qty=input('기억할 양 ('+(food.unit||'g')+')','number',amount);name.n.maxLength=60;const hint=el('p','예: 한 알, 내 밥공기 한 그릇. 이 음식·브랜드·단위에만 적용돼요. 영양정보는 조합 기준으로 계산해요.');
   let memoryId=crypto.randomUUID();const save=button('개인 분량 기억 저장',()=>void task(async({id,query})=>{const label=name.n.value.trim();if(!label||label.length>60)throw Error('분량 이름을 1~60자로 입력해 주세요.');const matches=C.portions(food,memories,id).filter(m=>C.key(m.portion_label)===C.key(label));if(matches.length>1)throw Error('같은 이름의 분량이 여러 개예요. 내 음식 기억에서 정리하거나 다른 이름으로 저장해 주세요.');const old=matches[0],savedFood=C.scale(food,qty.n.value),nextRevision=(old?.revision??-1)+1;
    const values={id:old?.id||memoryId,user_id:id,food:savedFood,brand:food.manualBrand||'',portion_label:label,approved_at:new Date().toISOString(),updated_at:new Date().toISOString(),revision:nextRevision};let saved;
    try{const q=old?client.from('food_memories').update(values).eq('id',old.id).eq('user_id',id).eq('revision',old.revision):client.from('food_memories').insert(values);saved=await query(q.select('*').single());}
    catch(e){const actual=await query(client.from('food_memories').select('*').eq('id',values.id).eq('user_id',id).maybeSingle());if(actual?.revision!==nextRevision||actual.portion_label!==label||!C.sameFood(actual.food,savedFood))throw e;saved=actual;}
    memories=[saved,...memories.filter(m=>m.id!==saved.id)];onSaved();message.textContent='내 '+label+' = '+fmt(savedFood.grams)+(food.unit||'g')+'으로 기억했어요. 다음 기록에서 선택할 수 있어요.';
   },true));name.n.oninput=()=>{const existing=C.portions(food,memories,owner).find(m=>C.key(m.portion_label)===C.key(name.n.value));save.textContent=existing?'기존 분량을 '+fmt(existing.food.grams)+(food.unit||'g')+'에서 변경':'개인 분량 기억 저장';};host.replaceChildren(hint,name.wrap,qty.wrap,save,button('분량 기억 취소',()=>host.replaceChildren()));
  }
  function reviewView(args,calculation,back){heading.textContent='식사 저장 전 확인';body.replaceChildren(el('p',args.p_day+' '+args.p_type+' · '+args.p_time.slice(11,16)),el('p',C.description(calculation)),el('p',summary(calculation.foods)),el('p','위 음식과 양을 새 식사로 저장해요. 기본 조합과 과거 기록은 유지돼요.'),button('확인하고 식사 저장',()=>{try{pending={owner,args};localStorage.setItem(journal(owner),JSON.stringify(pending));pendingView();void record();}catch{pending=null;message.textContent='중복 저장을 막기 위한 대기 정보를 이 기기에 보관하지 못했어요. 저장 공간을 확인해 주세요.';}}),button('양 다시 수정',back));message.textContent='';}
  function pendingView(){heading.textContent='식사 저장 결과 확인';body.replaceChildren(el('p','연결이 끊겼다면 이미 저장됐을 수 있어요. 같은 요청으로 결과를 확인하며 중복으로 추가하지 않아요.'),el('p',pending.args.p_day+' '+pending.args.p_type),button('같은 요청으로 저장 결과 확인',()=>void record()));}
  function savedView(meal,existing=false){heading.textContent=existing?'이미 기록한 식사예요':'식사를 저장했어요';body.replaceChildren(el('p',meal.meal_date+' '+meal.meal_type),el('p',summary(meal.foods)),el('p',existing?'현재 서버에 저장된 음식이에요. 같은 대화의 요청으로 다시 추가하지 않아요. 새 식사는 코치에게 새로 요청해 주세요.':'기본 조합과 과거 기록은 유지됐어요.'),button('다른 조합 기록하기',()=>void open()));message.textContent='서버 저장을 확인했어요.';}
  async function record(){if(!pending)return;const attempt=pending;message.textContent='식사를 저장하고 서버 기록을 확인하는 중…';await task(async({id,query,check})=>{
   try{const result=await query(client.rpc('meallog_record_combination',attempt.args));if(result?.meal_id!==attempt.args.p_request)throw Error('저장 결과의 식사를 확인하지 못했어요. 같은 요청으로 다시 확인해 주세요.');const meal=await query(client.from('meals').select('id,user_id,meal_date,meal_type,meal_time,foods').eq('user_id',id).eq('id',result.meal_id).single());check();clearPending();heading.textContent=result.changed?'이미 저장한 식사가 변경됐어요':'식사를 저장했어요';body.replaceChildren(el('p',meal.meal_date+' '+meal.meal_type),el('p',summary(meal.foods)),el('p',result.changed?'아래는 현재 서버에 저장된 음식이에요. 같은 식사를 다시 추가하지 않았어요.':'기본 조합과 과거 기록은 유지됐어요.'),button('다른 조합 기록하기',()=>void open()));message.textContent='서버 저장을 확인했어요.';void Promise.resolve().then(refresh).catch(()=>{if(getUser()?.id===id&&dialog.open)message.textContent='서버 저장은 완료됐어요. 홈 목록은 새로고침해 주세요.';});}
   catch(e){if(/combination_changed|basis_missing|invalid_|empty_meal|recorded_meal_unavailable|request_reused/.test(e.message||'')){clearPending();body.append(button('최신 조합 목록 불러오기',()=>void open()));}throw e;}
  },true);}
  function reset(clear=false){if(clear&&owner)localStorage.removeItem(journal(owner));epoch++;controller?.abort();busy=false;writing=false;owner=getUser()?.id||null;pending=null;memories=[];combinations=[];body.replaceChildren();body.disabled=false;close.disabled=false;dialog.close();}
  return {open,openDraft,accountChanged(){if(owner!==(getUser()?.id||null))reset();},reset(){reset(true);}};
 }
 window.MealLogCombinationRecord={mount};
})();
