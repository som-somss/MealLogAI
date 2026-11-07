(function(root){
 'use strict';
 const normalizeCode=value=>String(value||'').replace(/[\s-]/g,'').toUpperCase();
 const validCode=value=>/^[A-F0-9]{16}$/.test(normalizeCode(value));
 const validNickname=value=>{const s=String(value||'').trim();return [...s].length>=2&&[...s].length<=20&&!/[\u0000-\u001f\u007f]/.test(s);};
 const validAlias=value=>{const s=String(value||'').trim();return [...s].length<=20&&!/[\u0000-\u001f\u007f]/.test(s);};
 const validId=value=>/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value||'');
 function createAliasApi(client){return {
  async load(owner){const {data,error}=await client.from('ml_private_friend_aliases').select('friend_id,alias').eq('owner_id',owner);if(error)throw error;if(!Array.isArray(data)||data.some(x=>!validId(x.friend_id)||(x.alias!==null&&(typeof x.alias!=='string'||!validAlias(x.alias)))))throw Error('invalid_response');const aliases=Object.create(null);for(const row of data)if(row.alias)aliases[row.friend_id]=row.alias;return aliases;},
  async save(owner,friend,value){if(!validId(owner)||!validId(friend)||owner===friend||!validAlias(value))throw Error('invalid_alias');const {error}=await client.from('ml_private_friend_aliases').upsert({owner_id:owner,friend_id:friend,alias:String(value||'').trim()||null},{onConflict:'owner_id,friend_id'});if(error)throw error;}
 };}
 function errorMessage(error){
  const messages={friend_unavailable:'친구 관계가 바뀌었어요. 목록을 새로고침해 주세요.',login_required:'다시 로그인해 주세요.',invalid_nickname:'닉네임은 줄바꿈 없이 2~20자로 입력해 주세요.',profile_required:'먼저 내 닉네임을 저장해 주세요.',invalid_code:'친구의 16자리 초대 코드를 확인해 주세요.',code_not_found:'해당 초대 코드를 찾지 못했어요.',self_request:'내 코드로는 친구 요청을 보낼 수 없어요.',request_unavailable:'이미 처리된 요청이에요. 목록을 새로고침해 주세요.',request_limit:'요청이 많아요. 잠시 후 다시 시도해 주세요.',retry_later:'거절된 요청은 하루 뒤 다시 보낼 수 있어요.'};
  return error?.message==='invalid_alias'?'별명은 줄바꿈 없이 20자 이내로 입력해 주세요.':messages[error?.message]||'연결하지 못했어요. 잠시 후 새로고침해 주세요.';
 }
 function createApi(client){
  async function rpc(name,args){const {data,error}=await client.rpc(name,args);if(error)throw error;return data;}
  return {
   async load(){const d=await rpc('ml_mobile_friends_state');if(!d||!['incoming','outgoing','friends'].every(k=>Array.isArray(d[k])&&d[k].every(p=>p&&typeof p.request_id==='string'&&typeof p.nickname==='string'))||(d.profile!==null&&(!d.profile||typeof d.profile.nickname!=='string'||!validCode(d.profile.invite_code))))throw Error('invalid_response');return d;},
   async saveNickname(value){if(!validNickname(value))throw Error('invalid_nickname');return rpc('ml_mobile_save_profile',{p_nickname:value.trim()});},
   async sendRequest(value){if(!validCode(value))throw Error('invalid_code');return rpc('ml_mobile_send_request',{p_code:normalizeCode(value)});},
   async remove(id){if(!validId(id))throw Error('friend_unavailable');return rpc('ml_mobile_remove_friend',{p_request_id:id});},
   async respond(id,accept){return rpc('ml_mobile_respond_request',{p_request_id:id,p_accept:!!accept});}
  };
 }
 function mount({client,getUser,onLogin,onData=()=>{}}){
  const $=id=>document.getElementById(id),api=createApi(client),aliasApi=createAliasApi(client),empty=()=>({profile:null,incoming:[],outgoing:[],friends:[],aliases:{}});
  let data=empty(),owner=null,epoch=0,busy=false,ready=false,edited=false,aliasEditing=null,aliasDraft='';
  const current=ticket=>ticket===epoch&&getUser()?.id===owner;
  const notice=text=>{$('friendsMessage').textContent=text;const status=$('settingsProfileMessage');if(status)status.textContent=text;};
  function controls(){
   if($('settingsFriendProfile'))$('settingsFriendProfile').hidden=!owner;$('friendsLoggedOut').hidden=!!owner;$('friendsLoggedIn').hidden=!owner;
   $('friendNickname').disabled=busy||!ready;
   $('saveFriendNickname').disabled=busy||!ready||!validNickname($('friendNickname').value);
   $('friendInviteCode').disabled=busy||!data.profile;
   $('sendFriendRequest').disabled=busy||!data.profile||!validCode($('friendInviteCode').value);
   $('copyFriendCode').disabled=busy||!data.profile;$('refreshFriends').disabled=busy||!owner;
   document.querySelectorAll('#friendsView [data-friend-response]').forEach(b=>b.disabled=busy);
   document.querySelectorAll('#friendsView [data-alias-control]').forEach(b=>b.disabled=busy||b.dataset.invalid==='true');
   $('friendsLoading').hidden=!busy;
  }
  function renderList(kind,title,peers){
   const box=$('friends'+kind);box.replaceChildren();$('friends'+kind+'Count').textContent=peers.length;
   if(!peers.length){const p=document.createElement('p');p.className='muted';p.textContent=ready?'아직 없어요.':'목록을 불러오면 여기에 표시돼요.';box.append(p);return;}
   peers.forEach(peer=>{
    const row=document.createElement('div');row.className='friendRow'+(kind==='List'?' privateAliasRow':'');
    const name=document.createElement('strong');name.textContent=peer.nickname;row.append(name);
    if(kind==='List'){
     const original=document.createElement('small');original.className='privateAliasOriginal';original.textContent='본인 닉네임: '+peer.original_nickname;row.append(original);
     if(aliasEditing===peer.user_id){
      const form=document.createElement('form');form.className='privateAliasForm';const label=document.createElement('label'),input=document.createElement('input'),hint=document.createElement('small'),actions=document.createElement('div');label.textContent='나만 보는 별명';input.value=aliasDraft;input.placeholder=peer.original_nickname;input.maxLength=40;input.dataset.aliasControl='true';input.setAttribute('aria-label',peer.original_nickname+' 나만 보는 별명');hint.textContent='내 계정에서만 보여요. 비우면 본인 닉네임으로 돌아가요.';
      const save=document.createElement('button'),cancel=document.createElement('button');save.type='submit';save.className='secondary';save.textContent='별명 저장';save.dataset.aliasControl='true';save.dataset.invalid=String(!validAlias(aliasDraft));cancel.type='button';cancel.className='secondary';cancel.textContent='취소';cancel.dataset.aliasControl='true';input.oninput=()=>{aliasDraft=input.value;save.dataset.invalid=String(!validAlias(aliasDraft));controls();};cancel.onclick=()=>{aliasEditing=null;aliasDraft='';render();};form.onsubmit=e=>{e.preventDefault();if(!validAlias(aliasDraft))return;const value=aliasDraft,friend=peer.user_id;void run(async ticket=>{await aliasApi.save(owner,friend,value);if(!current(ticket))return '';aliasEditing=null;aliasDraft='';return value.trim()?'나만 보는 별명을 저장했어요.':'본인 닉네임으로 표시해요.';});};label.append(input);actions.append(save,cancel);form.append(label,hint,actions);row.append(form);
     }else{const edit=document.createElement('button');edit.type='button';edit.className='secondary privateAliasEdit';edit.textContent=data.aliases[peer.user_id]?'별명 수정':'별명 설정';edit.dataset.aliasControl='true';edit.onclick=()=>{aliasEditing=peer.user_id;aliasDraft=data.aliases[peer.user_id]||'';render();};row.append(edit);}
    }
    if(kind==='List'){
     const removal=document.createElement('details');removal.className='friendRemove';const summary=document.createElement('summary');summary.textContent='친구 삭제';const note=document.createElement('p');note.textContent=peer.nickname+' 님과의 친구 관계를 양쪽 목록에서 삭제해요. 식사·물·체중 기록과 이미 참여한 챌린지는 유지돼요. 챌린지 정보 공유를 끝내려면 해당 챌린지에서 중도 포기해 주세요. 다시 친구를 추가하려면 하루 뒤 새 요청이 필요해요.';const actions=document.createElement('div'),cancel=document.createElement('button'),confirm=document.createElement('button');actions.className='friendRemoveActions';cancel.type=confirm.type='button';cancel.textContent='취소';confirm.textContent='친구 관계 삭제';cancel.className='secondary';confirm.className='friendRemoveConfirm';confirm.dataset.friendResponse='true';confirm.setAttribute('aria-label',peer.nickname+' 친구 관계 삭제');cancel.onclick=()=>{removal.open=false;};confirm.onclick=()=>void run(async ticket=>{await api.remove(peer.request_id);if(!current(ticket))return '';if(aliasEditing===peer.user_id){aliasEditing=null;aliasDraft='';}return peer.nickname+' 님을 친구 목록에서 삭제했어요. 참여 중인 챌린지는 유지돼요.';});actions.append(cancel,confirm);removal.append(summary,note,actions);row.append(removal);
    }
    if(kind==='Incoming'){
     const actions=document.createElement('div');actions.className='friendActions';
     for(const [label,accept] of [['수락',true],['거절',false]]){const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=label;button.dataset.friendResponse='true';button.setAttribute('aria-label',peer.nickname+' '+label);button.onclick=()=>run(async()=>{await api.respond(peer.request_id,accept);return accept?'친구가 되었어요.':'친구 요청을 거절했어요.';});actions.append(button);}
     row.append(actions);
    }else if(kind==='Outgoing'){const status=document.createElement('span');status.className='muted';status.textContent='수락 대기 중';row.append(status);}
    box.append(row);
   });
  }
  function render(){
   $('myFriendCode').textContent=data.profile?.invite_code?.match(/.{1,4}/g).join(' ')||'닉네임을 저장하면 발급돼요.';
   if(!edited)$('friendNickname').value=data.profile?.nickname||'';
   renderList('Incoming','받은 요청',data.incoming);renderList('Outgoing','보낸 요청',data.outgoing);renderList('List','내 친구',data.friends);controls();
  }
  async function run(work){
   if(!owner||busy)return;const ticket=epoch;busy=true;notice('');controls();let completed='';
   try{
    if(work){completed=await work(ticket);if(!current(ticket))return;}
    const result=await api.load();if(!current(ticket))return;
    if(result.profile&&result.profile.user_id!==owner)throw Error('account_changed');
    const aliases=await aliasApi.load(owner);if(!current(ticket))return;
    data={...result,aliases,friends:result.friends.map(peer=>({...peer,original_nickname:peer.nickname,nickname:aliases[peer.user_id]||peer.nickname}))};ready=true;render();onData(data);notice(completed);
   }catch(error){if(current(ticket))notice((completed?completed+' 목록을 새로고침해 주세요. ':'')+errorMessage(error));}
   finally{if(current(ticket)){busy=false;controls();}}
  }
  function accountChanged(){
   const id=getUser()?.id||null;if(owner===id)return;owner=id;epoch++;busy=false;ready=false;edited=false;aliasEditing=null;aliasDraft='';data=empty();$('friendNickname').value='';$('friendInviteCode').value='';notice('');render();onData(null);
   if(owner&&!$('friendsView').hidden)void run();
  }
  $('friendsLogin').onclick=onLogin;
  const profileLink=$('openSettingsProfile');if(profileLink)profileLink.onclick=()=>{$('settingsBtn').click();$('settingsFriendProfile')?.scrollIntoView?.({block:'start'});};
  $('settingsBtn')?.addEventListener('click',()=>{if(owner&&!edited)void run();});
  $('friendNickname').oninput=()=>{edited=true;controls();};$('friendInviteCode').oninput=controls;
  $('friendProfileForm').onsubmit=e=>{e.preventDefault();void run(async ticket=>{await api.saveNickname($('friendNickname').value);if(!current(ticket))return '';edited=false;return '닉네임을 저장했어요.';});};
  $('friendInviteForm').onsubmit=e=>{e.preventDefault();void run(async ticket=>{
   const code=normalizeCode($('friendInviteCode').value);if(code===data.profile?.invite_code)throw Error('self_request');
   const result=await api.sendRequest(code);if(!current(ticket))return '';$('friendInviteCode').value='';
   return {sent:'친구 요청을 보냈어요.',already_pending:'이미 보낸 요청이 있어요.',incoming_pending:'상대가 먼저 요청했어요. 받은 요청에서 수락해 주세요.',already_friends:'이미 친구예요.'}[result]||'요청 상태를 확인했어요.';
  });};
  $('copyFriendCode').onclick=async()=>{
   if(!data.profile)return;const ticket=epoch;
   try{await navigator.clipboard.writeText(data.profile.invite_code);if(current(ticket))notice('초대 코드를 복사했어요. 친구에게 전달해 주세요.');}
   catch{if(current(ticket))notice('코드를 길게 누르거나 드래그해 복사해 주세요.');}
  };
  $('refreshFriends').onclick=()=>void run();
  document.querySelector('.tab[data-view="friends"]').addEventListener('click',()=>{if(owner)void run();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&owner&&!$('friendsView').hidden)void run();});
  render();return {accountChanged,refresh:()=>run(),editAlias(id){const peer=data.friends.find(f=>f.user_id===id);if(!peer||!ready||busy)return false;aliasEditing=id;aliasDraft=data.aliases[id]||'';render();$('friendsList').scrollIntoView?.({behavior:'smooth',block:'center'});return true;}};
 }
 root.MealLogFriends={normalizeCode,validCode,validNickname,validAlias,errorMessage,createApi,createAliasApi,mount};
 if(typeof module==='object'&&module.exports)module.exports=root.MealLogFriends;
})(typeof globalThis!=='undefined'?globalThis:this);
