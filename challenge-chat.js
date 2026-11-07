(function(root){
 'use strict';
 const uuid=v=>/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(v||'');
 const errorText=e=>({chat_unavailable:'소통방에 참여할 수 없어요. 친구 관계나 참여 상태를 확인해 주세요.',invalid_comment:'댓글은 1~300자로 입력해 주세요.',comment_limit:'잠시 쉬었다 다시 남겨 주세요. 댓글은 3초에 한 번, 하루 100개까지 쓸 수 있어요.',comment_conflict:'입력한 내용이 바뀌었어요. 내용을 확인해 주세요.',login_required:'다시 로그인해 주세요.'}[e?.message]||'불러오지 못했어요. 다시 시도해 주세요.');
 function createApi(client){
  async function rpc(name,args){const {data,error}=await client.rpc(name,args);if(error)throw error;return data;}
  return {
   async load(id,before=null,mark=true){if(!uuid(id))throw Error('chat_unavailable');const d=await rpc('ml_room_comments',{p_room:id,p_before:before?.created_at||null,p_before_id:before?.id||null,p_mark_read:mark});if(!d||!Array.isArray(d.items)||typeof d.has_more!=='boolean'||typeof d.read_only!=='boolean'||d.items.some(x=>!uuid(x.id)||!uuid(x.author_id)||typeof x.nickname!=='string'||typeof x.is_mine!=='boolean'||typeof x.deleted!=='boolean'||(!x.deleted&&typeof x.body!=='string')||!Number.isFinite(Date.parse(x.created_at))||!Number.isInteger(x.cheers)||x.cheers<0||typeof x.cheered!=='boolean'))throw Error('invalid_response');return d;},
   async post(id,body,key){if(!uuid(id)||!uuid(key)||!body.trim()||[...body.trim()].length>300)throw Error('invalid_comment');const d=await rpc('ml_post_room_comment',{p_room:id,p_body:body.trim(),p_key:key});if(!uuid(d))throw Error('invalid_response');return d;},
   async remove(id){if(!uuid(id))throw Error('chat_unavailable');return rpc('ml_delete_challenge_comment',{p_comment:id});},
   async react(id,enabled){if(!uuid(id)||typeof enabled!=='boolean')throw Error('invalid_comments');return rpc('ml_react_room_comment',{p_comment:id,p_enabled:enabled});}
  };
 }
 function mount({client,getUser,getName,onChange}){
  const $=id=>document.getElementById(id),dialog=$('challengeChatDialog');if(!dialog)return null;
  const api=createApi(client),form=$('challengeChatForm'),input=$('challengeChatInput'),list=$('challengeChatItems'),status=$('challengeChatStatus');
  let owner=getUser()?.id||null,epoch=0,id=null,rows=[],more=false,readonly=false,busy=false,key=null,paging=false,invalid=false;
  const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const valid=(ticket,cid)=>ticket===epoch&&owner===getUser()?.id&&id===cid;
  function controls(){input.disabled=busy||readonly||invalid;$('sendChallengeComment').disabled=busy||readonly||invalid||!input.value.trim();$('refreshChallengeChat').disabled=busy;$('olderChallengeComments').hidden=!more;$('olderChallengeComments').disabled=busy;$('challengeChatReadOnly').hidden=!readonly;list.querySelectorAll('button').forEach(b=>b.disabled=busy||invalid||(readonly&&b.dataset.reaction==='true'));}
  function render(){
   const wasBottom=list.scrollHeight-list.scrollTop-list.clientHeight<55,scroll=list.scrollTop;list.replaceChildren();
   if(!rows.length)list.append(node('p','첫 응원을 남겨볼까요? 🌱','chatEmpty'));
   for(const x of rows){const card=node('article',undefined,'chatMessage'+(x.is_mine?' isMine':'')),head=node('div',undefined,'chatMessageHead');const name=x.is_mine?'나':getName?.(x.author_id,x.nickname)||x.nickname;head.append(node('strong',name),node('time',new Date(x.created_at).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'})));if(x.origin_title)card.append(node('small','이전 챌린지 · '+x.origin_title,'chatOrigin'));card.append(head,node('p',x.deleted?'삭제한 댓글이에요.':x.body,x.deleted?'chatDeleted':'chatBody'));
    if(!x.deleted){const actions=node('div',undefined,'chatMessageActions'),cheer=node('button','💪 응원해요'+(x.cheers?' '+x.cheers:''),'chatCheer');cheer.type='button';cheer.dataset.reaction='true';cheer.setAttribute('aria-pressed',String(x.cheered));cheer.setAttribute('aria-label',name+' 님 댓글 응원'+(x.cheers?' '+x.cheers+'개':''));cheer.onclick=()=>void mutate(()=>api.react(x.id,!x.cheered),false,()=>{rows=rows.map(r=>r.id===x.id?{...r,cheered:!x.cheered,cheers:Math.max(0,r.cheers+(x.cheered?-1:1))}:r);});actions.append(cheer);
     if(x.is_mine){const details=node('details',undefined,'chatDelete'),summary=node('summary','삭제'),note=node('p','이 댓글을 삭제할까요?'),cancel=node('button','취소'),confirm=node('button','삭제하기');cancel.type=confirm.type='button';cancel.onclick=()=>{details.open=false;};confirm.onclick=()=>void mutate(()=>api.remove(x.id),false,()=>{rows=rows.map(r=>r.id===x.id?{...r,body:null,deleted:true,cheers:0,cheered:false}:r);});details.append(summary,note,cancel,confirm);actions.append(details);}card.append(actions);}
    list.append(card);
   }
   if(wasBottom&&!paging)list.scrollTop=list.scrollHeight;else list.scrollTop=scroll;controls();
  }
  function merge(items){rows=[...new Map([...rows,...items].map(x=>[x.id,x])).values()].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));}
  async function load(older=false,quiet=false){
   if(!owner||owner!==getUser()?.id||!id||busy)return;const ticket=epoch,cid=id;busy=true;controls();if(!quiet)status.textContent='';
   try{const page=await api.load(cid,older?rows[0]:null,!older);if(!valid(ticket,cid))return;if(older){paging=true;merge(page.items);more=page.has_more;}else{const hadOlder=paging;merge(page.items);if(!hadOlder)more=page.has_more;}readonly=page.read_only;invalid=false;render();}
   catch(e){if(valid(ticket,cid)){status.textContent=errorText(e);if(['chat_unavailable','login_required'].includes(e?.message)){rows=[];invalid=true;list.replaceChildren();}}}
   finally{if(valid(ticket,cid)){busy=false;controls();}}
  }
  async function mutate(work,posted=false,apply){
   if(busy||!owner||owner!==getUser()?.id||!id)return;const ticket=epoch,cid=id;busy=true;status.textContent='';controls();
   try{await work();if(!valid(ticket,cid))return;apply?.();if(apply)render();if(posted){input.value='';key=null;}const page=await api.load(cid,null,true);if(!valid(ticket,cid))return;merge(page.items);readonly=page.read_only;if(!paging)more=page.has_more;render();if(posted)list.scrollTop=list.scrollHeight;onChange?.();}
   catch(e){if(valid(ticket,cid)){status.textContent=errorText(e);if(e?.message==='chat_unavailable'){rows=[];invalid=true;list.replaceChildren();}}}
   finally{if(valid(ticket,cid)){busy=false;controls();}}
  }
  function close(){epoch++;id=null;busy=false;rows=[];input.value='';key=null;list.replaceChildren();status.textContent='';dialog.close();}
  $('closeChallengeChat').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  input.oninput=()=>{key=null;controls();};form.onsubmit=e=>{e.preventDefault();if(busy||readonly||invalid||!id)return;key=key||crypto.randomUUID();const body=input.value,cid=id,request=key;void mutate(()=>api.post(cid,body,request),true);};
  $('refreshChallengeChat').onclick=()=>void load();$('olderChallengeComments').onclick=()=>void load(true);
  root.setInterval?.(()=>{if(dialog.open&&owner&&id&&!busy&&document.visibilityState==='visible'&&root.navigator?.onLine!==false&&!list.querySelector('details[open]'))void load(false,true);},10000);
  return {open(c){if(!getUser()?.id||!uuid(c.id))return;epoch++;owner=getUser().id;id=c.id;rows=[];more=false;paging=false;readonly=false;busy=false;invalid=false;key=null;input.value='';$('challengeChatTitle').textContent=c.title;status.textContent='';render();if(!dialog.open)dialog.showModal();void load();},accountChanged(){const next=getUser()?.id||null;if(next===owner)return;owner=next;close();}};
 }
 root.MealLogChat={createApi,mount};if(typeof module==='object'&&module.exports)module.exports=root.MealLogChat;
})(typeof globalThis!=='undefined'?globalThis:this);
