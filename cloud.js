(() => {
  const cfgOk = window.MEALLOG_SUPABASE_URL && window.MEALLOG_SUPABASE_KEY && !window.MEALLOG_SUPABASE_KEY.includes('PASTE_YOUR');
  const accountBtn=document.querySelector('#accountBtn'), cloudAccountBtn=document.querySelector('#cloudAccountBtn'), authDialog=document.querySelector('#authDialog');
  const badge=document.querySelector('#cloudBadge'), statusText=document.querySelector('#cloudStatusText');
  if(!window.supabase || !cfgOk){
    badge.textContent='키 입력 필요'; statusText.textContent='Supabase Publishable key를 supabase-config.js에 입력하면 로그인이 활성화됩니다.';
    [accountBtn,cloudAccountBtn].forEach(b=>b.onclick=()=>alert('먼저 supabase-config.js에 Publishable key를 입력해주세요.'));
    return;
  }
  let recordEpoch=0,resetting=false,pendingAssistantRefresh=null;const confirmedSteps=new Map();const stepKey=(owner,date)=>owner+'|'+date;
  const recordReset=MealLogReset.create({storage:localStorage,getState:()=>state,saveLocal:()=>originalSave(),onClear:()=>{pendingAssistantRefresh=null;confirmedSteps.clear();document.querySelector('#stepsDialog')?.close();window.MealLogShortcut?.reset();window.MealLogExercise?.reset();window.MealLogWeekly?.reset();foodMemoryPanel?.reset();window.MealLogListEntry?.reset();recordEpoch++;mealSync=null;mealSyncUser=null;waterSync=null;waterSyncUser=null;initialMealRecovery=0;state.meals=getMealSync().reconcile([],[]);if(typeof photoData!=='undefined')photoData='';if(typeof editingMealId!=='undefined')editingMealId=null;if(typeof hideMealModal==='function')hideMealModal();if(typeof clearPreviewUrl==='function')clearPreviewUrl();if(typeof setPhotoUI==='function')setPhotoUI();}});
  const sb=window.supabase.createClient(window.MEALLOG_SUPABASE_URL,window.MEALLOG_SUPABASE_KEY,{global:{fetch:recordReset.fetch}});
  let user=null, loadingMeals=false, syncing=false, syncTimer=null, recoveringPassword=false, savingSteps=false;
  MealLogPhotoStorage.configure(sb,()=>user);
  window.mealPreparePhoto=async value=>{if(user&&(loadingMeals||!getMealSync().ready))throw Error('기록을 불러오는 중이에요. 잠시 후 다시 저장해 주세요.');return MealLogPhotoStorage.upload(value);};
  const DELETED_NAME="__MEALLOG_DELETED__";
  // Daily goal is account-wide, not per-device. New accounts start at 1200 kcal.
  const SETTINGS_DEFAULT_GOAL=1200;
  function applyCloudSettings(r){
    state.goal=Number(r.goal_kcal)||SETTINGS_DEFAULT_GOAL;
    state.targetWeight=r.target_weight==null?null:Number(r.target_weight);
    state.stepsGoal=Number(r.steps_goal)||8000;
    state.waterGoal=Number(r.water_goal)||2000;
  }
  async function loadCloudSettings(){
    const {data,error}=await sb.from('user_settings').select('*').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    if(data){applyCloudSettings(data);return;}
    // First device to initialize the account creates a shared 1200-kcal goal.
    const initial={user_id:user.id,goal_kcal:SETTINGS_DEFAULT_GOAL,
      target_weight:state.targetWeight||null,steps_goal:state.stepsGoal||8000,
      water_goal:state.waterGoal||2000};
    const {error:insertError}=await sb.from('user_settings').upsert(initial,{onConflict:'user_id',ignoreDuplicates:true});
    if(insertError)throw insertError;
    const {data:stored,error:readError}=await sb.from('user_settings').select('*').eq('user_id',user.id).single();
    if(readError)throw readError;
    applyCloudSettings(stored);
  }
  let mealSync=null, mealSyncUser=null, changedDuringSync=false, initialMealRecovery=0;
  function getMealSync(){
    if(!user)throw Error('로그인이 필요해요.');
    if(!mealSync||mealSyncUser!==user.id){
      const owner=user.id;
      mealSync=MealLogSync.create({userId:owner,client:sb,storage:localStorage,isCurrent:()=>user?.id===owner});
      mealSyncUser=owner;
    }
    return mealSync;
  }
  const recoveryButton=document.createElement('button');
  recoveryButton.type='button';recoveryButton.className='secondary';recoveryButton.textContent='복구용 백업 저장';
  recoveryButton.onclick=()=>{
    if(!user)return;
    const engine=getMealSync(),archive=JSON.parse(localStorage.getItem(engine.recoveryKey)||'[]');
    const pending=JSON.parse(localStorage.getItem('meallog-meal-sync-v1:'+user.id)||'{"pending":[]}');
    const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),recovery:archive,pending:pending.pending,waterBeforeUpgrade:JSON.parse(localStorage.getItem(getWaterSync().archiveKey)||'{}')},null,2)],{type:'application/json'});
    const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='MealLogAI-recovery-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),500);
  };
  document.querySelector('#signedInPanel').appendChild(recoveryButton);

  let waterSync=null,waterSyncUser=null;
  function getWaterSync(){
    if(!user)throw Error('로그인이 필요해요.');
    if(!waterSync||waterSyncUser!==user.id){const owner=user.id;waterSync=MealLogWaterSync.create({userId:owner,client:sb,storage:localStorage,isCurrent:()=>user?.id===owner});waterSyncUser=owner;waterSync.archive(state.activity||{});}
    return waterSync;
  }
  window.mealRecordWater=(date,delta)=>{
    if(!user)return true;
    try{getWaterSync().record(date,delta);return true;}
    catch(error){document.querySelector('#waterStatus').textContent='물 기록 저장을 확인해 주세요. '+error.message;return false;}
  };

  const originalSave=save;
  save=function(){
    originalSave();
    if(user){
      try{const engine=getMealSync();if(!engine.ready){document.querySelector('#syncMessage').textContent='기록을 불러오는 중이에요. 잠시 후 저장 상태를 확인해 주세요.';return;}engine.capture(state.meals||[]);window.dispatchEvent(new Event('meallog:sync'));}
      catch(error){document.querySelector('#syncState').textContent='저장 확인 필요';document.querySelector('#syncMessage').textContent=error.message;return;}
      if(syncing)changedDuringSync=true;
      clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncAll(false),700);
    }
  };
  window.mealCommit=async()=>{
    if(!user){originalSave();return;}
    if(loadingMeals||resetting)throw Error('기록을 불러오는 중이에요. 잠시 후 다시 저장해 주세요.');
    const engine=getMealSync();if(!engine.ready)throw Error('기록을 먼저 불러온 뒤 저장해 주세요.');
    // Persist the account-owned queue before reporting a meal as saved.
    engine.capture(state.meals||[]);originalSave();window.dispatchEvent(new Event('meallog:sync'));
    if(syncing)changedDuringSync=true;
    clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncAll(false),700);
  };
  const mealRecovery=MealLogRecovery.mount({getUser:()=>user,getMeals:()=>state.meals||[],restore:async meal=>{
    if(!user||loadingMeals||syncing)throw Error('동기화가 끝난 뒤 다시 눌러 주세요.');
    const owner=user.id;if(state.meals.some(m=>m.id===meal.id))return;
    meal.photo=await MealLogPhotoStorage.upload(meal.photo||'');
    if(user?.id!==owner)throw Error('계정이 변경됐어요.');
    const previous=state.meals;state.meals=[...previous,meal];
    try{await window.mealCommit();selectedDate=meal.time.slice(0,10);render();}
    catch(error){state.meals=previous;throw error;}
  }});
  // Manual step saves have their own confirmed write, independent of meal sync.
  window.mealRecordSteps=async(date,steps)=>{
    if(!user)throw Error('걸음 수를 저장하려면 먼저 로그인해 주세요.');
    if(savingSteps||resetting)throw Error('저장 중이에요. 잠시 후 다시 시도해 주세요.');
    const owner=user.id,epoch=recordEpoch; savingSteps=true;
    const check=()=>{if(user?.id!==owner||recordEpoch!==epoch)throw Error('계정이나 기록이 변경됐어요. 다시 열어 주세요.');};
    try{
      const deadline=Date.now()+20000;
      while(syncing){if(Date.now()>deadline)throw Error('동기화가 지연되고 있어요. 잠시 후 다시 저장해 주세요.');await new Promise(resolve=>setTimeout(resolve,100));check();}
      if(await recordReset.prepare(user))throw Error('기록이 초기화됐어요. 다시 입력해 주세요.');check();
      const inserted=await sb.from('daily_activity').upsert({user_id:owner,activity_date:date,steps},{onConflict:'user_id,activity_date',ignoreDuplicates:true});
      if(inserted.error)throw inserted.error;check();
      const result=await sb.from('daily_activity').update({steps}).eq('user_id',owner).eq('activity_date',date).select('steps').single();
      if(result.error)throw result.error;check();
      if(Number(result.data?.steps)!==steps)throw Error('저장된 걸음 수를 확인하지 못했어요. 다시 시도해 주세요.');
      activityFor(date).steps=steps;confirmedSteps.set(stepKey(owner,date),steps);originalSave();
      void exercisePanel.refresh();void weeklyPanel?.refresh();challengePanel.refreshVisible();
    }finally{savingSteps=false;flushAssistantRefresh();}
  };
  const activityHome=document.createElement('section');activityHome.className='chartCard homeExercise';activityHome.innerHTML='<div class="cardTitle"><b>오늘의 움직임</b></div><div id="homeExerciseContent"></div><button id="homeExerciseOpen" type="button" class="secondary">운동 기록 보기</button>';document.querySelector('#homeGoalContent')?.parentElement.after(activityHome);
  const weeklyPanel=window.MealLogWeekly?.mount({client:sb,getUser:()=>user,prepare:()=>recordReset.prepare(user)});
  const exercisePanel=MealLogExercise.mount({client:sb,getUser:()=>user,prepare:()=>recordReset.prepare(user),onChange:()=>{challengePanel.refreshVisible();void weeklyPanel?.refresh()}});
  const shortcutPanel=MealLogShortcut.mount({client:sb,getUser:()=>user});
  const homePanel=MealLogHome.mount({client:sb,getUser:()=>user});
  const challengePanel=MealLogChallenges.mount({client:sb,getUser:()=>user,onEditAlias:id=>friendsPanel.editAlias(id)});
  const friendsPanel=MealLogFriends.mount({client:sb,getUser:()=>user,onLogin:()=>openAuth(),onData:data=>challengePanel.setFriends(data)});
  const resetPanel=recordReset.mount({client:sb,getUser:()=>user,isSyncing:()=>syncing,pause(){resetting=true;clearTimeout(syncTimer);},resume(){resetting=false;},createVerifier:()=>window.supabase.createClient(window.MEALLOG_SUPABASE_URL,window.MEALLOG_SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'meallog-reset-proof-'+crypto.randomUUID()}}),completed(){setTimeout(()=>loadAndMerge(),0);challengePanel.refreshVisible();}});
  const aiUsage=MealLogAIUsage.create({client:sb,getUser:()=>user});aiUsage.mountSettings();
  const foodMemoryPanel=MealLogFoodMemory.mount({usage:aiUsage,client:sb,getUser:()=>user,getDay:()=>selectedDate,getDatabase:()=>FOOD_DB,prepare:async()=>{
    if(!user)throw Error("로그인이 필요해요.");
    if(loadingMeals||syncing||resetting||savingSteps||!getMealSync().ready||getMealSync().pendingCount)throw Error("먼저 기존 기록 동기화를 마친 뒤 다시 열어 주세요.");
    const owner=user.id,epoch=recordEpoch;const [changed,access]=await Promise.all([recordReset.prepare(user),sb.rpc('meal_food_capabilities')]);
    if(changed||user?.id!==owner||recordEpoch!==epoch)throw Error("계정 또는 기록이 바뀌었어요. 다시 열어 주세요.");
    if(access.error)throw access.error;
    if(user?.id!==owner||recordEpoch!==epoch)throw Error("계정이 바뀌었어요. 다시 열어 주세요.");
    if(!access.data?.food_memory||!access.data?.conversation)throw Error("현재 계정의 기능 이용 권한을 확인해 주세요.");
  },refresh:()=>refreshAssistantMeals()});
  window.MealLogListEntry?.connect({client:sb,getUser:()=>user,openAssistant:options=>foodMemoryPanel.openForEntry(options)});
  window.MealLogLabelPhoto?.connect({client:sb,getUser:()=>user,onUsage:(usage,owner)=>aiUsage.accept(usage,owner)});
  function setUI(){
    window.MealLogLabelPhoto?.accountChanged();
    aiUsage.accountChanged();
    foodMemoryPanel.accountChanged();window.MealLogListEntry?.accountChanged();
    mealRecovery.render();
    resetPanel.accountChanged();
    weeklyPanel?.accountChanged();homePanel.accountChanged();challengePanel.accountChanged();friendsPanel.accountChanged();exercisePanel.accountChanged();shortcutPanel.accountChanged();document.querySelector('#stepsDialog')?.close();
    const signed=!!user; document.querySelector('#signedOutPanel').hidden=signed||recoveringPassword;document.querySelector('#signedInPanel').hidden=!signed||recoveringPassword;document.querySelector('#passwordRecoveryPanel').hidden=!recoveringPassword;
    accountBtn.textContent='로그인';accountBtn.hidden=signed;accountBtn.classList.toggle('signedIn',signed);document.querySelector('#settingsLoginPanel').hidden=!signed;document.querySelector('#settingsAccountEmail').textContent=signed?(user.email||''):'';cloudAccountBtn.textContent=signed?'계정 관리 · 로그아웃':'로그인';if(!signed)document.querySelector('#accountEmail').textContent='';
    badge.textContent=signed?'동기화 켜짐':'로그인 필요';statusText.textContent=signed?'식사·체중·활동 기록을 이 계정에 동기화하고 있어요.':'로그인하면 식사·체중·활동 기록을 계정에 동기화합니다.';
    if(signed){document.querySelector('#accountEmail').textContent=user.email||'';renderBarcodeProducts();}
  }
  function openAuth(){setUI();document.querySelector('#authMessage').textContent='';document.querySelector('#syncMessage').textContent='';authDialog.showModal()}
  accountBtn.onclick=openAuth;cloudAccountBtn.onclick=openAuth;document.querySelector('#authClose').onclick=()=>authDialog.close();
  document.querySelector('#authForm').onsubmit=async e=>{e.preventDefault();let email=document.querySelector('#authEmail').value.trim(),password=document.querySelector('#authPassword').value,msg=document.querySelector('#authMessage');msg.textContent='로그인 중…';let {error}=await sb.auth.signInWithPassword({email,password});msg.textContent=error?`로그인 실패: ${error.message}`:'로그인했어요.'};
  document.querySelector('#signupBtn').onclick=async()=>{
    const btn=document.querySelector('#signupBtn'), msg=document.querySelector('#authMessage');
    const email=document.querySelector('#authEmail').value.trim(),password=document.querySelector('#authPassword').value;
    msg.textContent='';
    if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){msg.textContent='올바른 이메일 주소를 입력해주세요.';return;}
    if(password.length<6){msg.textContent='비밀번호를 6자 이상 입력해주세요.';return;}
    btn.disabled=true;msg.textContent='회원가입 요청 중…';
    try{
      const {data,error}=await Promise.race([
        sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin}}),
        new Promise((_,reject)=>setTimeout(()=>reject(new Error('서버 응답이 지연되고 있어요. 인터넷 연결을 확인하고 다시 시도해주세요.')),15000))
      ]);
      if(error)throw error;
      msg.textContent=data?.session?'회원가입 및 로그인에 성공했어요.':'가입 요청을 보냈어요. 이메일의 인증 링크를 확인해주세요.';
    }catch(err){console.error('회원가입 오류:',err);msg.textContent='회원가입 실패: '+(err?.message||'알 수 없는 오류');}
    finally{btn.disabled=false;}
  };
  document.querySelector('#forgotPasswordBtn').onclick=async()=>{const email=document.querySelector('#authEmail').value.trim(),msg=document.querySelector('#authMessage'),btn=document.querySelector('#forgotPasswordBtn');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){msg.textContent='이메일 주소를 먼저 입력해주세요.';return;}btn.disabled=true;msg.textContent='재설정 메일 요청 중…';try{const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw error;msg.textContent='재설정 메일을 요청했어요. 받은편지함과 스팸함을 확인해주세요.';}catch(err){msg.textContent='요청 실패: '+(err.message||'다시 시도해주세요.');}finally{btn.disabled=false;}};
  document.querySelector('#updatePasswordBtn').onclick=async()=>{const a=document.querySelector('#newPassword').value,b=document.querySelector('#newPasswordConfirm').value,msg=document.querySelector('#passwordRecoveryMessage'),btn=document.querySelector('#updatePasswordBtn');if(a.length<6){msg.textContent='6자 이상 입력해주세요.';return;}if(a!==b){msg.textContent='비밀번호가 일치하지 않아요.';return;}btn.disabled=true;msg.textContent='변경 중…';try{const {error}=await sb.auth.updateUser({password:a});if(error)throw error;recoveringPassword=false, savingSteps=false;document.querySelector('#newPassword').value='';document.querySelector('#newPasswordConfirm').value='';await sb.auth.signOut();user=null;setUI();document.querySelector('#authMessage').textContent='비밀번호가 변경됐어요. 새 비밀번호로 로그인해주세요.';}catch(err){msg.textContent='변경 실패: '+(err.message||'다시 시도해주세요.');}finally{btn.disabled=false;}};
  document.querySelector('#logoutBtn').onclick=async()=>{await sb.auth.signOut();authDialog.close()};
  document.querySelector('#syncNowBtn').onclick=()=>loadAndMerge(true);
  // Recover barcode corrections embedded in saved meals (including meals saved while logged out).
  function recoverBarcodeFromMeals(){
    const recovered={};
    for(const meal of (state.meals||[]))for(const food of (meal.foods||[])){
      const bp=food.barcodeProduct;
      const code=String(bp?.code||bp?.barcode||'').replace(/\D/g,'');
      if(code.length<8)continue;
      const name=String(food.name||bp.name||'').split(' · ')[0].trim();
      if(!name||name==='제품'||name==='음식')continue;
      const amount=Number(food.grams)||Number(bp.productAmount)||Number(bp.displayAmount);
      if(!(amount>0))continue;
      const unit=bp.unit||'g',base=Number(bp.nutritionBase)||100;
      const scale=base/amount;
      const candidate={...bp,code,name,productAmount:amount,displayAmount:amount,unit,
        nutritionBase:base,nutritionUnit:bp.nutritionUnit||unit,
        calories:(Number(food.calories)||0)*scale,carbs:(Number(food.carbs)||0)*scale,
        protein:(Number(food.protein)||0)*scale,fat:(Number(food.fat)||0)*scale,
        source:'user-verified',verifiedAt:meal.time||'1970-01-01T00:00:00'};
      if(!recovered[code]||String(meal.time||'')>String(recovered[code].verifiedAt||''))recovered[code]=candidate;
    }
    return recovered;
  }
  function productQuality(p){
    if(!p)return -1;
    let q=0;
    if(p.name&&p.name!=='제품'&&p.name!=='음식')q+=3;
    if(Number(p.productAmount||p.displayAmount)>0)q+=1;
    if(p.unit==='mL')q+=2;
    if(p.source==='user-verified')q+=1;
    return q;
  }
  function bestProduct(a,b){
    if(!a)return b;if(!b)return a;
    const qa=productQuality(a),qb=productQuality(b);
    if(Math.abs(qa-qb)>=2 && !a.deleted && !b.deleted)return qa>qb?a:b;
    return Date.parse(b.verifiedAt||0)>Date.parse(a.verifiedAt||0)?b:a;
  }
  async function loadAndMerge(showMessage=false){
    if(!user||loadingMeals||syncing||resetting||savingSteps)return;
    loadingMeals=true;try{
    const loadUser=user;let loadEpoch=recordEpoch;
    if(showMessage)document.querySelector('#syncMessage').textContent='클라우드 기록 불러오는 중…';
    try{await recordReset.prepare(loadUser);loadEpoch=recordEpoch;await loadCloudSettings();if(user?.id!==loadUser.id||recordEpoch!==loadEpoch)return;}
    catch(e){console.error('목표 설정 불러오기 오류:',e);
      document.querySelector('#syncState').textContent='설정 동기화 오류';
      document.querySelector('#syncMessage').textContent='목표 설정 동기화 오류: '+e.message;
      return;
    }
  const [{data:meals,error:mealLoadError},{data:weights,error:weightLoadError},{data:acts,error:actLoadError},{data:barcodeRows,error:barcodeLoadError}]=await Promise.all([
  sb.from('meals').select('*').eq('user_id',loadUser.id),
  sb.from('weights').select('*').eq('user_id',loadUser.id),
  sb.from('daily_activity').select('*').eq('user_id',loadUser.id),
  sb.from('barcode_products').select('*').eq('user_id',loadUser.id)
]);
    if(user?.id!==loadUser.id||recordEpoch!==loadEpoch)return;
    const readError=mealLoadError||weightLoadError||actLoadError||barcodeLoadError;
    if(readError){document.querySelector('#syncState').textContent='동기화 오류';document.querySelector('#syncMessage').textContent='클라우드 불러오기 실패: '+readError.message;return;}for(const activity of acts||[])confirmedSteps.set(stepKey(loadUser.id,activity.activity_date),Math.max(0,Math.round(Number(activity.steps)||0)));
    // Migrate confirmed server photos individually, preserving concurrent edits.
    try{
      const pending=JSON.parse(localStorage.getItem('meallog-meal-sync-v1:'+loadUser.id)||'{"pending":[]}');
      const pendingIds=new Set((pending.pending||[]).map(item=>item.id));
      for(let i=0;i<(meals||[]).length;i++){
        const row=meals[i];if(!String(row.photo_url||'').startsWith('data:image/')||pendingIds.has(row.id))continue;
        const oldPhoto=row.photo_url,photo=await MealLogPhotoStorage.upload(oldPhoto);
        if(user?.id!==loadUser.id||recordEpoch!==loadEpoch)return;
        const result=await sb.rpc('meal_compare_write',{p_id:row.id,p_expected:row,p_next:{...row,photo_url:photo}}).single();
        if(result.error){if(result.error.code==='PGRST116')continue;throw result.error;}
        meals[i]=result.data;
        state.meals=(state.meals||[]).map(meal=>meal.id===row.id&&meal.photo===oldPhoto?{...meal,photo}:meal);
        // Each successful cloud write makes the local snapshot smaller.
        localStorage.setItem('meallog-state',JSON.stringify(state));
      }
    }catch(error){document.querySelector('#syncMessage').textContent='기존 사진 이전을 다시 시도할게요. '+error.message;}
    try{const engine=getMealSync();state.meals=engine.reconcile(meals||[],state.meals||[]);initialMealRecovery=engine.recoveryCount;}
    catch(error){document.querySelector('#syncState').textContent='백업 확인 필요';document.querySelector('#syncMessage').textContent=error.message;return;}
    const localWeights=new Map((state.weights||[]).map(x=>[x.date,x]));(weights||[]).forEach(r=>localWeights.set(r.weight_date,{date:r.weight_date,value:+r.weight}));state.weights=[...localWeights.values()];
    try{const activity=await getWaterSync().sync(state.activity||{});if(user?.id!==loadUser.id||recordEpoch!==loadEpoch)return;state.activity=activity;}
    catch(error){document.querySelector('#syncState').textContent='물 기록 연결 확인';document.querySelector('#syncMessage').textContent='물 기록은 이 기기에 보관 중이에요. 연결 후 다시 동기화해 주세요.';return;}
    if(typeof renderActivity==='function')renderActivity();
    // Merge recovered meal corrections, device edits and cloud edits without allowing
    // generic placeholders to overwrite a verified product.
    const localVerified=barcodeUserProducts();
    const localLinks=barcodeLinks();
    const mergedVerified={...localVerified};
    for(const [code,p] of Object.entries(recoverBarcodeFromMeals()))
      if(!mergedVerified[code]?.deleted)mergedVerified[code]=bestProduct(mergedVerified[code],p);
    for(const r of (barcodeRows||[])){
      if(!r.barcode)continue;
      const code=String(r.barcode);
      const cloudProduct={code,name:r.product_name,maker:r.maker,
        productAmount:Number(r.amount),displayAmount:Number(r.amount),unit:r.unit,
        calories:Number(r.calories),carbs:Number(r.carbs),protein:Number(r.protein),fat:Number(r.fat),
        nutritionBase:Number(r.nutrition_base),nutritionUnit:r.nutrition_unit,
        verifiedAt:r.updated_at,source:'user-verified'};
      if(r.product_name===DELETED_NAME){cloudProduct.deleted=true;cloudProduct.name=DELETED_NAME;}
      const local=mergedVerified[code];
      if(cloudProduct.deleted){if(!local || Date.parse(cloudProduct.verifiedAt||0)>=Date.parse(local.verifiedAt||0))mergedVerified[code]=cloudProduct;}
      else if(local?.deleted){if(Date.parse(cloudProduct.verifiedAt||0)>Date.parse(local.verifiedAt||0))mergedVerified[code]=cloudProduct;}
      else mergedVerified[code]=bestProduct(local,cloudProduct);
    }
    localStorage.setItem(BARCODE_USER_KEY,JSON.stringify(mergedVerified));
    for(const item of Object.values(mergedVerified))if(!item.deleted)rememberBarcodeProduct(item);
    purgeDeletedCaches(mergedVerified);renderBarcodeProducts();
    localStorage.setItem(BARCODE_LINK_KEY,JSON.stringify(localLinks));
    originalSave();mealRecovery.render();loadingMeals=false;await syncAll(showMessage);
    }finally{loadingMeals=false;window.dispatchEvent(new Event('meallog:sync'));flushAssistantRefresh();}
  }
  function flushAssistantRefresh(){const pending=pendingAssistantRefresh;if(!pending||loadingMeals||syncing||resetting||savingSteps)return;pendingAssistantRefresh=null;if(user?.id===pending.owner&&recordEpoch===pending.epoch)void refreshAssistantMeals().catch(()=>{});}
  async function refreshAssistantMeals(){if(!user||resetting)return;if(loadingMeals||syncing||savingSteps){pendingAssistantRefresh={owner:user.id,epoch:recordEpoch};return;}pendingAssistantRefresh=null;const syncUser=user,epoch=recordEpoch;syncing=true;document.body.classList.add('syncing');try{const changed=await recordReset.prepare(syncUser);if(changed||user?.id!==syncUser.id||recordEpoch!==epoch)return;const result=await getMealSync().sync();if(user?.id!==syncUser.id||recordEpoch!==epoch)return;state.meals=result.meals;originalSave();mealRecovery.render();document.querySelector('#syncState').textContent=result.conflicts?'변경 내용 확인':'동기화 완료';if(result.conflicts)document.querySelector('#syncMessage').textContent='다른 기기의 최신 기록을 유지했고, 겹친 변경은 복구 백업에 보관했어요.';}catch(error){if(user?.id===syncUser.id){document.querySelector('#syncState').textContent='목록 갱신 확인 필요';document.querySelector('#syncMessage').textContent='서버 저장은 완료됐어요. 새로고침해 최신 목록을 확인해 주세요.';}throw error;}finally{syncing=false;document.body.classList.remove('syncing');window.dispatchEvent(new Event('meallog:sync'));if(changedDuringSync&&user?.id===syncUser.id){changedDuringSync=false;clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncAll(false),700);}flushAssistantRefresh();}}
  async function syncAll(showMessage=true){
    if(!user||syncing||resetting||savingSteps)return;const syncUser=user;let mealConflicts=0;syncing=true;document.body.classList.add('syncing');let msg=document.querySelector('#syncMessage');if(showMessage)msg.textContent='동기화 중…';
    try{
      const resetChanged=await recordReset.prepare(syncUser);if(resetChanged){document.querySelector('#syncMessage').textContent='다른 기기에서 초기화한 기록을 반영했어요. 새로고침해 주세요.';return;}
      // Always persist account-level settings, including changes from Settings dialog.
      const settingsRow={user_id:syncUser.id,goal_kcal:Number(state.goal)||SETTINGS_DEFAULT_GOAL,
        target_weight:state.targetWeight||null,steps_goal:Number(state.stepsGoal)||8000,
        water_goal:Number(state.waterGoal)||2000};
      const {error:settingsError}=await sb.from('user_settings').upsert(settingsRow,{onConflict:'user_id'});
      if(settingsError)throw settingsError;if(user?.id!==syncUser.id)return;
      // Write only explicit edits, with atomic comparison against the original row.
      if(user?.id!==syncUser.id)return;
      const engine=getMealSync();
      if(!engine.ready)throw Error('기록을 먼저 불러온 뒤 저장해 주세요.');
      const mealResult=await engine.sync();
      if(user?.id!==syncUser.id)return;
      state.meals=mealResult.meals;mealConflicts=mealResult.conflicts;mealRecovery.render();
      originalSave();
      const weightRows=(state.weights||[]).map(w=>({user_id:syncUser.id,weight_date:w.date,weight:+w.value}));if(weightRows.length){let {error}=await sb.from('weights').upsert(weightRows,{onConflict:'user_id,weight_date'});if(error)throw error}
      // Never delete cloud weights merely because they are missing locally.
      // Water is changed only by idempotent, account-owned events. Never upload stale totals.
      const syncedActivity=await getWaterSync().sync(state.activity||{});
      if(user?.id!==syncUser.id)return;
      state.activity=syncedActivity;
      // Steps keep their existing maximum behavior, and never rewrite the water column.
      for(const [date,activity] of Object.entries(state.activity)){
        const steps=Math.max(0,Math.round(Number(activity.steps)||0));if(!steps||confirmedSteps.get(stepKey(syncUser.id,date))>=steps)continue;
        const {error:insertError}=await sb.from('daily_activity').upsert({user_id:syncUser.id,activity_date:date,steps,water:0},{onConflict:'user_id,activity_date',ignoreDuplicates:true});
        if(insertError)throw insertError;if(user?.id!==syncUser.id)return;
        const {error:stepError}=await sb.from('daily_activity').update({steps}).eq('user_id',syncUser.id).eq('activity_date',date).lt('steps',steps);
        if(stepError)throw stepError;if(user?.id!==syncUser.id)return;confirmedSteps.set(stepKey(syncUser.id,date),steps);
      }
      originalSave();if(typeof renderActivity==='function')renderActivity();void exercisePanel.refresh();
      document.querySelector('#waterStatus').textContent='';
      // Recover verified product metadata from historical meals before upload.
      const verifiedBeforeUpload=barcodeUserProducts();
      const restored={...verifiedBeforeUpload};
      for(const [code,p] of Object.entries(recoverBarcodeFromMeals()))if(!restored[code]?.deleted)restored[code]=bestProduct(restored[code],p);
      localStorage.setItem(BARCODE_USER_KEY,JSON.stringify(restored));
      for(const p of Object.values(restored))if(!p.deleted)rememberBarcodeProduct(p);
      // Sync only user-verified barcode products; never delete remote products based on one device.
      const barcodeRowsUp=Object.entries(barcodeUserProducts()).map(([barcode,p])=>({
        user_id:syncUser.id,barcode,product_name:p.deleted?DELETED_NAME:(p.name||''),maker:p.deleted?'':(p.maker||''),
        amount:Number(p.productAmount||p.displayAmount||100),unit:p.unit||'g',
        calories:Number(p.calories||0),carbs:Number(p.carbs||0),
        protein:Number(p.protein||0),fat:Number(p.fat||0),
        nutrition_base:Number(p.nutritionBase||100),nutrition_unit:p.nutritionUnit||p.unit||'g',
        updated_at:p.verifiedAt||new Date().toISOString()
      }));
      if(barcodeRowsUp.length){
        const {data:remote,error:readError}=await sb.from('barcode_products').select('*').eq('user_id',syncUser.id);
        if(readError)throw readError;if(user?.id!==syncUser.id)return;
        const byCode=new Map((remote||[]).map(r=>[String(r.barcode),r]));
        const safeRows=barcodeRowsUp.filter(p=>{
          const r=byCode.get(String(p.barcode));
          if(!r)return true;
          if((!p.product_name||p.product_name==='제품')&&r.product_name&&r.product_name!=='제품')return false;
          return Date.parse(p.updated_at||0)>=Date.parse(r.updated_at||0);
        });
        if(!safeRows.length){if(user?.id!==syncUser.id)return;document.querySelector('#syncState').textContent=mealConflicts?'변경 내용 확인':'동기화 완료';if(showMessage||mealConflicts||initialMealRecovery)msg.textContent=mealConflicts?'다른 기기의 최신 내용을 유지했어요. 내 변경 내용은 복구용 백업에 보관했어요.':initialMealRecovery?'이 기기의 이전 내용 '+initialMealRecovery+'건을 복구용 백업에 보관했어요.':'클라우드 동기화가 완료됐어요.';return;}
        const {error}=await sb.from('barcode_products').upsert(safeRows,{onConflict:'user_id,barcode'});
        if(error)throw error;
      }
      if(user?.id!==syncUser.id)return;document.querySelector('#syncState').textContent=mealConflicts?'변경 내용 확인':'동기화 완료';if(showMessage||mealConflicts||initialMealRecovery)msg.textContent=mealConflicts?'다른 기기의 최신 내용을 유지했어요. 내 변경 내용은 복구용 백업에 보관했어요.':initialMealRecovery?'이 기기의 이전 내용 '+initialMealRecovery+'건을 복구용 백업에 보관했어요.':'클라우드 동기화가 완료됐어요.';renderBarcodeProducts();challengePanel.refreshVisible();
    }catch(e){if(user?.id!==syncUser.id)return;console.error(e);document.querySelector('#syncState').textContent='동기화 오류';msg.textContent='연결을 확인해 주세요. 식사 변경 내용은 이 기기에 보관했어요.';badge.textContent='확인 필요'}finally{syncing=false;document.body.classList.remove('syncing');if(changedDuringSync&&user?.id===syncUser.id){changedDuringSync=false;clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncAll(false),700);}flushAssistantRefresh();}
  }
  function purgeDeletedCaches(products){
    const deleted=new Set(Object.entries(products).filter(([,v])=>v.deleted).map(([k])=>k));
    if(!deleted.size)return;
    const links=barcodeLinks();for(const code of deleted)delete links[code];
    localStorage.setItem(BARCODE_LINK_KEY,JSON.stringify(links));
    try{const cache=JSON.parse(localStorage.getItem(BARCODE_CACHE_KEY)||'[]');localStorage.setItem(BARCODE_CACHE_KEY,JSON.stringify(cache.filter(x=>!deleted.has(String(x.code)))))}catch(_){}
  }
  function renderBarcodeProducts(){
    const box=document.querySelector('#barcodeProductsList');if(!box)return;
    box.replaceChildren();
    const products=Object.entries(barcodeUserProducts()).filter(([,p])=>!p.deleted).sort((a,b)=>String(a[1].name).localeCompare(String(b[1].name),'ko'));
    if(!products.length){box.textContent='저장된 바코드 제품이 없어요.';return;}
    for(const [code,p] of products){
      const item=document.createElement('div');item.style.cssText='border-top:1px solid #eee;padding:9px 0;display:flex;gap:6px;align-items:center;justify-content:space-between';
      const info=document.createElement('div');info.style.cssText='min-width:0;flex:1;overflow-wrap:anywhere';
      const title=document.createElement('b');title.textContent=p.name||'제품';
      const small=document.createElement('small');small.style.display='block';small.textContent=`${code} · ${p.productAmount||p.displayAmount||100}${p.unit||'g'} · ${Math.round((Number(p.calories)||0)*(Number(p.productAmount||p.displayAmount||100)/(Number(p.nutritionBase)||100))*100)/100}kcal`;
      info.append(title,small);
      const edit=document.createElement('button');edit.type='button';edit.className='secondary';edit.style.width='auto';edit.textContent='수정';edit.onclick=()=>openBarcodeEditor(code);
      const del=document.createElement('button');del.type='button';del.className='secondary';del.style.width='auto';del.textContent='삭제';del.onclick=()=>deleteBarcodeProduct(code);
      item.append(info,edit,del);box.append(item);
    }
  }
  let editingBarcode=null;
  const editDialog=document.querySelector('#barcodeEditDialog');
  document.querySelector('#barcodeEditCancel').onclick=()=>editDialog.close();
  function openBarcodeEditor(code){
    const p=barcodeUserProducts()[code];if(!p||p.deleted)return;
    editingBarcode=code;document.querySelector('#barcodeEditCode').textContent=`바코드 ${code}`;
    document.querySelector('#barcodeEditName').value=p.name||'';
    const amount=Number(p.productAmount||p.displayAmount||100),base=Number(p.nutritionBase)||100,scale=amount/base;
    document.querySelector('#barcodeEditAmount').value=amount;
    document.querySelector('#barcodeEditUnit').value=p.unit==='mL'?'mL':'g';
    for(const [id,key] of [['Calories','calories'],['Carbs','carbs'],['Protein','protein'],['Fat','fat']])document.querySelector('#barcodeEdit'+id).value=Math.round((Number(p[key])||0)*scale*10000)/10000;
    document.querySelector('#barcodeEditMessage').textContent='';editDialog.showModal();
  }
  document.querySelector('#barcodeEditForm').onsubmit=async e=>{
    e.preventDefault();if(!editingBarcode||!user)return;
    const code=editingBarcode,old=barcodeUserProducts()[code];if(!old)return;
    const amount=Number(document.querySelector('#barcodeEditAmount').value),name=document.querySelector('#barcodeEditName').value.trim(),unit=document.querySelector('#barcodeEditUnit').value;
    if(!name||!(amount>0)){document.querySelector('#barcodeEditMessage').textContent='제품명과 용량을 확인해주세요.';return;}
    const updated={...old,code,name,productAmount:amount,displayAmount:amount,unit,nutritionBase:amount,nutritionUnit:unit,
      calories:Number(document.querySelector('#barcodeEditCalories').value)||0,carbs:Number(document.querySelector('#barcodeEditCarbs').value)||0,
      protein:Number(document.querySelector('#barcodeEditProtein').value)||0,fat:Number(document.querySelector('#barcodeEditFat').value)||0,
      source:'user-verified',deleted:false,verifiedAt:new Date().toISOString()};
    const all=barcodeUserProducts();all[code]=updated;localStorage.setItem(BARCODE_USER_KEY,JSON.stringify(all));
    rememberBarcodeProduct(updated);editDialog.close();renderBarcodeProducts();await syncAll(true);
  };
  async function deleteBarcodeProduct(code){
    if(!user||!confirm('이 제품을 바코드 목록에서 삭제할까요? 기존 식사 기록은 유지돼요.'))return;
    const all=barcodeUserProducts(),old=all[code];if(!old)return;
    all[code]={...old,name:DELETED_NAME,deleted:true,verifiedAt:new Date().toISOString()};
    localStorage.setItem(BARCODE_USER_KEY,JSON.stringify(all));purgeDeletedCaches(all);renderBarcodeProducts();await syncAll(true);
  }
  document.querySelector('#refreshBarcodeProducts').onclick=()=>loadAndMerge();
  window.MealLogCloudStatus=()=>({loggedIn:!!user,loading:loadingMeals,syncing,pending:user?getMealSync().pendingCount:0,state:document.querySelector('#syncState')?.textContent||''});
  sb.auth.onAuthStateChange(async(event,session)=>{if(event==='PASSWORD_RECOVERY'){recoveringPassword=true;setUI();if(!authDialog.open)authDialog.showModal();document.querySelector('#passwordRecoveryMessage').textContent='새 비밀번호를 설정해주세요.';}let was=user;user=session?.user||null;if(was?.id!==user?.id){confirmedSteps.clear();pendingAssistantRefresh=null;}setUI();window.dispatchEvent(new Event('meallog:sync'));if(user&&!was&&!recoveringPassword)setTimeout(loadAndMerge,0)});
  sb.auth.getSession().then(({data})=>{user=data.session?.user||null;setUI();window.dispatchEvent(new Event('meallog:sync'));if(user)loadAndMerge()});
})();
