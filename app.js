const $=s=>document.querySelector(s), mealsEl=$('#meals'); let photoData='';
let state=JSON.parse(localStorage.getItem('meallog-state')||'{"goal":1800,"meals":[]}');

/* 영양값은 일반적인 100g 기준의 근사치입니다. 제품/조리법에 따라 달라질 수 있습니다.
   portions: [표시명, g] */
const FOOD_DB=[
{name:'흰쌀밥',aliases:['밥','쌀밥','공기밥'],calories:130,carbs:28.2,protein:2.7,fat:.3,portions:[['1공기',210],['반공기',105],['100g',100]]},
{name:'잡곡밥',aliases:['현미밥','잡곡'],calories:145,carbs:30,protein:3.2,fat:1.2,portions:[['1공기',210],['반공기',105],['100g',100]]},
{name:'현미밥',aliases:['현미'],calories:123,carbs:25.6,protein:2.7,fat:1,portions:[['1공기',210],['반공기',105],['100g',100]]},
{name:'김치',aliases:['배추김치'],calories:25,carbs:4.2,protein:1.6,fat:.5,portions:[['작은 접시',50],['100g',100]]},
{name:'깍두기',aliases:[],calories:33,carbs:6.5,protein:1.3,fat:.3,portions:[['작은 접시',50],['100g',100]]},
{name:'삶은 계란',aliases:['계란','달걀','삶은 달걀'],calories:155,carbs:1.1,protein:12.6,fat:10.6,portions:[['1개',50],['2개',100],['100g',100]]},
{name:'계란후라이',aliases:['계란 프라이','달걀후라이','후라이'],calories:196,carbs:.8,protein:13.6,fat:15,portions:[['1개',50],['2개',100],['100g',100]]},
{name:'스크램블에그',aliases:['스크램블'],calories:149,carbs:1.6,protein:10,fat:11,portions:[['계란 2개 분량',100],['100g',100]]},
{name:'닭가슴살',aliases:['치킨브레스트'],calories:165,carbs:0,protein:31,fat:3.6,portions:[['1팩/1조각',100],['150g',150],['100g',100]]},
{name:'닭다리살 구이',aliases:['닭다리살'],calories:209,carbs:0,protein:26,fat:11,portions:[['100g',100],['150g',150]]},
{name:'소고기 구이',aliases:['소고기','쇠고기'],calories:250,carbs:0,protein:26,fat:15,portions:[['100g',100],['150g',150]]},
{name:'돼지고기 삼겹살',aliases:['삼겹살'],calories:518,carbs:0,protein:17,fat:53,portions:[['100g',100],['1인분 150g',150]]},
{name:'돼지고기 목살',aliases:['목살'],calories:242,carbs:0,protein:27,fat:14,portions:[['100g',100],['1인분 150g',150]]},
{name:'연어',aliases:['연어구이'],calories:208,carbs:0,protein:20,fat:13,portions:[['100g',100],['150g',150]]},
{name:'고등어 구이',aliases:['고등어'],calories:205,carbs:0,protein:23,fat:12,portions:[['한 토막',100],['100g',100]]},
{name:'참치회',aliases:['참치'],calories:132,carbs:0,protein:28,fat:1.3,portions:[['100g',100],['150g',150]]},
{name:'광어회',aliases:['광어'],calories:103,carbs:0,protein:21,fat:1.7,portions:[['100g',100],['150g',150]]},
{name:'두부',aliases:[],calories:84,carbs:2,protein:9.3,fat:4.2,portions:[['1/4모',75],['반모',150],['100g',100]]},
{name:'김',aliases:['구운김'],calories:306,carbs:44,protein:36,fat:5,portions:[['1봉(약 5g)',5],['10g',10]]},
{name:'미역국',aliases:['소고기미역국'],calories:45,carbs:3,protein:4,fat:2,portions:[['1그릇',300],['100g',100]]},
{name:'된장찌개',aliases:['된장찌게'],calories:65,carbs:7,protein:5,fat:2.5,portions:[['1그릇',300],['100g',100]]},
{name:'김치찌개',aliases:['김치찌게'],calories:75,carbs:5,protein:6,fat:4,portions:[['1그릇',300],['100g',100]]},
{name:'순두부찌개',aliases:['순두부'],calories:78,carbs:4,protein:6,fat:4.5,portions:[['1그릇',350],['100g',100]]},
{name:'불고기',aliases:['소불고기'],calories:170,carbs:9,protein:17,fat:7,portions:[['1인분',200],['100g',100]]},
{name:'제육볶음',aliases:['제육'],calories:230,carbs:12,protein:17,fat:13,portions:[['1인분',200],['100g',100]]},
{name:'비빔밥',aliases:[],calories:140,carbs:23,protein:5,fat:3.5,portions:[['1그릇',450],['100g',100]]},
{name:'김밥',aliases:['일반김밥'],calories:170,carbs:28,protein:5.5,fat:4.5,portions:[['1줄',250],['반줄',125],['100g',100]]},
{name:'떡볶이',aliases:[],calories:180,carbs:36,protein:4,fat:2,portions:[['1인분',300],['100g',100]]},
{name:'라면',aliases:['라면 끓인것'],calories:140,carbs:21,protein:4,fat:4.5,portions:[['1봉 조리 후',500],['100g',100]]},
{name:'우동',aliases:[],calories:105,carbs:20,protein:3.5,fat:1,portions:[['1그릇',500],['100g',100]]},
{name:'냉면',aliases:[],calories:110,carbs:22,protein:3.5,fat:1,portions:[['1그릇',500],['100g',100]]},
{name:'칼국수',aliases:[],calories:100,carbs:19,protein:3.5,fat:1,portions:[['1그릇',550],['100g',100]]},
{name:'만두',aliases:['고기만두'],calories:200,carbs:25,protein:8,fat:8,portions:[['1개',30],['5개',150],['100g',100]]},
{name:'고구마',aliases:['찐고구마'],calories:128,carbs:30,protein:1.4,fat:.2,portions:[['중간 1개',150],['작은 1개',100],['100g',100]]},
{name:'감자',aliases:['삶은감자','찐감자'],calories:87,carbs:20,protein:1.9,fat:.1,portions:[['중간 1개',150],['100g',100]]},
{name:'바나나',aliases:[],calories:89,carbs:22.8,protein:1.1,fat:.3,portions:[['중간 1개',100],['반개',50],['100g',100]]},
{name:'사과',aliases:[],calories:52,carbs:13.8,protein:.3,fat:.2,portions:[['중간 1개',200],['반개',100],['100g',100]]},
{name:'딸기',aliases:[],calories:32,carbs:7.7,protein:.7,fat:.3,portions:[['5개 정도',100],['100g',100]]},
{name:'블루베리',aliases:[],calories:57,carbs:14.5,protein:.7,fat:.3,portions:[['한 줌',80],['100g',100]]},
{name:'포도',aliases:[],calories:69,carbs:18,protein:.7,fat:.2,portions:[['한 줌',100],['100g',100]]},
{name:'수박',aliases:[],calories:30,carbs:7.6,protein:.6,fat:.2,portions:[['한 조각',200],['100g',100]]},
{name:'귤',aliases:['감귤'],calories:47,carbs:12,protein:.9,fat:.1,portions:[['1개',100],['100g',100]]},
{name:'오렌지',aliases:[],calories:47,carbs:12,protein:.9,fat:.1,portions:[['1개',150],['100g',100]]},
{name:'키위',aliases:[],calories:61,carbs:14.7,protein:1.1,fat:.5,portions:[['1개',80],['100g',100]]},
{name:'아보카도',aliases:[],calories:160,carbs:8.5,protein:2,fat:14.7,portions:[['반개',100],['1개',200],['100g',100]]},
{name:'방울토마토',aliases:['토마토'],calories:18,carbs:3.9,protein:.9,fat:.2,portions:[['10개 정도',150],['100g',100]]},
{name:'오이',aliases:[],calories:15,carbs:3.6,protein:.7,fat:.1,portions:[['1개',200],['100g',100]]},
{name:'양상추',aliases:['샐러드채소'],calories:15,carbs:2.9,protein:1.4,fat:.2,portions:[['한 접시',100],['100g',100]]},
{name:'우유',aliases:['흰우유'],calories:61,carbs:4.8,protein:3.2,fat:3.3,portions:[['1잔',200],['1팩',200],['100ml',100]]},
{name:'저지방 우유',aliases:['저지방우유'],calories:42,carbs:5,protein:3.4,fat:1,portions:[['1잔',200],['100ml',100]]},
{name:'무가당 두유',aliases:['두유'],calories:40,carbs:3,protein:3.5,fat:2,portions:[['1팩',190],['100ml',100]]},
{name:'그릭요거트 플레인',aliases:['그릭요거트','그릭 요거트'],calories:97,carbs:3.9,protein:9,fat:5,portions:[['1컵',100],['150g',150]]},
{name:'플레인 요거트',aliases:['요거트','요구르트'],calories:63,carbs:7,protein:5.3,fat:1.6,portions:[['1컵',100],['150g',150]]},
{name:'체다치즈',aliases:['치즈'],calories:403,carbs:1.3,protein:25,fat:33,portions:[['1장',20],['2장',40],['100g',100]]},
{name:'아몬드',aliases:[],calories:579,carbs:21.6,protein:21.2,fat:49.9,portions:[['한 줌',25],['10알',12],['100g',100]]},
{name:'호두',aliases:[],calories:654,carbs:13.7,protein:15.2,fat:65.2,portions:[['한 줌',25],['100g',100]]},
{name:'식빵',aliases:['빵','토스트'],calories:265,carbs:49,protein:9,fat:3.2,portions:[['1장',35],['2장',70],['100g',100]]},
{name:'베이글',aliases:[],calories:250,carbs:49,protein:10,fat:1.5,portions:[['1개',100],['반개',50]]},
{name:'크루아상',aliases:[],calories:406,carbs:46,protein:8,fat:21,portions:[['1개',60],['100g',100]]},
{name:'오트밀',aliases:['귀리'],calories:379,carbs:67.7,protein:13.2,fat:6.5,portions:[['마른 것 40g',40],['100g',100]]},
{name:'아메리카노',aliases:['커피','아이스아메리카노','아아'],calories:2,carbs:.3,protein:.1,fat:0,portions:[['1잔',350]]},
{name:'카페라떼',aliases:['라떼'],calories:55,carbs:5,protein:3.2,fat:2.5,portions:[['1잔',350],['100ml',100]]},
{name:'콜라',aliases:['탄산음료'],calories:42,carbs:10.6,protein:0,fat:0,portions:[['1캔',355],['100ml',100]]},
{name:'제로콜라',aliases:['제로 콜라','제로음료'],calories:0,carbs:0,protein:0,fat:0,portions:[['1캔',355],['100ml',100]]}
];

