(function(root){'use strict';
 const $=id=>document.getElementById(id);let controller;
 function mount({client,getUser}){let owner=null,epoch=0,busy=false,secret='';
  function clear(){secret='';$('shortcutKey').value='';$('shortcutKey').type='password';$('shortcutReveal').textContent='키 보기';$('shortcutKeyBox').hidden=true;}
  function controls(){for(const id of ['shortcutCreate','shortcutRevoke','shortcutRefresh'])$(id).disabled=!owner||busy;$('shortcutCreate').disabled=!owner||busy||!$('shortcutConsent').checked;}
  function showStatus(data){$('shortcutState').textContent=data?.active?'연결 키 사용 중':'연결되지 않았어요.';$('shortcutLastUsed').textContent=data?.last_used_at?'마지막 수신 · '+new Date(data.last_used_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'아직 받은 걸음 수가 없어요.';$('shortcutExpiry').textContent=data?.active?'키 유효기간 · '+new Date(data.expires_at).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}):'';}
  async function run(action,hash){if(!owner||busy)return;const token=epoch;busy=true;controls();$('shortcutMessage').textContent='연결 상태를 확인하고 있어요…';try{const r=await client.rpc('ml_step_shortcut_settings',{p_action:action,p_hash:hash||null});if(r.error)throw r.error;if(token!==epoch)return;if(!r.data||typeof r.data.active!=='boolean')throw Error('invalid_response');showStatus(r.data);$('shortcutMessage').textContent=action==='revoke'?'연결을 해제했어요. 기존 걸음 기록은 유지돼요.':action==='create'?'연결 키를 만들었어요. 아래 키를 단축어에 넣어 주세요. 이 화면을 닫으면 키가 숨겨져요.':'';return r.data;}catch{if(token===epoch)$('shortcutMessage').textContent='연결 상태를 확인하지 못했어요. 다시 시도해 주세요.';}finally{if(token===epoch){busy=false;controls();}}}
  function accountChanged(){const next=getUser()?.id||null;if(next===owner)return;owner=next;epoch++;busy=false;clear();$('shortcutConsent').checked=false;showStatus(null);$('shortcutMessage').textContent=owner?'':'로그인 후 연결 키를 만들 수 있어요.';controls();if(owner)void run('status');}
  function reset(){epoch++;busy=false;clear();showStatus(null);controls();}
  $('shortcutConsent').onchange=controls;
  $('shortcutCreate').onclick=async()=>{if(!owner||busy||!$('shortcutConsent').checked)return;clear();const token=epoch,key='mlsteps_'+[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');let hash;try{hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key)))].map(b=>b.toString(16).padStart(2,'0')).join('');}catch{$('shortcutMessage').textContent='보안 연결에서 다시 시도해 주세요.';return;}if(token!==epoch)return;const data=await run('create',hash);if(token!==epoch||!data?.active)return;secret=key;$('shortcutKey').value=secret;$('shortcutKeyBox').hidden=false;};
  $('shortcutRevoke').onclick=()=>{clear();void run('revoke');};$('shortcutRefresh').onclick=()=>void run('status');
  $('shortcutCopyKey').onclick=async()=>{if(!secret)return;try{await navigator.clipboard.writeText(secret);$('shortcutMessage').textContent='연결 키를 복사했어요. 다른 사람에게 공유하지 마세요.';}catch{$('shortcutKey').type='text';$('shortcutKey').select();$('shortcutMessage').textContent='선택한 연결 키를 길게 눌러 복사해 주세요.';}};
  $('shortcutReveal').onclick=()=>{$('shortcutKey').type=$('shortcutKey').type==='password'?'text':'password';$('shortcutReveal').textContent=$('shortcutKey').type==='password'?'키 보기':'키 숨기기';};
  $('shortcutCopyURL').onclick=async()=>{try{await navigator.clipboard.writeText($('shortcutURL').textContent);$('shortcutMessage').textContent='전송 주소를 복사했어요.';}catch{$('shortcutMessage').textContent='전송 주소를 길게 눌러 복사해 주세요.';}};
  $('settingsClose').addEventListener('click',clear);$('settingsDialog').addEventListener('close',clear);$('settingsDialog').addEventListener('cancel',clear);
  showStatus(null);controls();return controller={accountChanged,reset};
 }
 root.MealLogShortcut={mount,reset:()=>controller?.reset()};
})(window);
