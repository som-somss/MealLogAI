(() => {
  const cfgOk = window.MEALLOG_SUPABASE_URL && window.MEALLOG_SUPABASE_KEY && !window.MEALLOG_SUPABASE_KEY.includes('PASTE_YOUR');
  const accountBtn=document.querySelector('#accountBtn'), cloudAccountBtn=document.querySelector('#cloudAccountBtn'), authDialog=document.querySelector('#authDialog');
  const badge=document.querySelector('#cloudBadge'), statusText=document.querySelector('#cloudStatusText');
  if(!window.supabase || !cfgOk){
    badge.textContent='키 입력 필요'; statusText.textContent='Supabase Publishable key를 supabase-config.js에 입력하면 로그인이 활성화됩니다.';
    [accountBtn,cloudAccountBtn].forEach(b=>b.onclick=()=>alert('먼저 supabase-config.js에 Publishable key를 입력해주세요.'));
    return;
  }
  const sb=window.supabase.createClient(window.MEALLOG_SUPABASE_URL,window.MEALLOG_SUPABASE_KEY);
  let user=null, syncing=false, syncTimer=null, recoveringPassword=false;
  const originalSave=save;
  save=function(){ originalSave(); if(user){clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncAll(false),700)} };
  function setUI(){
    const signed=!!user; document.querySelector('#signedOutPanel').hidden=signed||recoveringPassword;document.querySelector('#signedInPanel').hidden=!signed||recoveringPassword;document.querySelector('#passwordRecoveryPanel').hidden=!recoveringPassword;
    accountBtn.textContent=signed?(user.email?.split('@')[0]||'계정'):'로그인';accountBtn.classList.toggle('signedIn',signed);
    badge.textContent=signed?'동기화 켜짐':'로그인 필요';statusText.textContent=signed?'식사·체중·활동 기록을 이 계정에 동기화하고 있어요.':'로그인하면 식사·체중·활동 기록을 계정에 동기화합니다.';
    if(signed)document.querySelector('#accountEmail').textContent=user.email||'';
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
  document.querySelector('#updatePasswordBtn').onclick=async()=>{const a=document.querySelector('#newPassword').value,b=document.querySelector('#newPasswordConfirm').value,msg=document.querySelector('#passwordRecoveryMessage'),btn=document.querySelector('#updatePasswordBtn');if(a.length<6){msg.textContent='6자 이상 입력해주세요.';return;}if(a!==b){msg.textContent='비밀번호가 일치하지 않아요.';return;}btn.disabled=true;msg.textContent='변경 중…';try{const {error}=await sb.auth.updateUser({password:a});if(error)throw error;recoveringPassword=false;document.querySelector('#newPassword').value='';document.querySelector('#newPasswordConfirm').value='';await sb.auth.signOut();user=null;setUI();document.querySelector('#authMessage').textContent='비밀번호가 변경됐어요. 새 비밀번호로 로그인해주세요.';}catch(err){msg.textContent='변경 실패: '+(err.message||'다시 시도해주세요.');}finally{btn.disabled=false;}};
  document.querySelector('#logoutBtn').onclick=async()=>{await sb.auth.signOut();authDialog.close()};
  document.querySelector('#syncNowBtn').onclick=()=>syncAll(true);
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
    if(Math.abs(qa-qb)>=2)return qa>qb?a:b;
    return Date.parse(b.verifiedAt||0)>Date.parse(a.verifiedAt||0)?b:a;
  }
  async function loadAndMerge(){
    if(!user)return;
  const [{data:meals},{data:weights},{data:acts},{data:barcodeRows}]=await Promise.all([
  sb.from('meals').select('*').eq('user_id',user.id),
  sb.from('weights').select('*').eq('user_id',user.id),
  sb.from('daily_activity').select('*').eq('user_id',user.id),
  sb.from('barcode_products').select('*').eq('user_id',user.id)
]);
    const localMeals=new Map((state.meals||[]).map(x=>[x.id,x]));(meals||[]).forEach(r=>localMeals.set(r.id,{id:r.id,type:r.meal_type,time:r.meal_time,photo:r.photo_url||'',foods:r.foods||[],memo:r.memo||''}));state.meals=[...localMeals.values()];
    const localWeights=new Map((state.weights||[]).map(x=>[x.date,x]));(weights||[]).forEach(r=>localWeights.set(r.weight_date,{date:r.weight_date,value:+r.weight}));state.weights=[...localWeights.values()];
    state.activity=state.activity||{};(acts||[]).forEach(r=>{state.activity[r.activity_date]={steps:+r.steps||0,water:+r.water||0,waterHistory:[]}});
    // Merge recovered meal corrections, device edits and cloud edits without allowing
    // generic placeholders to overwrite a verified product.
    const localVerified=barcodeUserProducts();
    const localLinks=barcodeLinks();
    const mergedVerified={...localVerified};
    for(const [code,p] of Object.entries(recoverBarcodeFromMeals()))
      mergedVerified[code]=bestProduct(mergedVerified[code],p);
    for(const r of (barcodeRows||[])){
      if(!r.barcode)continue;
      const code=String(r.barcode);
      const cloudProduct={code,name:r.product_name,maker:r.maker,
        productAmount:Number(r.amount),displayAmount:Number(r.amount),unit:r.unit,
        calories:Number(r.calories),carbs:Number(r.carbs),protein:Number(r.protein),fat:Number(r.fat),
        nutritionBase:Number(r.nutrition_base),nutritionUnit:r.nutrition_unit,
        verifiedAt:r.updated_at,source:'user-verified'};
      mergedVerified[code]=bestProduct(mergedVerified[code],cloudProduct);
    }
    localStorage.setItem(BARCODE_USER_KEY,JSON.stringify(mergedVerified));
    for(const item of Object.values(mergedVerified))rememberBarcodeProduct(item);
    localStorage.setItem(BARCODE_LINK_KEY,JSON.stringify(localLinks));
    originalSave();await syncAll(false);
  }
  async function syncAll(showMessage=true){
    if(!user||syncing)return;syncing=true;document.body.classList.add('syncing');let msg=document.querySelector('#syncMessage');if(showMessage)msg.textContent='동기화 중…';
    try{
      const mealRows=(state.meals||[]).map(m=>({id:m.id,user_id:user.id,meal_date:(m.time||'').slice(0,10),meal_type:m.type||'',meal_time:m.time||null,photo_url:m.photo||null,foods:m.foods||[],memo:m.memo||null}));
      if(mealRows.length){let {error}=await sb.from('meals').upsert(mealRows);if(error)throw error}
      let {data:remoteMeals,error:rme}=await sb.from('meals').select('id').eq('user_id',user.id);if(rme)throw rme;let keep=new Set(mealRows.map(x=>x.id)),remove=(remoteMeals||[]).filter(x=>!keep.has(x.id)).map(x=>x.id);if(remove.length){let {error}=await sb.from('meals').delete().in('id',remove);if(error)throw error}
      const weightRows=(state.weights||[]).map(w=>({user_id:user.id,weight_date:w.date,weight:+w.value}));if(weightRows.length){let {error}=await sb.from('weights').upsert(weightRows,{onConflict:'user_id,weight_date'});if(error)throw error}
      let {data:rw,error:rwe}=await sb.from('weights').select('id,weight_date').eq('user_id',user.id);if(rwe)throw rwe;let wk=new Set(weightRows.map(x=>x.weight_date)),wr=(rw||[]).filter(x=>!wk.has(x.weight_date)).map(x=>x.id);if(wr.length){let {error}=await sb.from('weights').delete().in('id',wr);if(error)throw error}
      const actRows=Object.entries(state.activity||{}).map(([date,a])=>({user_id:user.id,activity_date:date,steps:+a.steps||0,water:+a.water||0}));if(actRows.length){let {error}=await sb.from('daily_activity').upsert(actRows,{onConflict:'user_id,activity_date'});if(error)throw error}
      // Recover verified product metadata from historical meals before upload.
      const verifiedBeforeUpload=barcodeUserProducts();
      const restored={...verifiedBeforeUpload};
      for(const [code,p] of Object.entries(recoverBarcodeFromMeals()))restored[code]=bestProduct(restored[code],p);
      localStorage.setItem(BARCODE_USER_KEY,JSON.stringify(restored));
      for(const p of Object.values(restored))rememberBarcodeProduct(p);
      // Sync only user-verified barcode products; never delete remote products based on one device.
      const barcodeRowsUp=Object.entries(barcodeUserProducts()).map(([barcode,p])=>({
        user_id:user.id,barcode,product_name:p.name||'',maker:p.maker||'',
        amount:Number(p.productAmount||p.displayAmount||100),unit:p.unit||'g',
        calories:Number(p.calories||0),carbs:Number(p.carbs||0),
        protein:Number(p.protein||0),fat:Number(p.fat||0),
        nutrition_base:Number(p.nutritionBase||100),nutrition_unit:p.nutritionUnit||p.unit||'g',
        updated_at:p.verifiedAt||new Date().toISOString()
      }));
      if(barcodeRowsUp.length){
        const {data:remote,error:readError}=await sb.from('barcode_products').select('*').eq('user_id',user.id);
        if(readError)throw readError;
        const byCode=new Map((remote||[]).map(r=>[String(r.barcode),r]));
        const safeRows=barcodeRowsUp.filter(p=>{
          const r=byCode.get(String(p.barcode));
          if(!r)return true;
          if((!p.product_name||p.product_name==='제품')&&r.product_name&&r.product_name!=='제품')return false;
          return Date.parse(p.updated_at||0)>=Date.parse(r.updated_at||0);
        });
        if(!safeRows.length){document.querySelector('#syncState').textContent='동기화 완료';if(showMessage)msg.textContent='클라우드 동기화가 완료됐어요.';return;}
        const {error}=await sb.from('barcode_products').upsert(safeRows,{onConflict:'user_id,barcode'});
        if(error)throw error;
      }
      document.querySelector('#syncState').textContent='동기화 완료';if(showMessage)msg.textContent='클라우드 동기화가 완료됐어요.';
    }catch(e){console.error(e);document.querySelector('#syncState').textContent='동기화 오류';if(showMessage)msg.textContent=`동기화 오류: ${e.message}`;badge.textContent='확인 필요'}finally{syncing=false;document.body.classList.remove('syncing')}
  }
  sb.auth.onAuthStateChange(async(event,session)=>{if(event==='PASSWORD_RECOVERY'){recoveringPassword=true;setUI();if(!authDialog.open)authDialog.showModal();document.querySelector('#passwordRecoveryMessage').textContent='새 비밀번호를 설정해주세요.';}let was=user;user=session?.user||null;setUI();if(user&&!was&&!recoveringPassword)setTimeout(loadAndMerge,0)});
  sb.auth.getSession().then(({data})=>{user=data.session?.user||null;setUI();if(user)loadAndMerge()});
})();
