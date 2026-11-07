(function(root){
 'use strict';
 const dateKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;const d=new Date(s+'T12:00:00');return Number.isFinite(d.getTime())&&dateKey(d)===s;}
 function mealDate(m){
  if(validDate(m.meal_date))return m.meal_date;
  const time=String(m.time||'');
  if(/(?:Z|[+-]\d{2}:?\d{2})$/.test(time)){const d=new Date(time);return Number.isFinite(d.getTime())?dateKey(d):'';}
  const day=time.slice(0,10);return validDate(day)?day:'';
 }
 function typeKey(meal){const type=String(meal.type??meal.meal_type??'').trim();return ['아침','점심','저녁','간식'].includes(type)?type:'기타';}
 const nutrient=v=>{const n=Number(v);return Number.isFinite(n)&&n>=0?n:0;};
 function calculate(meals,days,endDate){
  if(![7,30].includes(days)||!validDate(endDate))throw Error('Invalid statistics period');
  const base=new Date(endDate+'T12:00:00'),daily=[];
  for(let i=1-days;i<=0;i++){const d=new Date(base);d.setDate(d.getDate()+i);daily.push({date:dateKey(d),meals:0,calories:0,carbs:0,protein:0,fat:0,unknownFoods:0,knownFoods:0});}
  const byDate=new Map(daily.map(d=>[d.date,d])),counts=new Map(),slots=new Map(daily.map(d=>[d.date,new Set()]));
  for(const meal of meals||[]){const day=byDate.get(mealDate(meal));if(!day)continue;const types=slots.get(day.date);types.add(typeKey(meal));day.meals=types.size;
   for(const food of Array.isArray(meal.foods)?meal.foods:[]){
    if(root.MealLogQuality?.unknown(food))day.unknownFoods++;else{day.knownFoods++;for(const key of ['calories','carbs','protein','fat'])day[key]+=nutrient(food[key]);}
    const name=String(food.name||'').trim();if(name)counts.set(name,(counts.get(name)||0)+1);
   }
  }
  const logged=daily.filter(d=>d.meals>0),total={meals:0,calories:0,carbs:0,protein:0,fat:0};
  for(const day of daily)for(const key of Object.keys(total))total[key]+=day[key];
  const complete=logged.filter(d=>!d.unknownFoods),unknownFoods=daily.reduce((n,d)=>n+d.unknownFoods,0);const average=Object.fromEntries(['calories','carbs','protein','fat'].map(k=>[k,complete.length?complete.reduce((n,d)=>n+d[k],0)/complete.length:0]));
  return {daily,total,average,unknownFoods,completeDays:complete.length,loggedDays:logged.length,startDate:daily[0].date,endDate,topFoods:[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ko')).slice(0,5)};
 }
 root.MealLogStats={calculate,typeKey};if(typeof module==='object'&&module.exports)module.exports=root.MealLogStats;
})(typeof globalThis!=='undefined'?globalThis:this);
