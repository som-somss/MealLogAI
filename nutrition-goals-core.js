(function(root){
 'use strict';
 const fields=[{key:'carbs',label:'탄수화물',max:1000},{key:'protein',label:'단백질',max:500},{key:'fat',label:'지방',max:500}];
 const valid=v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&Number.isFinite(Number(v))&&Number(v)>=0;
 const round=n=>Math.round((n+Number.EPSILON)*10)/10;
 function goals(row={}){return Object.fromEntries(fields.map(({key,max})=>{const v=row?.[key+'_goal'];return [key,valid(v)&&Number(v)>0&&Number(v)<=max?Number(v):null];}));}
 function payload(values){return Object.fromEntries(fields.map(({key,label,max})=>{const v=values[key];if(v==null||typeof v==='string'&&!v.trim())return [key+'_goal',null];if(!valid(v)||Number(v)<=0||Number(v)>max)throw Error(label+' 목표는 0보다 크고 '+max+'g 이하로 입력해 주세요.');return [key+'_goal',Number(v)];}));}
 function summarize(foods,targets={}){
  return fields.map(({key,label})=>{
   let consumed=0,missing=0;
   for(const food of foods||[]){if(food?.nutritionStatus==='unknown'||!valid(food?.[key]))missing++;else consumed+=Number(food[key]);}
   consumed=round(consumed);const goal=targets[key]??null;
   const comparable=goal>0&&!missing;
   return {key,label,consumed,goal,missing,remaining:comparable?round(Math.max(0,goal-consumed)):null,over:comparable?round(Math.max(0,consumed-goal)):null,percent:comparable?round(consumed/goal*100):null};
  });
 }
 root.MealLogNutritionCore={fields,goals,payload,summarize};
})(typeof globalThis!=='undefined'?globalThis:this);
