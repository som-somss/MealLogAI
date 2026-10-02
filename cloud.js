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
  let user=null, syncing=false, syncTimer=null;
  const originalSave=save;
  save=function(){ originalSave(); if(user){clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncAll(false),700)} };
  function setUI(){
    const signed=!!user; document.querySelector('#signedOutPanel').hidden=signed;document.querySelector('#signedInPanel').hidden=!signed;
    accountBtn.textContent=signed?(user.email?.split('@')[0]||'계정'):'로그인';accountBtn.classList.toggle('signedIn',signed);
    badge.textContent=signed?'동기화 켜짐':'로그인 필요';statusText.textContent=signed?'식사·체중·활동 기록을 이 계정에 동기화하고 있어요.':'로그인하면 식사·체중·활동 기록을 계정에 동기화합니다.';
    if(signed)document.querySelector('#accountEmail').textContent=user.email||'';
  }
  function openAuth(){setUI();document.querySelector('#authMessage').textContent='';document.querySelector('#syncMessage').textContent='';authDialog.showModal()}
  accountBtn.onclick=openAuth;cloudAccountBtn.onclick=openAuth;document.querySelector('#authClose').onclick=()=>authDialog.close();
  document.querySelector('#authForm').onsubmit=async e=>{e.preventDefault();let email=document.querySelector('#authEmail').value.trim(),password=document.querySelector('#authPassword').value,msg=document.querySelector('#authMessage');msg.textContent='로그인 중…';let {error}=await sb.auth.signInWithPassword({email,password});msg.textContent=error?`로그인 실패: ${error.message}`:'로그인했어요.'};
  document.querySelector('#signupBtn').onclick=async()=>{let email=document.querySelector('#authEmail').value.trim(),password=document.querySelector('#authPassword').value,msg=document.querySelector('#authMessage');if(!email||password.length<6){msg.textContent='이메일과 6자 이상의 비밀번호를 입력해주세요.';return}msg.textContent='회원가입 중…';let {error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin}});msg.textContent=error?`회원가입 실패: ${error.message}`:'가입 요청을 보냈어요. 이메일의 인증 링크를 눌러주세요.'};
  document.querySelector('#logoutBtn').onclick=async()=>{await sb.auth.signOut();authDialog.close()};
  document.querySelector('#syncNowBtn').onclick=()=>syncAll(true);
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
   const cloudBarcodeLinks={};
(barcodeRows||[]).forEach(r=>{
  if(r.barcode&&r.product_data)cloudBarcodeLinks[String(r.barcode)]=r.product_data;
});
const localBarcodeLinks=barcodeLinks();
localStorage.setItem(BARCODE_LINK_KEY,JSON.stringify({...localBarcodeLinks,...cloudBarcodeLinks}));
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
      const barcodeLinksNow=barcodeLinks();
const barcodeRowsUp=Object.entries(barcodeLinksNow).map(([barcode,product_data])=>({
  user_id:user.id,
  barcode,
  product_data
}));
if(barcodeRowsUp.length){
  let {error}=await sb.from('barcode_products').upsert(
    barcodeRowsUp,
    {onConflict:'user_id,barcode'}
  );
  if(error)throw error;
}
      let {data:remoteBarcodes,error:rbe}=await sb.from('barcode_products').select('id,barcode').eq('user_id',user.id);
if(rbe)throw rbe;
const barcodeKeep=new Set(Object.keys(barcodeLinksNow));
const barcodeRemove=(remoteBarcodes||[]).filter(x=>!barcodeKeep.has(String(x.barcode))).map(x=>x.id);
if(barcodeRemove.length){
  let {error}=await sb.from('barcode_products').delete().in('id',barcodeRemove);
  if(error)throw error;
}
      document.querySelector('#syncState').textContent='동기화 완료';if(showMessage)msg.textContent='클라우드 동기화가 완료됐어요.';
    }catch(e){console.error(e);document.querySelector('#syncState').textContent='동기화 오류';if(showMessage)msg.textContent=`동기화 오류: ${e.message}`;badge.textContent='확인 필요'}finally{syncing=false;document.body.classList.remove('syncing')}
  }
  sb.auth.onAuthStateChange(async(event,session)=>{let was=user;user=session?.user||null;setUI();if(user&&!was)setTimeout(loadAndMerge,0)});
  sb.auth.getSession().then(({data})=>{user=data.session?.user||null;setUI();if(user)loadAndMerge()});
})();
