(function(root){
 'use strict';
 const uuid=v=>/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(v||'');
 function participants(c){return (c.participants||[]).map((p,i)=>({...p,user_id:p.user_id||(c.participant_ids||[])[i]}));}
 function friendGroups(challenges,friends,owner){
  const groups=new Map();const add=(id,name)=>{if(!groups.has(id))groups.set(id,{user_id:id,nickname:name,challenges:[]});return groups.get(id);};
  for(const f of friends||[])if(uuid(f.user_id)&&f.user_id!==owner)add(f.user_id,f.nickname);
  for(const c of challenges){const peers=Array.isArray(c.peer_index)?c.peer_index:participants(c).filter(p=>!p.is_me&&uuid(p.user_id));const seen=new Set();for(const p of peers){if(!uuid(p.user_id)||p.user_id===owner||seen.has(p.user_id))continue;seen.add(p.user_id);add(p.user_id,p.nickname).challenges.push(c);}if(!seen.size)add('__mine','내 챌린지').challenges.push(c);}
  return [...groups.values()].sort((a,b)=>Number(b.challenges.length>0)-Number(a.challenges.length>0)||a.nickname.localeCompare(b.nickname,'ko')||a.user_id.localeCompare(b.user_id));
 }
 function isGroup(c){return c.room_kind==='group'||Number(c.member_count)>2||new Set([...(c.participant_ids||[]),...(c.participants||[]).map(p=>p.user_id)].filter(uuid)).size>2;}
 function conversationGroups(challenges,friends,owner,rooms,mode){
  const available=Array.isArray(rooms)?rooms:[],source=challenges.filter(c=>isGroup(c)===(mode==='groups'));
  if(mode!=='groups'){const groups=friendGroups(source,friends,owner);for(const room of available.filter(r=>r.kind==='friend'&&uuid(r.peer_id))){let group=groups.find(g=>g.user_id===room.peer_id);if(!group){const p=room.participants.find(p=>p.user_id===room.peer_id);group={user_id:room.peer_id,nickname:p?.nickname||'친구',challenges:[]};groups.push(group);}group.room=room;}return groups;}
  const groups=new Map(),add=(id,c,room)=>{if(!groups.has(id))groups.set(id,{user_id:'__group:'+id,nickname:(room?.member_count||c?.member_count||3)+'명 그룹',member_count:room?.member_count||c?.member_count||3,challenges:[],is_group:true,room});return groups.get(id);};
  for(const c of source){const id=c.room_id||c.id;add(id,c,available.find(r=>r.id===id)).challenges.push(c);}for(const room of available.filter(r=>r.kind==='group'))add(room.id,null,room);
  return [...groups.values()];
 }
 function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;const d=new Date(s+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;}
 function validDraft(d){const title=String(d.title||'').trim(),goal=Number(d.goal),days=Number(d.days);const validGoal=d.kind==='activity'?goal===1:d.kind==='weight'?goal>=0.1&&goal<=30&&Math.abs(goal*10-Math.round(goal*10))<1e-8:Number.isInteger(goal)&&(d.kind==='water'?goal>=250&&goal<=10000:goal>=1&&goal<=4);return [...title].length>=2&&[...title].length<=50&&!/[\u0000-\u001f\u007f]/.test(title)&&['water','meal','weight','activity'].includes(d.kind)&&validGoal&&(d.kind!=='activity'||[7,14,30].includes(days))&&Number.isInteger(days)&&days>=1&&days<=30&&validDate(d.start)&&Array.isArray(d.friends)&&d.friends.length>=1&&d.friends.length<=9&&d.friends.every(uuid);}
 function message(error){return {nudge_unavailable:'알림을 보낼 수 없어요. 친구가 이미 목표를 달성했거나 공유를 껐을 수 있어요.',nudge_limit:'친구가 오늘 받은 알림이 많아요. 내일 다시 응원해 주세요.',login_required:'다시 로그인해 주세요.',profile_required:'먼저 내 닉네임을 저장해 주세요.',invalid_challenge:'챌린지 이름과 목표를 확인해 주세요.',invalid_period:'시작일은 오늘부터 30일 이내, 기간은 최대 30일까지 정할 수 있어요.',group_limit:'나를 포함해 최대 10명까지 함께할 수 있어요.',friend_required:'함께할 친구를 1명 이상 선택해 주세요.',not_a_friend:'친구 목록을 새로고침한 뒤 다시 선택해 주세요.',challenge_limit:'오늘 만든 챌린지가 많아요. 내일 다시 만들어 주세요.',challenge_unavailable:'이미 응답했거나 기간이 끝난 초대예요. 새로고침해 주세요.',creation_conflict:'입력 내용이 바뀌었어요. 다시 확인한 뒤 만들어 주세요.'}[error?.message]||'연결하지 못했어요. 새로고침해 주세요. 만들기를 재시도해도 같은 챌린지는 중복으로 생성되지 않아요.';}
 function createApi(client){
  async function rpc(name,args){const {data,error}=await client.rpc(name,args);if(error)throw error;return data;}
  return {
   async load(){const d=await rpc('ml_challenges_state_v8');if(!d||!validDate(d.today)||!Array.isArray(d.challenges)||(d.rooms!==undefined&&(!Array.isArray(d.rooms)||d.rooms.some(r=>!uuid(r.id)||!['friend','group'].includes(r.kind)||!Array.isArray(r.participants)||typeof r.unread!=='boolean')))||d.challenges.some(c=>!c||!uuid(c.id)||typeof c.title!=='string'||!['water','meal','weight','activity'].includes(c.kind)||!Array.isArray(c.participants)||!['pending','accepted'].includes(c.my_status)))throw Error('invalid_response');return d;},
   async archive(offset=0){if(!Number.isInteger(offset)||offset<0||offset>100000)throw Error('invalid_archive_page');const d=await rpc('ml_challenge_archive_v4',{p_offset:offset});if(!d||!validDate(d.today)||!Array.isArray(d.challenges)||typeof d.has_more!=='boolean'||!Number.isInteger(d.next_offset)||d.challenges.some(c=>!c||!uuid(c.id)||typeof c.title!=='string'||!['water','meal','weight','activity'].includes(c.kind)||!Array.isArray(c.participants)||c.phase!=='ended'||!['pending','accepted','withdrawn'].includes(c.my_status)))throw Error('invalid_response');return d;},
   async withdraw(id){if(!uuid(id))throw Error('challenge_unavailable');return rpc('ml_withdraw_challenge',{p_id:id});},
   async share(id,enabled){if(!uuid(id)||typeof enabled!=='boolean')throw Error('challenge_unavailable');return rpc('ml_set_water_sharing',{p_id:id,p_enabled:enabled});},
   async nudge(id,recipient){if(!uuid(id)||!uuid(recipient))throw Error('nudge_unavailable');const result=await rpc('ml_send_water_nudge',{p_id:id,p_recipient:recipient});if(!['sent','already_sent'].includes(result))throw Error('invalid_response');return result;},
   async inbox(){const d=await rpc('ml_water_inbox');if(!d||!Array.isArray(d.items)||!Number.isInteger(d.unread)||d.unread<0||d.items.some(n=>!uuid(n.id)||typeof n.sender!=='string'||typeof n.challenge!=='string'||typeof n.created_at!=='string'||typeof n.read!=='boolean'))throw Error('invalid_response');return d;},
   async read(ids){if(!Array.isArray(ids)||ids.length>20||!ids.every(uuid))throw Error('invalid_notifications');return rpc('ml_read_water_nudges',{p_ids:ids});},
   async create(d){if(!validDraft(d)||!uuid(d.key))throw Error('invalid_challenge');const result=await rpc('ml_create_challenge',{p_title:d.title.trim(),p_kind:d.kind,p_goal:d.kind==='weight'?Math.round(Number(d.goal)*1000):Number(d.goal),p_start:d.start,p_days:Number(d.days),p_friends:[...new Set(d.friends)],p_key:d.key});if(!uuid(result))throw Error('invalid_response');return result;},
   async respond(id,accept){if(!uuid(id)||typeof accept!=='boolean')throw Error('challenge_unavailable');return rpc('ml_respond_challenge',{p_id:id,p_accept:accept});}
  };
 }
 function mount({client,getUser,onEditAlias}){
  const $=id=>document.getElementById(id),api=createApi(client),form=$('challengeForm');
  let owner=null,epoch=0,busy=false,ready=false,friendData=null,data={today:'',challenges:[]},creationKey=null,refreshAgain=false;
  let inboxBusy=false,inboxData={items:[],unread:0},selectedFriend=null,friendPicked=false;
  let roomMode='friends';
  const chat=root.MealLogChat?.mount({client,getUser,getName:displayName,onChange:()=>void run()});
  const openDetails=new Map();
  let view='active',archiveRows=[],archiveReady=false,archiveMore=false,archiveOffset=0;
  const current=t=>t===epoch&&owner===getUser()?.id;
  const notice=text=>{$('challengeMessage').textContent=text;};
  function draft(){return {title:$('challengeTitle').value,kind:$('challengeKind').value,goal:$('challengeGoal').value,start:$('challengeStart').value,days:$('challengeDays').value,friends:[...document.querySelectorAll('#challengeFriends input:checked')].map(i=>i.value),key:creationKey};}
  function controls(){
   const enabled=!!owner&&!!friendData?.profile&&ready&&!busy;
   form.querySelectorAll('input,select').forEach(input=>input.disabled=!enabled);
   $('createChallenge').disabled=!enabled||!validDraft(draft())||!$('challengeConsent').checked;
   $('refreshChallenges').disabled=!owner||busy;
   document.querySelectorAll('#challengeCards [data-challenge-response]').forEach(b=>b.disabled=busy||(b.dataset.accept==='true'&&b.dataset.ended==='true'));
   document.querySelectorAll('#challengeCards [data-water-action]').forEach(b=>b.disabled=busy||b.dataset.unavailable==='true');
   document.querySelectorAll('#challengeCards [data-challenge-nav],#challengeCards [data-withdraw-action]').forEach(b=>b.disabled=busy);
   $('challengeLoading').hidden=!busy;
   const chosen=draft().friends.length;if($('challengeMemberHint'))$('challengeMemberHint').textContent='나를 포함해 최대 10명까지 그룹을 만들 수 있어요.';document.querySelectorAll('#challengeFriends input').forEach(input=>{input.disabled=!enabled||(!input.checked&&chosen>=9);});
   $('challengeSetupHint').textContent=!friendData?.profile?'설정의 내 프로필에서 닉네임을 먼저 저장해 주세요.':!friendData.friends.length?'친구를 추가하면 함께 챌린지를 시작할 수 있어요.':'함께할 친구를 선택해 주세요.';
  }
  function goalFields(reset){const kind=$('challengeKind').value,activity=kind==='activity';$('challengeGoal').closest('label').hidden=activity;if(activity){$('challengeGoal').value='1';$('challengeDays').value=['7','14','30'].includes($('challengeDays').value)?$('challengeDays').value:'7';}const water=kind==='water',weight=kind==='weight';$('challengeGoalUnit').textContent=weight?'kg':water?'mL':'회';$('challengeGoalLabel').textContent=weight?'기간 내 감량 목표':'하루 목표';$('challengeGoal').min=weight?'0.1':water?'250':'1';$('challengeGoal').max=weight?'30':water?'10000':'4';$('challengeGoal').step=weight?'0.1':'1';$('challengeGoal').placeholder=weight?'직접 설정':'';if(reset)$('challengeGoal').value=activity?'1':weight?'':water?'2000':'3';$('challengeWeightHint').hidden=!weight;$('challengeConsentText').textContent=activity?'참여자에게 내 닉네임·오늘/누적 예상 활동 소모량·순위를 공유할게요. 실제 체중과 운동 세부 기록은 공개하지 않아요.':weight?'참여자에게 내 닉네임·체중 변화량·변화 그래프·목표 달성 여부를 공유할게요.':'참여자에게 내 닉네임·달성일수·오늘 달성 여부를 공유할게요.';}
  function friendChoices(){
   const selected=new Set([...document.querySelectorAll('#challengeFriends input:checked')].map(i=>i.value)),box=$('challengeFriends');box.replaceChildren();
   for(const peer of friendData?.friends||[]){const label=document.createElement('label'),input=document.createElement('input'),name=document.createElement('span');input.type='checkbox';input.value=peer.user_id;input.checked=selected.has(peer.user_id);input.onchange=()=>{if(draft().friends.length>9){input.checked=false;notice('나를 포함해 최대 10명까지 함께할 수 있어요.');}creationKey=null;controls();};name.textContent=peer.nickname;label.className='challengeFriend';label.append(input,name);box.append(label);}
   renderCards();controls();
  }
  function element(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
  function displayName(id,name){if(id&&friendData?.aliases?.[id])return friendData.aliases[id];const matches=(friendData?.friends||[]).filter(f=>f.original_nickname===name);return matches.length===1?matches[0].nickname:name;}
  function renderInbox(){
   $('waterInboxPanel').hidden=!owner;$('waterAlertBtn').hidden=!owner;$('waterAlertBtn').textContent='💧 알림'+(inboxData.unread?' '+Math.min(inboxData.unread,99)+(inboxData.unread>99?'+':''):'');
   const box=$('waterInboxItems');box.replaceChildren();
   if(!inboxData.items.length)box.append(element('p','아직 받은 물 알림이 없어요.','muted'));
   for(const item of inboxData.items){const row=element('div',undefined,'waterInboxItem'+(item.read?'':' unread'));row.append(element('strong',displayName(null,item.sender)+' 님: 물 마실 시간이에요 💧'),element('p',item.challenge,'muted'));const date=new Date(item.created_at);row.append(element('small',Number.isFinite(date.getTime())?date.toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):''));box.append(row);}
   $('readWaterAlerts').disabled=inboxBusy||!inboxData.items.some(n=>!n.read);
  }
  async function refreshInbox(mark=false){
   if(!owner||inboxBusy)return;const ticket=epoch;inboxBusy=true;renderInbox();
   try{if(mark)await api.read(inboxData.items.filter(n=>!n.read).map(n=>n.id));if(!current(ticket))return;const result=await api.inbox();if(current(ticket)){inboxData=result;$('waterInboxStatus').textContent='';renderInbox();}}
   catch(error){if(current(ticket))$('waterInboxStatus').textContent='알림을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.';}
   finally{if(current(ticket)){inboxBusy=false;renderInbox();}}
  }
  function waterSharing(card,challenge){
   const shared=challenge.my_water_sharing===true;
   card.append(element('p','켜면 이 챌린지 참가자에게 오늘 섭취량을 공유하고, 친구의 물 알림을 받아요. 언제든 끌 수 있어요.','muted'));
   const b=element('button',shared?'섭취량 공유·알림 끄기':'섭취량 공유하고 물 알림 받기','secondary waterShareButton');b.type='button';b.dataset.waterAction='true';b.dataset.unavailable=String(!shared&&challenge.phase==='ended');b.onclick=()=>run(async()=>{await api.share(challenge.id,!shared);return shared?'섭취량 공유와 알림 받기를 껐어요.':'오늘 섭취량을 공유하고 물 알림을 받아요.';});card.append(b);
   if(challenge.phase==='active')card.append(element('p','화면이 열려 있으면 약 10초마다 갱신해요. 알림은 앱 안에서 확인할 수 있어요.','muted'));
  }
  function lossText(value){const n=Number(value);return n>0?n.toFixed(1)+'kg 감량':n<0?Math.abs(n).toFixed(1)+'kg 증가':'변화 없음 (0.0kg)';}
  function weightProgress(card,progress,name){
   const box=element('div',undefined,'challengeWeightPeer');box.append(element('strong',name));
   const series=(progress?.series||[]).filter(p=>validDate(p.date)&&typeof p.loss_kg==='number'&&Number.isFinite(p.loss_kg));
   if(!series.length){box.append(element('p','아직 체중 기록이 없어요.','muted'));card.append(box);return;}
   box.append(element('p',lossText(progress.loss_kg)+(progress.goal_met?' · 목표 달성!':''),'challengeProgress'),element('p','최근 기록 '+progress.latest_date+' · '+series.length+'일 기록','muted'));
   if(series.length===1)box.append(element('p','첫 기록을 기준으로 삼았어요. 다음 기록부터 변화가 표시돼요.','muted'));
   else{
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 320 110');svg.setAttribute('role','img');svg.setAttribute('aria-label',name+'의 체중 변화: '+series.map(p=>p.date+' '+lossText(p.loss_kg)).join(', '));svg.classList.add('challengeWeightChart');
    const low=Math.min(0,...series.map(p=>p.loss_kg)),high=Math.max(0,...series.map(p=>p.loss_kg)),span=Math.max(high-low,0.2),x=p=>12+(new Date(p.date+'T12:00Z')-new Date(series[0].date+'T12:00Z'))/(new Date(series.at(-1).date+'T12:00Z')-new Date(series[0].date+'T12:00Z'))*296,y=n=>94-(n-low)/span*78;
    const zero=document.createElementNS(ns,'line');for(const [k,v] of Object.entries({x1:12,x2:308,y1:y(0),y2:y(0),stroke:'#c8c0ba','stroke-dasharray':'4 4'}))zero.setAttribute(k,String(v));svg.append(zero);
    const line=document.createElementNS(ns,'polyline');line.setAttribute('points',series.map(p=>x(p)+','+y(p.loss_kg)).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#788b66');line.setAttribute('stroke-width','3');svg.append(line);
    for(const p of series){const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',String(x(p)));dot.setAttribute('cy',String(y(p.loss_kg)));dot.setAttribute('r','3');dot.setAttribute('fill','#788b66');svg.append(dot);}box.append(svg,element('p',series[0].date.slice(5)+' → '+series.at(-1).date.slice(5)+' · 위로 갈수록 감량','muted'));
   }
   const details=element('details',undefined,'challengeWeightDetails');details.append(element('summary','날짜별 변화량'));for(const p of series)details.append(element('p',p.date+' · '+lossText(p.loss_kg)));box.append(details);card.append(box);
  }
  function metric(card,name,text,value,max,mine){
   const row=element('div',undefined,'friendMetric'+(mine?' isMine':''));row.append(element('span',name),element('strong',text));card.append(row);
   if(typeof value==='number'&&Number.isFinite(value)&&max>0){const bar=element('div',undefined,'friendTrack'+(mine?' isMine':'')),fill=element('div');fill.style.width=Math.min(100,Math.max(0,value/max*100))+'%';bar.setAttribute('role','meter');bar.setAttribute('aria-label',name+' '+text);bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax',String(max));bar.setAttribute('aria-valuenow',String(Math.min(max,Math.max(0,value))));bar.append(fill);card.append(bar);}
  }
  function roomButton(group,head){if(!chat||!group.room)return;const b=element('button','💬 소통방'+(group.room.unread?' · 새 대화':''),'secondary challengeChatOpen');b.type='button';b.dataset.socialRoom=group.room.id;b.dataset.challengeNav='true';b.onclick=()=>chat.open({id:group.room.id,title:group.is_group?group.nickname+' 소통방':group.nickname+' 님과의 소통방'});head.append(b);}
  function fmtActivity(p){return p?.has_estimate?Number(p.total_kcal||0).toLocaleString()+' kcal':'아직 계산된 활동이 없어요.';}
  function activityRanking(card,c,group){const all=participants(c);for(const p of all){if(!group.is_group&&!p.is_me&&p.user_id!==group.user_id)continue;const name=p.is_me?'나':displayName(p.user_id,p.nickname);metric(card,(p.rank?p.rank+'위 · ':'')+name,fmtActivity(p)+' · 오늘 '+Number(p.today_value||0).toLocaleString()+' kcal',null,0,p.is_me);}card.append(element('p','걸음 + 중복을 제외한 운동 · 예상값으로 비교해요. 시간·체중이 없는 활동은 제외해요. 실제 몸무게는 비공개예요.','friendGroupNote'));}
  function compactCard(c,group){
   const card=element('section',undefined,'friendChallengeEntry'),heading=element('div',undefined,'friendEntryHeading'),phase=c.end_reason==='withdrawn'?'중도 포기':{upcoming:'시작 전',active:'진행 중',ended:'기간 종료'}[c.phase]||'';
   const icon={water:'💧',meal:'🍽️',weight:'🌿',activity:'🏋️'}[c.kind];heading.append(element('h3',icon+' '+c.title),element('span',phase,'friendPhase'));card.append(heading);
   const goal=c.kind==='activity'?'누적 예상 활동 소모량 순위':c.kind==='weight'?'기간 내 '+(c.goal/1000).toFixed(1)+'kg 감량':c.kind==='water'?'하루 물 '+Number(c.goal).toLocaleString()+'mL':'하루 식사 기록 '+c.goal+'회';
   card.append(element('p',goal+' · '+c.days+'일 · '+c.start_date+' ~ '+c.end_date,'friendEntryPeriod'));
   if(c.archive_summary){
    if(c.end_reason==='withdrawn'){const when=new Date(c.withdrawn_at);card.append(element('p','중도 포기'+(Number.isFinite(when.getTime())?' · '+when.toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}):'')+' · 포기 당시 내 결과','friendArchiveReason'));}
    else card.append(element('p',c.my_status==='pending'?'수락하지 않은 초대의 기간이 끝났어요.':'기간이 끝나 종료된 챌린지예요.','friendArchiveReason'));
    if(c.kind==='activity'){if(c.my_status==='accepted')activityRanking(card,c,group);else if(c.own_progress)metric(card,'나',fmtActivity(c.own_progress),null,0,true);return card;}
    const own=c.own_progress;if(own){if(c.kind==='weight'){metric(card,'나',own.loss_kg==null?'체중 기록 없음':lossText(own.loss_kg)+(own.goal_met?' · 목표 달성':''),null,0,true);const detail=element('details',undefined,'friendExtraDetails');detail.append(element('summary','내 변화 기록'));weightProgress(detail,own,'나');card.append(detail);}else metric(card,'나',(own.achieved_days||0)+' / '+c.days+'일 달성',own.achieved_days||0,c.days,true);}
    card.append(element('p','식사·물·체중 원본 기록은 그대로 보관돼요.','friendGroupNote'));return card;
   }
   if(c.my_status==='pending'){
    card.append(element('p',(group.is_group?c.owner_nickname||'친구':group.nickname)+' 님의 초대','friendInviteLabel'),element('p',c.kind==='activity'?'참여하면 닉네임·오늘/누적 예상 활동 소모량·순위를 공유해요. 참여한 날부터 걸음과 운동 기록을 합산해요. 실제 체중과 운동 세부 기록은 공개하지 않아요.':c.kind==='weight'?'참여하면 닉네임·체중 변화량·변화 그래프·목표 달성 여부를 공유해요. 실제 몸무게는 공개하지 않아요. 참여한 날 이후 첫 기록이 기준이에요.':'참여하면 닉네임·달성일수·오늘 달성 여부를 공유해요. 물 섭취량은 참여 후 따로 공유를 켤 수 있어요.','muted'));
    const actions=element('div',undefined,'challengeActions');for(const [label,accept] of [['동의하고 참여',true],['참여 안 함',false]]){const b=element('button',label,'secondary');b.type='button';b.dataset.challengeResponse='true';b.dataset.accept=String(accept);b.dataset.ended=String(c.phase==='ended');b.onclick=()=>run(async()=>{await api.respond(c.id,accept);return accept?'챌린지에 참여했어요.':'초대를 거절했어요.';});actions.append(b);}card.append(actions);return card;
   }
   const all=participants(c).map(p=>({...p,nickname:p.is_me?p.nickname:displayName(p.user_id,p.nickname)})),peer=all.find(p=>p.user_id===group.user_id),mine=all.find(p=>p.is_me),shown=group.is_group||group.user_id==='__mine'?all.filter(p=>!p.is_me):peer?[peer]:[];
   if(group.is_group){card.append(element('p',(c.accepted_count??all.length)+'명 참여'+(c.pending_count?' · '+c.pending_count+'명 수락 대기':'')+' · 참가자 전체 현황','friendGroupNote'));for(const p of c.peer_index||[])if(p.status==='withdrawn')card.append(element('p',displayName(p.user_id,p.nickname)+' 님은 중도 포기했어요.','friendWaiting'));}
   else if(all.length>2)card.append(element('p',all.length+'명 함께 · 선택한 친구와 나의 현황','friendGroupNote'));
   if(!peer&&!group.is_group&&group.user_id!=='__mine')card.append(element('p',(c.peer_index||[]).some(p=>p.user_id===group.user_id&&p.status==='withdrawn')?group.nickname+' 님은 중도 포기했어요. 내 참여는 계속돼요.':group.nickname+' 님의 참여를 기다리고 있어요.','friendWaiting'));
   if(c.kind==='activity'){activityRanking(card,c,group);
   }else if(c.kind==='weight'){
    for(const p of shown)metric(card,p.nickname,p.progress?.loss_kg==null?'아직 체중 기록이 없어요.':lossText(p.progress.loss_kg)+(p.progress.goal_met?' · 목표 달성':''),null,0,false);
    const own=mine?.progress||c.own_progress;metric(card,'나',own?.loss_kg==null?'아직 체중 기록이 없어요.':lossText(own.loss_kg)+(own.goal_met?' · 목표 달성':''),null,0,true);
    const detail=element('details',undefined,'friendExtraDetails');detail.dataset.detailsKey=group.user_id+':'+c.id+':weight';detail.open=openDetails.get(detail.dataset.detailsKey)||false;detail.append(element('summary','변화 그래프 · 날짜별 기록'));for(const p of shown)weightProgress(detail,p.progress,p.nickname);weightProgress(detail,own,'나');detail.append(element('p','실제 몸무게는 비공개예요. 기간 중 참여한 날부터 첫 기록이 기준이에요.','muted'));card.append(detail);
   }else{
    for(const p of shown){if(c.kind==='water'&&c.phase==='active'){const amount=typeof p.today_value==='number'?p.today_value:null;metric(card,p.nickname,amount==null?'오늘 섭취량 비공개':'오늘 '+amount.toLocaleString()+' / '+Number(c.goal).toLocaleString()+'mL',amount,c.goal,false);if(p.can_remind||p.nudged_today){const b=element('button',p.nudged_today?'오늘 알림 보냄':'💧 '+p.nickname+'에게 물 알림 보내기','secondary waterNudgeButton');b.type='button';b.dataset.waterAction='true';b.dataset.unavailable=String(!!p.nudged_today||!p.can_remind);b.onclick=()=>run(async()=>{const result=await api.nudge(c.id,p.user_id);return result==='sent'?p.nickname+' 님에게 앱 알림을 보냈어요.':'오늘 이미 알림을 보냈어요.';});card.append(b);}}
     else metric(card,p.nickname,(p.achieved_days||0)+' / '+c.days+'일 달성'+(c.phase==='active'?' · 오늘 '+(p.today_complete?'달성':'미달성'):''),p.achieved_days||0,c.days,false);}
    const progress=c.own_progress||{};if(c.phase==='active')metric(card,'나','오늘 '+Number(progress.today_value||0).toLocaleString()+' / '+Number(c.goal).toLocaleString()+(c.kind==='water'?'mL':'회'),Number(progress.today_value||0),c.goal,true);
    card.append(element('p','내 달성 '+(progress.achieved_days||0)+' / '+c.days+'일','friendGroupNote'));
    if(c.kind==='water'){const settings=element('details',undefined,'friendExtraDetails');settings.dataset.detailsKey=group.user_id+':'+c.id+':water';settings.open=openDetails.get(settings.dataset.detailsKey)||false;settings.append(element('summary','내 섭취량 공유 · 알림 설정'));waterSharing(settings,c);card.append(settings);}
   }
   
   if(c.my_status==='accepted'&&c.phase!=='ended'){
    const quit=element('details',undefined,'challengeQuit');quit.dataset.detailsKey=group.user_id+':'+c.id+':quit';quit.open=openDetails.get(quit.dataset.detailsKey)||false;quit.append(element('summary','중도 포기'),element('p','「'+c.title+'」 1개만 포기해요. 다른 챌린지는 계속 진행돼요. 이 챌린지의 내 정보 공유와 물 알림을 중단하고 종료된 챌린지에 보관해요. 식사·물·체중 기록은 지우지 않아요. 포기 후 같은 챌린지에는 다시 참여할 수 없어요. 소통방의 대화는 삭제되지 않아요.'));
    const actions=element('div',undefined,'challengeActions'),cancel=element('button','계속 참여','secondary'),confirm=element('button','포기하고 보관','challengeQuitConfirm');cancel.type=confirm.type='button';cancel.onclick=()=>{quit.open=false;};confirm.dataset.withdrawAction='true';confirm.dataset.challengeId=c.id;confirm.onclick=()=>run(async ticket=>{await api.withdraw(c.id);if(!current(ticket))return '';view='active';selectedFriend=group.user_id;friendPicked=true;archiveReady=false;return '「'+c.title+'」 1개를 포기했어요. 나머지 챌린지는 계속 진행돼요. 포기한 기록은 종료된 챌린지에서 확인할 수 있어요.';});actions.append(cancel,confirm);quit.append(actions);card.append(quit);
   }
   return card;
  }
  function setArchive(result,append=false){archiveRows=append?[...new Map([...archiveRows,...result.challenges].map(c=>[c.id,c])).values()]:result.challenges;archiveReady=true;archiveMore=result.has_more;archiveOffset=result.next_offset;}
  async function moreArchive(){if(!owner||busy||!archiveMore)return;const ticket=epoch;busy=true;controls();try{const result=await api.archive(archiveOffset);if(!current(ticket))return;setArchive(result,true);renderCards();}catch(error){if(current(ticket))notice(message(error));}finally{if(current(ticket)){busy=false;controls();}}}
  function renderCards(){
   root.MealLogHome?.setChallenges(ready?data:null,friendData,owner); 
   document.querySelectorAll('#challengeCards details[data-details-key]').forEach(d=>openDetails.set(d.dataset.detailsKey,d.open));
   const cards=$('challengeCards');cards.replaceChildren();
   if(!owner){selectedFriend=null;return;}
   const views=element('div',undefined,'challengeViewTabs');views.setAttribute('role','group');views.setAttribute('aria-label','챌린지 진행 상태');for(const [key,label] of [['active','진행 중'],['archive','종료된 챌린지']]){const b=element('button',label,'challengeViewTab');b.type='button';b.dataset.challengeNav='true';b.setAttribute('aria-pressed',String(view===key));b.onclick=()=>{view=key;if(view==='archive'&&!archiveReady)void run();else renderCards();};views.append(b);}cards.append(views);
   const source=view==='archive'?archiveRows:data.challenges;
   const modes=element('div',undefined,'challengeViewTabs challengeRoomModes');modes.setAttribute('role','group');modes.setAttribute('aria-label','친구 또는 그룹 챌린지');
   for(const [mode,label] of [['friends','친구별'],['groups','그룹']]){const n=conversationGroups(source,friendData?.friends,owner,data.rooms,mode).length,b=element('button',label+(n?' '+n:''),'challengeViewTab');b.type='button';b.dataset.challengeNav='true';b.dataset.roomMode=mode;b.setAttribute('aria-pressed',String(roomMode===mode));b.onclick=()=>{roomMode=mode;selectedFriend=null;friendPicked=false;renderCards();};modes.append(b);}cards.append(modes);
   const groups=conversationGroups(source,friendData?.friends,owner,data.rooms,roomMode).map(g=>{if(!g.is_group)return {...g,nickname:displayName(g.user_id,g.nickname)};const peers=new Map();for(const p of g.room?.participants||[])if(p.user_id!==owner)peers.set(p.user_id,displayName(p.user_id,p.nickname));for(const c of g.challenges)for(const p of c.peer_index||[])if(p.user_id!==owner&&p.status!=='withdrawn')peers.set(p.user_id,displayName(p.user_id,p.nickname));const names=[...peers.values()];return {...g,nickname:names.length?names.slice(0,2).join(' · ')+(names.length>2?' 외 '+(names.length-2)+'명':''):g.nickname};});
   if(!groups.length){cards.append(element('p',roomMode==='groups'?'새 챌린지에서 친구를 2명 이상 선택하면 그룹으로 함께할 수 있어요.':view==='archive'?'아직 종료된 챌린지가 없어요.':ready?'함께할 친구를 추가하거나 새 챌린지를 만들어 보세요.':'챌린지를 불러오면 여기에 표시돼요.','muted'));if(view==='archive'&&archiveMore){const more=element('button','이전 종료 기록 더 보기','secondary');more.type='button';more.dataset.challengeNav='true';more.onclick=()=>void moreArchive();cards.append(more);}controls();return;}
   if(!groups.some(g=>g.user_id===selectedFriend)||(!friendPicked&&!groups.find(g=>g.user_id===selectedFriend)?.challenges.length&&groups.some(g=>g.challenges.length)))selectedFriend=groups[0].user_id;
   const tabs=element('div',undefined,'challengeFriendTabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','챌린지를 함께하는 친구 선택');
   for(const group of groups){const b=element('button',undefined,'challengeFriendTab');b.type='button';b.setAttribute('aria-pressed',String(group.user_id===selectedFriend));b.dataset.friendSelect=group.user_id;b.append(element('span',group.is_group?'👥':Array.from(group.nickname)[0]||'친','challengeFriendAvatar'),element('span',group.nickname),element('small',group.is_group?String(group.member_count)+'명':String(group.challenges.length)));b.onclick=()=>{selectedFriend=group.user_id;friendPicked=true;renderCards();controls();};tabs.append(b);}cards.append(tabs);
   const group=groups.find(g=>g.user_id===selectedFriend),window=element('section',undefined,'friendChallengeWindow'),head=element('div',undefined,'friendChallengeHead'),live=group.challenges;
   head.append(element('h3',group.is_group?group.nickname:group.user_id==='__mine'?'내 챌린지':group.nickname+' 님과 함께'),element('p',group.is_group?'나를 포함한 '+group.member_count+'명 그룹 · '+(view==='archive'?'종료된 챌린지 ':'진행 중·초대 ')+live.length+'개':(view==='archive'?'종료된 챌린지 ':'참여 중·초대 ')+live.length+'개','friendGroupNote'));if(onEditAlias&&(friendData?.friends||[]).some(f=>f.user_id===group.user_id)){const edit=element('button',friendData?.aliases?.[group.user_id]?'별명 수정':'별명 설정','privateAliasHeadButton');edit.type='button';edit.onclick=()=>onEditAlias(group.user_id);head.append(edit);}roomButton(group,head);window.append(head);
   for(const c of live)window.append(compactCard(c,group));if(!live.length)window.append(element('p',view==='archive'?'이 친구와 종료된 챌린지가 없어요.':'진행 중인 챌린지가 없어요. 소통방에서 계속 이야기 나눠요.','friendEmpty'));
   if(view==='archive'&&archiveMore){const more=element('button','이전 종료 기록 더 보기','secondary');more.type='button';more.dataset.challengeNav='true';more.onclick=()=>void moreArchive();window.append(more);}
   cards.append(window,element('p',view==='archive'?'종료된 기록은 이곳에 보관돼요. 중도 포기는 내 참여만 종료해요.':'물 섭취량은 동의한 경우만 공유 · 약 10초마다 갱신','friendGroupFooter'));controls();
  }
  async function run(work){
   if(!owner)return;if(busy){if(!work)refreshAgain=true;return;}
   const ticket=epoch;busy=true;refreshAgain=false;notice('');controls();let completed='';
   try{
    if(work){completed=await work(ticket);if(!current(ticket))return;}
    const result=await api.load();if(!current(ticket))return;
    if(view==='active')archiveReady=false;
    if(view==='archive'){const archived=await api.archive(0);if(!current(ticket))return;setArchive(archived);}
    if(!ready)$('challengeStart').value=result.today;
    $('challengeStart').min=result.today;const last=new Date(result.today+'T12:00:00Z');last.setUTCDate(last.getUTCDate()+30);$('challengeStart').max=last.toISOString().slice(0,10);
    if(!ready&&result.challenges.some(isGroup)&&!result.challenges.some(c=>!isGroup(c)))roomMode='groups';data=result;ready=true;renderCards();notice(completed);
   }catch(error){if(current(ticket))root.MealLogHome?.setChallenges(null,friendData,owner,true);if(current(ticket))notice((completed?completed+' 목록은 새로고침해 주세요. ':'')+message(error));}
   finally{if(current(ticket)){busy=false;controls();if(refreshAgain){refreshAgain=false;void run();}}}
  }
  function accountChanged(){const id=getUser()?.id||null;if(id===owner)return;owner=id;epoch++;chat?.accountChanged();roomMode='friends';busy=false;ready=false;friendData=null;data={today:'',challenges:[]};view='active';archiveRows=[];archiveReady=false;archiveMore=false;archiveOffset=0;selectedFriend=null;friendPicked=false;openDetails.clear();creationKey=null;refreshAgain=false;inboxBusy=false;inboxData={items:[],unread:0};$('waterInboxStatus').textContent='';renderInbox();form.reset();goalFields(true);$('challengeFriends').replaceChildren();notice('');renderCards();controls();if(owner){void refreshInbox();void run();}}
  form.oninput=()=>{creationKey=null;controls();};$('challengeKind').onchange=()=>{creationKey=null;$('challengeConsent').checked=false;goalFields(true);controls();};
  form.onsubmit=e=>{e.preventDefault();if(!ready||busy||!$('challengeConsent').checked)return;const value=draft();if(!validDraft(value))return;
   creationKey=creationKey||crypto.randomUUID();value.key=creationKey;
   void run(async ticket=>{const created=await api.create(value);if(!current(ticket))return '';roomMode=value.friends.length>1?'groups':'friends';selectedFriend=value.friends.length>1?null:value.friends[0];friendPicked=true;view='active';archiveReady=false;creationKey=null;form.reset();$('challengeStart').value=data.today;goalFields(true);friendChoices();return '챌린지를 만들고 선택한 친구에게 초대했어요.';});
  };
  $('refreshChallenges').onclick=()=>{void run();void refreshInbox();};
  $('waterAlertBtn').onclick=()=>{document.querySelector('.tab[data-view="friends"]').click();$('waterInboxPanel').scrollIntoView?.({behavior:'smooth',block:'start'});void refreshInbox();};
  $('readWaterAlerts').onclick=()=>void refreshInbox(true);
  document.querySelector('.tab[data-view="friends"]').addEventListener('click',()=>{if(owner)void run();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&owner){void refreshInbox();if(!$('friendsView').hidden)void run();}});
  root.setInterval?.(()=>{if(!owner||document.visibilityState!=='visible'||root.navigator?.onLine===false)return;void refreshInbox();if(view==='active'&&(!$('friendsView').hidden||!$('diaryView')?.hidden)&&!document.querySelector('.challengeCreate[open]')&&!document.querySelector('#challengeCards details[open]'))void run();},10000);
  goalFields(false);renderCards();renderInbox();controls();
  return {accountChanged,setFriends(value){if(owner!==getUser()?.id)return;friendData=value;friendChoices();renderInbox();},refreshVisible(){if(owner&&!$('friendsView').hidden)void run();}};
 }
 root.MealLogChallenges={validDate,validDraft,message,createApi,mount,friendGroups,isGroup,conversationGroups};if(typeof module==='object'&&module.exports)module.exports=root.MealLogChallenges;
})(typeof globalThis!=='undefined'?globalThis:this);

