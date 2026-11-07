(function(root){'use strict';
 let selected=null;
 const fmt=n=>Math.round(Number(n)||0).toLocaleString('ko-KR');
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
 function render({container,details,days,goal,onOpen}){
  const priorScroll=container.querySelector('.trendScroller')?.scrollLeft;
  container.replaceChildren();details.replaceChildren();if(!days.length)return;
  if(!days.some(d=>d.date===selected))selected=([...days].reverse().find(d=>d.meals)||days.at(-1)).date;
  const ceiling=Math.max(goal,...days.map(d=>d.calories),1),legend=node('div',undefined,'trendLegend');legend.append(node('span','● 섭취 칼로리'),node('span','┄ 목표 '+fmt(goal)+' kcal','trendGoalKey'));container.append(legend);
  const scroller=node('div',undefined,'trendScroller'+(days.length>7?' manyDays':''));scroller.setAttribute('role','region');scroller.setAttribute('aria-label',days.length>7?'날짜별 칼로리, 좌우로 이동해 모든 날짜 확인':'날짜별 칼로리');
  const plot=node('div',undefined,'trendPlot');plot.style.gridTemplateColumns='repeat('+days.length+',minmax(0,1fr))';if(days.length>7)plot.style.minWidth=days.length*48+'px';
  const line=node('div',undefined,'trendGoalLine');line.style.bottom=(40+goal/ceiling*160)+'px';line.setAttribute('aria-hidden','true');plot.append(line);
  const buttons=[];
  function select(date){selected=date;for(const b of buttons)b.setAttribute('aria-pressed',String(b.dataset.date===date));details.replaceChildren();const d=days.find(d=>d.date===date),label=node('span',d.date.slice(5).replace('-','/')+' '+new Date(d.date+'T12:00').toLocaleDateString('ko-KR',{weekday:'long'})),value=node('strong',d.unknownFoods?(d.knownFoods?'확인된 '+fmt(d.calories):'영양 미입력'):d.meals?fmt(d.calories):'미기록');if(d.meals&&(!d.unknownFoods||d.knownFoods))value.append(node('small',' kcal'));details.append(label,value);
   const difference=Math.round(d.calories-goal);details.append(node('p',d.unknownFoods?'영양 미입력 '+d.unknownFoods+'개는 합계·목표 비교에서 제외해요.':!d.meals?'기록 없음은 0 kcal와 구분해요.':difference>0?'목표보다 '+fmt(difference)+' kcal 많아요.':difference===0?'설정한 목표와 같아요.':'목표까지 '+fmt(-difference)+' kcal 남았어요.'));
   const open=node('button','이날 기록 보기','trendOpen');open.type='button';open.onclick=()=>onOpen(date);details.append(open);
  }
  for(const d of days){const b=node('button',undefined,'trendColumn');b.type='button';b.dataset.date=d.date;b.setAttribute('aria-label',d.date+' · '+(d.meals?fmt(d.calories)+' kcal · 식사 '+d.meals+'회':'기록 없음'));const height=Math.max(0,d.calories)/ceiling*160,value=node('span',d.unknownFoods?(d.knownFoods?fmt(d.calories)+'*':'미입력'):d.meals?fmt(d.calories):'—','trendValue');value.style.bottom=(48+height)+'px';
   const mark=node('span',undefined,d.calories?'trendBar'+(d.calories>goal?' over':''):'trendZero');if(d.calories)mark.style.height=height+'px';const label=node('span',undefined,'trendDate');label.append(node('b',new Date(d.date+'T12:00').toLocaleDateString('ko-KR',{weekday:'short'})),node('small',Number(d.date.slice(8))));b.append(value,mark,label);b.onclick=()=>select(d.date);buttons.push(b);plot.append(b);
  }
  scroller.append(plot);container.append(scroller);if(days.length>7)container.append(node('small','좌우로 밀어 날짜별 숫자를 확인해 주세요.','trendScrollHint'));select(selected);if(days.length>7)scroller.scrollLeft=priorScroll??scroller.scrollWidth;
 }
 root.MealLogCalorieTrend={render};
})(typeof window==='object'?window:globalThis);
