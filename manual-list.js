/* Conservative local list parsing: preserve every explicit comma item; never guess nutrition. */
(()=>{'use strict';
 const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 function parseItem(chunk){chunk=String(chunk).normalize('NFKC');if(/[-−]\s*(?:\d|\.)|마이너스/.test(chunk))throw Error('음식 양은 양수로 입력해 주세요.');let q=chunk.replace(/(?:이랑|와|과|랑|하고)\s*$/,'').trim(),value=null,unit='unknown';
   const size=q.match(/(작은|중간|큰|소|중|대)\s*(컵|잔|사이즈)\s*$/);const portion_label=size?size[0].trim():'';if(size)q=q.slice(0,size.index).trim();
   const quantity=q.match(/(반|한|두|세|(?:\d+(?:\.\d+)?|\.\d+)(?:\s*\/\s*\d+(?:\.\d+)?)?)\s*(kg|g|mL|줄|개|봉지|봉|공기|잔|팩|조각|인분)\s*$/i);
   const count=q.match(/(?:\s|^)(하나|둘|셋)\s*$/);
   if(quantity){const token=quantity[1].replace(/\s/g,''),parts=token.split('/');value=({반:.5,한:1,두:2,세:3})[token]??(parts.length===2?Number(parts[0])/Number(parts[1]):Number(token));unit=quantity[2].toLowerCase()==='ml'?'mL':quantity[2].toLowerCase();q=q.slice(0,quantity.index).trim();}
   else if(count){value=({하나:1,둘:2,셋:3})[count[1]];unit='개';q=q.slice(0,count.index).trim();}
   if(!q||q.length>150)throw Error('각 음식의 이름을 쉼표로 구분해 알려 주세요.');if(value!==null&&(!Number.isFinite(value)||value<=0||value>100000))throw Error('음식 양을 확인해 주세요.');
   return{food_query:q,quantity_value:value,quantity_unit:unit,portion_label};
 }
 function parse(text,db,selectedDay,today){
  if(/바꿔|수정|변경|줄여|반만|절반|오늘도|또 먹|다시 먹/.test(text))return null;
  const raw=String(text).normalize('NFKC').trim();
  let body=raw.replace(/^(?:오늘|어제)\s*/,'').replace(/^(?:아침|점심|저녁|간식)(?:으로|에|은|는)?\s*/,'').replace(/\s*(?:먹었어(?:요)?|먹었다|먹음|추가해줘|기록해줘)[.!?]?$/,'').replace(/[을를]\s*$/,'').trim();
  const names=[...new Set(db.flatMap(f=>[f.name,...(f.aliases||[])]).filter(Boolean))];
  const following=names.map(n=>Array.from(n.replace(/\s/g,'')).map(escape).join('\\s*')).join('|');
  const connectors=new RegExp('(?:이랑|하고|랑)(?=\\s'+(following?'|'+following:'')+')|\\s+(?:와|과)\\s+','g');
  let chunks=body.replace(connectors,',').split(/[,，、;；\n]+|\s*그리고\s*/).map(x=>x.trim()).filter(Boolean);
  if(chunks.length<2){
   const terms=[...new Set(db.flatMap(f=>[f.name,...(f.aliases||[])]).filter(Boolean).map(x=>x.replace(/\s+/g,'' )).filter(x=>x.length>=2))],matches=[];
   for(const term of terms){const re=new RegExp(Array.from(term).map(escape).join('\\s*'),'gi');for(const m of body.matchAll(re))matches.push({start:m.index,end:m.index+m[0].length});}
   matches.sort((a,b)=>a.start-b.start||(b.end-b.start)-(a.end-a.start));const chosen=[];let end=-1;
   for(const m of matches)if(m.start>=end){chosen.push(m);end=m.end;}
   if(chosen.length<2)return null;
   const prefix=body.slice(0,chosen[0].start).trim();if(prefix&&!/^(?:맥도날드|버거킹|롯데리아|맘스터치|노브랜드|서브웨이|KFC)[가-힣a-z\s]{0,20}$/i.test(prefix))return null;
   const gap=/^\s*(?:(?:하나|둘|셋|반|한|두|세|\d+(?:[./]\d+)?)(?:\s*(?:개|줄|kg|g|mL|봉지|봉|팩|잔|공기|조각|인분))?)?\s*(?:이랑|와|과|랑|하고)?\s*$/i;
   for(let i=0;i<chosen.length;i++){const tail=body.slice(chosen[i].end,chosen[i+1]?.start??body.length);if(!gap.test(tail))return null;}
   chunks=chosen.map((m,i)=>body.slice(i?m.start:0,chosen[i+1]?.start??body.length).trim());
  }
  if(chunks.length>8)throw Error('한 식사에는 최대 8개 음식을 나누어 확인해 주세요.');
  if(chunks.length<2)return null;
  const items=chunks.map(parseItem);
  const day=MealLogFoodCore.candidates(raw,[],today,selectedDay).day,type=raw.match(/(?:^|\s|오늘|어제)(아침|점심|저녁|간식)(?=으로|에|은|는|\s|$)/)?.[1]||null;
  return{intent:'add',food_query:items[0].food_query,quantity_value:items[0].quantity_value,quantity_unit:items[0].quantity_unit,source_date:null,target_date:day,source_meal_type:null,target_meal_type:type,items,reply:'입력한 음식 목록이에요. 각 음식과 양을 직접 확인해 주세요.'};
 }
 window.MealLogManualList={parse,parseItem};
})();