function save(){localStorage.setItem('meallog-state',JSON.stringify(state));render()}
function localISO(d=new Date()){let z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`}
function todayKey(){return localISO().slice(0,10)}
function render(){
 let today=state.meals.filter(m=>m.time.slice(0,10)===todayKey()).sort((a,b)=>a.time.localeCompare(b.time));
 let sum=k=>today.flatMap(m=>m.foods).reduce((a,f)=>a+(+f[k]||0),0),cal=Math.round(sum('calories'));
 $('#totalCal').textContent=cal; $('#remainCal').textContent=Math.max(0,state.goal-cal);
 $('#carbs').textContent=Math.round(sum('carbs'));$('#protein').textContent=Math.round(sum('protein'));$('#fat').textContent=Math.round(sum('fat'));
 $('#todayLabel').textContent=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long'}).format(new Date());
 mealsEl.innerHTML=today.length?'':'<div class="empty">아직 기록한 음식이 없어요.<br>아래 버튼으로 첫 식사를 기록해보세요.</div>';
 today.forEach(m=>{
   let c=m.foods.reduce((a,f)=>a+(+f.calories||0),0),names=m.foods.map(f=>f.name).join(', ');
   let el=document.createElement('article');el.className='meal';
   el.innerHTML=`${m.photo?`<img src="${m.photo}">`:'<div>🍽️</div>'}<div><h3>${m.type} · ${new Date(m.time).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</h3><p>${names||'음식 기록'}</p><p><b>${Math.round(c)} kcal</b></p></div><button class="delete">×</button>`;
   el.querySelector('.delete').onclick=()=>{if(confirm('이 기록을 삭제할까요?')){state.meals=state.meals.filter(x=>x.id!==m.id);save()}};
   mealsEl.appendChild(el)
 })
}
function norm(s){return (s||'').toLowerCase().replace(/\s/g,'')}
function findFoods(q){
 q=norm(q); if(!q)return [];
 return FOOD_DB.filter(f=>norm(f.name).includes(q)||(f.aliases||[]).some(a=>norm(a).includes(q))).slice(0,8)
}
function calcRow(row){
 const idx=+row.dataset.dbIndex;
 if(!Number.isInteger(idx)||!FOOD_DB[idx])return;
 const f=FOOD_DB[idx],g=Math.max(0,+row.querySelector('.grams').value||0),r=g/100;
 row.querySelector('.calories').value=Math.round(f.calories*r);
 row.querySelector('.carbs').value=(f.carbs*r).toFixed(1);
 row.querySelector('.protein').value=(f.protein*r).toFixed(1);
 row.querySelector('.fat').value=(f.fat*r).toFixed(1)
}
function chooseFood(row,f){
 const idx=FOOD_DB.indexOf(f); row.dataset.dbIndex=idx;
 row.querySelector('.name').value=f.name;
 const portion=row.querySelector('.portion'); portion.innerHTML='';
 (f.portions||[['100g',100]]).forEach(([n,g])=>{let o=document.createElement('option');o.value=g;o.textContent=`${n} (${g}g)`;portion.appendChild(o)});
 portion.hidden=false; row.querySelector('.dbBadge').hidden=false;
 const g=(f.portions&&f.portions[0]?f.portions[0][1]:100); row.querySelector('.grams').value=g;
 row.querySelector('.suggestions').hidden=true; calcRow(row)
}
function showSuggestions(row,q){
 const box=row.querySelector('.suggestions'),matches=findFoods(q); box.innerHTML='';
 if(!q||!matches.length){box.hidden=true;return}
 matches.forEach(f=>{let b=document.createElement('button');b.type='button';b.className='suggestion';
 b.innerHTML=`<b>${f.name}</b><small>100g 기준 ${f.calories} kcal · 탄 ${f.carbs}g · 단 ${f.protein}g · 지 ${f.fat}g</small>`;
 b.onclick=()=>chooseFood(row,f);box.appendChild(b)});box.hidden=false
}
function addFood(f={}){
 let d=document.createElement('div');d.className='foodRow';
 d.innerHTML=`<button type="button" class="removeFood" title="음식 삭제">×</button>
 <div class="foodTop"><div class="foodNameWrap"><input class="name" placeholder="음식명 검색 (예: 계란, 밥, 블루베리)" autocomplete="off" value="${f.name||''}"><div class="suggestions" hidden></div></div><input class="grams" type="number" min="0" step="1" placeholder="g" value="${f.grams||''}"></div>
 <div class="portionBar"><select class="portion" hidden></select><span class="dbBadge" hidden>무료 DB 자동계산</span></div>
 <div class="nutrition"><input class="calories" type="number" step="0.1" placeholder="kcal" value="${f.calories??''}"><input class="carbs" type="number" step="0.1" placeholder="탄g" value="${f.carbs??''}"><input class="protein" type="number" step="0.1" placeholder="단g" value="${f.protein??''}"><input class="fat" type="number" step="0.1" placeholder="지g" value="${f.fat??''}"></div>`;
 $('#foods').appendChild(d);
 const name=d.querySelector('.name'),grams=d.querySelector('.grams'),portion=d.querySelector('.portion');
 name.oninput=()=>{delete d.dataset.dbIndex;portion.hidden=true;d.querySelector('.dbBadge').hidden=true;showSuggestions(d,name.value)};
 name.onfocus=()=>showSuggestions(d,name.value);
 grams.oninput=()=>calcRow(d);
 portion.onchange=()=>{grams.value=portion.value;calcRow(d)};
 d.querySelector('.removeFood').onclick=()=>{if(document.querySelectorAll('.foodRow').length>1)d.remove();else{name.value='';grams.value='';d.querySelectorAll('.nutrition input').forEach(x=>x.value='');delete d.dataset.dbIndex;portion.hidden=true;d.querySelector('.dbBadge').hidden=true}};
 if(f.name){
   const exact=FOOD_DB.find(x=>norm(x.name)===norm(f.name)||(x.aliases||[]).some(a=>norm(a)===norm(f.name)));
   if(exact&&(!f.calories||f.source==='db'))chooseFood(d,exact)
 }
}
document.addEventListener('click',e=>{if(!e.target.closest('.foodNameWrap'))document.querySelectorAll('.suggestions').forEach(x=>x.hidden=true)});
$('#addBtn').onclick=()=>{photoData='';$('#preview').hidden=true;$('#photoText').hidden=false;$('#photo').value='';$('#mealTime').value=localISO();$('#foods').innerHTML='';addFood();$('#memo').value='';$('#status').textContent='';$('#analyzeBtn').disabled=true;$('#mealDialog').showModal()};
$('#cancelBtn').onclick=()=>$('#mealDialog').close();$('#addFood').onclick=()=>addFood();
$('#photo').onchange=async e=>{let f=e.target.files[0];if(!f)return;photoData=await resize(f,900,.72);$('#preview').src=photoData;$('#preview').hidden=false;$('#photoText').hidden=true;$('#analyzeBtn').disabled=false};
function resize(file,max,q){return new Promise(r=>{let im=new Image(),u=URL.createObjectURL(file);im.onload=()=>{let s=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*s;c.height=im.height*s;c.getContext('2d').drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);r(c.toDataURL('image/jpeg',q))};im.src=u})}
$('#analyzeBtn').onclick=async()=>{
 let b=$('#analyzeBtn');b.disabled=true;$('#status').textContent='AI가 음식을 분석하고 있어요…';
 try{
  let res=await fetch('/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({image:photoData})}),data=await res.json();
  if(!res.ok)throw Error(data.error||'분석 실패');
  $('#foods').innerHTML='';(data.foods||[]).forEach(addFood);
  if(!(data.foods||[]).length)addFood();
  $('#status').textContent='AI 추정 결과예요. 음식과 양을 확인한 뒤 저장하세요.'
 }catch(e){$('#status').textContent=`AI 분석을 사용할 수 없어요: ${e.message} · 아래 무료 음식 검색은 계속 사용할 수 있습니다.`}
 finally{b.disabled=false}
};
$('#mealForm').onsubmit=e=>{
 e.preventDefault();
 let foods=[...document.querySelectorAll('.foodRow')].map(d=>({name:d.querySelector('.name').value||'음식',grams:+d.querySelector('.grams').value||0,calories:+d.querySelector('.calories').value||0,carbs:+d.querySelector('.carbs').value||0,protein:+d.querySelector('.protein').value||0,fat:+d.querySelector('.fat').value||0})).filter(f=>f.name!=='음식'||f.calories||f.grams);
 state.meals.push({id:crypto.randomUUID(),type:$('#mealType').value,time:$('#mealTime').value,photo:photoData,foods,memo:$('#memo').value});save();$('#mealDialog').close()
};
$('#settingsBtn').onclick=()=>{$('#goalInput').value=state.goal;$('#settingsDialog').showModal()};
$('#settingsClose').onclick=()=>$('#settingsDialog').close();
$('#saveSettings').onclick=()=>{state.goal=+$('#goalInput').value||1800;save();$('#settingsDialog').close()};
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js');
render();