(function(root){'use strict';
 const key=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 const shift=(day,n)=>{const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+n);return key(d)};
 const number=v=>Number.isFinite(Number(v))&&Number(v)>0?Number(v):0;
 function calculate(snapshot,today,offset=0,exercises=[]){
  const d=new Date(today+'T12:00:00');if(!Number.isFinite(d.getTime())||key(d)!==today||!Number.isInteger(offset)||offset>0||offset< -12)throw Error('invalid_week');
  const monday=shift(today,-((d.getDay()+6)%7)+offset*7),end=offset===0?today:shift(monday,6),length=offset===0?(d.getDay()+6)%7+1:7;
  function period(start){const days=Array.from({length:7},(_,i)=>({date:shift(start,i),future:i>=length,meals:0,calories:0,unknownFoods:0,water:0,workouts:0,minutes:0}));const byDate=new Map(days.filter(x=>!x.future).map(x=>[x.date,x])),slots=new Map([...byDate.keys()].map(date=>[date,new Set()]));
   for(const m of snapshot.meals||[]){const day=byDate.get(String(m.time||m.meal_date||'').slice(0,10));if(day){const types=slots.get(day.date);types.add(root.MealLogStats.typeKey(m));day.meals=types.size;day.unknownFoods+=(m.foods||[]).filter(f=>root.MealLogQuality?.unknown(f)).length;day.calories+=(m.foods||[]).filter(f=>!root.MealLogQuality?.unknown(f)).reduce((n,f)=>n+number(f.calories),0);}}
   for(const day of byDate.values())day.water=number(snapshot.activity?.[day.date]?.water);
   for(const r of exercises||[]){const day=byDate.get(r.record_date);if(day&&!r.deleted){day.workouts++;day.minutes+=number(r.minutes);}}
   const elapsed=[...byDate.values()],mealDays=elapsed.filter(x=>x.meals).length,waterDays=elapsed.filter(x=>x.water>0).length,workoutDays=elapsed.filter(x=>x.workouts).length;
   const complete=elapsed.filter(x=>x.meals&&!x.unknownFoods),unknownFoods=elapsed.reduce((n,x)=>n+x.unknownFoods,0);return{days,unknownFoods,completeDays:complete.length,mealDays,waterDays,workoutDays,recordDays:elapsed.filter(x=>x.meals||x.water||x.workouts).length,meals:elapsed.reduce((n,x)=>n+x.meals,0),averageCalories:complete.length?complete.reduce((n,x)=>n+x.calories,0)/complete.length:0,averageWater:waterDays?elapsed.reduce((n,x)=>n+x.water,0)/waterDays:0,waterGoalDays:elapsed.filter(x=>x.water>=number(snapshot.waterGoal||2000)).length,minutes:elapsed.reduce((n,x)=>n+x.minutes,0),workouts:elapsed.reduce((n,x)=>n+x.workouts,0)};
  }
  const current=period(monday),previous=period(shift(monday,-7));return{start:monday,end,length,current,previous};
 }
 let controller;
 function mount({client,getUser,prepare}){
  const $=id=>document.getElementById(id),node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e},fmt=n=>Math.round(n).toLocaleString('ko-KR');
  let owner=null,version=0,rows=[],loaded=false,loading=false,error=false,offset=0;
  function clear(){version++;rows=[];loaded=false;loading=false;error=false;render();}
  function accountChanged(){const next=getUser()?.id||null;if(next===owner)return;owner=next;offset=0;clear();if(owner&&!$('statsView').hidden)void refresh();}
  function render(){const box=$('weeklyReview');if(!box)return;box.replaceChildren();const r=calculate(state,localDateKey(new Date()),offset,loaded?rows:[]),c=r.current,p=r.previous;
   const heading=node('div',undefined,'weeklyHeading'),title=node('div');title.append(node('small',offset===0?'이번 주의 작은 발자국':'지난 기록 돌아보기'),node('h2','한 주도 차곡차곡 🌿'));const refreshButton=node('button',loading?'불러오는 중…':'새로고침','weeklyRefresh');refreshButton.type='button';refreshButton.disabled=loading||!owner;refreshButton.onclick=()=>void refresh();heading.append(title,refreshButton);box.append(heading);
   const nav=node('div',undefined,'weeklyNav'),prev=node('button','‹'),next=node('button','›');for(const b of [prev,next])b.type='button';prev.setAttribute('aria-label','이전 주 보기');next.setAttribute('aria-label','다음 주 보기');prev.disabled=offset<=-12;next.disabled=offset===0;prev.onclick=()=>{offset--;render()};next.onclick=()=>{offset++;render()};nav.append(prev,node('strong',r.start.slice(5).replace('-','/')+' ~ '+r.end.slice(5).replace('-','/')),next);box.append(nav);
   const complete=loaded||!owner,days=node('div',undefined,'weeklyDays');days.setAttribute('aria-label','요일별 식사·물·운동 기록');
   c.days.forEach((day,i)=>{const active=day.meals||day.water||(loaded&&day.workouts),tile=node('div',undefined,'weeklyDay'+(day.future?' future':active?' recorded':''));tile.append(node('small',['월','화','수','목','금','토','일'][i]),node('span',day.future?'·':active?'🌱':'○'),node('small',Number(day.date.slice(-2))+'일'));tile.setAttribute('aria-label',day.date+(day.future?' 아직 오지 않은 날':active?' 기록 있음':' 식사·물 기록 없음'+(complete?'':' · 운동 확인 중')));days.append(tile)});box.append(days);
   const tiles=node('div',undefined,'weeklyTiles'),food=node('div',undefined,'weeklyTile meal'),water=node('div',undefined,'weeklyTile water'),exercise=node('div',undefined,'weeklyTile exercise');
   food.append(node('span','🍽️ 식사'),node('strong',c.mealDays+'일 기록'),node('small',c.unknownFoods?'영양 미입력 '+c.unknownFoods+'개 · 완전한 '+c.completeDays+'일 평균 '+fmt(c.averageCalories)+' kcal':c.mealDays?'총 '+c.meals+'번 · 평균 '+fmt(c.averageCalories)+' kcal':'아직 식사 기록이 없어요.'));
   water.append(node('span','💧 물'),node('strong',c.waterDays+'일 기록'),node('small',c.waterDays?'평균 '+fmt(c.averageWater)+'mL · 목표 '+c.waterGoalDays+'일 달성':'물 한 잔부터 남겨 보세요.'));
   exercise.append(node('span','🏋️ 운동'),node('strong',loaded?c.workoutDays+'일 기록':owner?(loading?'불러오는 중':'새로고침 필요'):'로그인 후 확인'),node('small',loaded?c.workouts+'번 · '+fmt(c.minutes)+'분 기록':'내 운동 기록을 모아 보여드려요.'));tiles.append(food,water,exercise);box.append(tiles);
   let message=!c.recordDays?'오늘의 작은 기록부터 시작해 볼까요? 🌱':c.recordDays>=r.length?'하루하루 남긴 기록이 모였어요. 꾸준한 나를 칭찬해 주세요! 🌸':'벌써 '+c.recordDays+'일의 발자국을 남겼어요. 내 속도로 이어 가요 🌱';box.append(node('p',message,'weeklyCheer'));
   const diff=c.mealDays-p.mealDays,comparison=diff>0?'식사를 지난주 같은 기간보다 '+diff+'일 더 기록했어요.':diff<0?'지난주 같은 기간에는 식사를 '+p.mealDays+'일 기록했어요. 오늘부터 다시 이어 가도 좋아요.':c.mealDays?'지난주 같은 기간처럼 식사 기록을 이어 가고 있어요.':'첫 기록이 쌓이면 지난주와 비교해 드릴게요.';box.append(node('p',comparison,'weeklyCompare'));
   const changes=node('p',undefined,'weeklyCompare');changes.textContent='물 기록 '+(c.waterDays-p.waterDays>0?'+':'')+(c.waterDays-p.waterDays)+'일'+(loaded?' · 운동 기록 '+(c.workoutDays-p.workoutDays>0?'+':'')+(c.workoutDays-p.workoutDays)+'일':'');box.append(changes);
   box.append(node('small','같은 날짜·식사 종류는 여러 번 기록해도 1회예요. 월요일 시작 · 지난주는 같은 요일까지 비교해요. 평균은 각 항목을 기록한 날 기준이며, 물 달성은 현재 목표 기준이에요. 운동 시간 없이 저장한 세트도 기록 횟수에 포함해요.','weeklyFootnote'));
   if(error){const retry=node('p','운동 내역을 불러오지 못했어요. 새로고침해서 다시 확인해 주세요.','weeklyError');retry.setAttribute('role','status');box.append(retry);}
  }
  async function refresh(){if(!owner||loading)return;const id=owner,ticket=++version;loading=true;error=false;loaded=false;rows=[];render();
   try{await prepare();if(ticket!==version||id!==owner)return;const generation=localStorage.getItem('meallog-reset-generation-v1:'+id),history=[];
    for(let start=0;start<=1000000;start+=200){const r=await client.rpc('ml_exercise_export',{p_offset:start});if(r.error)throw r.error;if(ticket!==version||id!==owner||generation!==localStorage.getItem('meallog-reset-generation-v1:'+id))return;if(!Array.isArray(r.data))throw Error('invalid_response');history.push(...r.data);if(r.data.length<200)break;}rows=history;loaded=true;
   }catch(e){if(ticket===version&&id===owner)error=true;}
   finally{if(ticket===version&&id===owner){loading=false;render();}}
  }
  $('weeklyHomeOpen').onclick=()=>{offset=0;document.querySelector('[data-view="stats"]').click();$('weeklyReview').scrollIntoView({block:'start',behavior:'smooth'});};
  document.querySelector('[data-view="stats"]').addEventListener('click',()=>{render();void refresh()});render();return controller={accountChanged,refresh,render,reset:clear};
 }
 root.MealLogWeekly={calculate,mount,render:()=>controller?.render(),reset:()=>controller?.reset(),refresh:()=>controller?.refresh()};
})(typeof window==='object'?window:globalThis);
