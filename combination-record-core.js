(function(root){
 'use strict';
 const nutrients=['calories','carbs','protein','fat'],clone=x=>JSON.parse(JSON.stringify(x));
 const key=x=>String(x??'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
 const number=v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&Number.isFinite(Number(v));
 function positive(v,max=100000){if(!number(v)||Number(v)<=0||Number(v)>max)throw Error('양을 0보다 큰 숫자로 입력해 주세요.');return Number(v);}
 function optional(v,max){return v==null||typeof v==='string'&&!v.trim()?null:positive(v,max);}
 function basis(combo,mode,amount){const quantity=positive(amount);let denominator=1;
  if(mode==='servings'){if(combo.yield_servings==null)throw Error('조합 전체가 몇 인분인지 먼저 저장해 주세요.');denominator=positive(combo.yield_servings,1000);}
  else if(mode==='weight'){if(combo.cooked_weight==null)throw Error('조리한 음식 전체의 완성 무게를 먼저 저장해 주세요.');denominator=positive(combo.cooked_weight);}
  else if(mode!=='whole')throw Error('계산 기준을 선택해 주세요.');
  const ratio=quantity/denominator;if(ratio>100)throw Error('한 번에 조합 전체의 100배까지만 기록할 수 있어요.');return {mode,quantity,denominator,ratio};
 }
 function scale(food,amount){const base=positive(food.grams),grams=positive(amount);if(grams<.001)throw Error('음식 양은 0.001 이상이어야 해요.');const out=clone(food);out.grams=Math.round(grams*10000)/10000;
  for(const k of nutrients){if(food.nutritionStatus==='unknown'){out[k]=null;continue;}if(!number(food[k])||Number(food[k])<0)throw Error('이 음식의 영양정보를 먼저 확인해 주세요.');out[k]=Math.round(Number(food[k])*out.grams/base*10000)/10000;if(out[k]>1000000)throw Error('계산된 영양값이 너무 커요. 양을 다시 확인해 주세요.');}return out;
 }
 function calculate(combo,mode='whole',amount=1,overrides=[]){if(!Array.isArray(combo.foods)||!combo.foods.length||combo.foods.length>8)throw Error('조합의 음식을 확인해 주세요.');const calculation=basis(combo,mode,amount),seen=new Set();
  for(const o of overrides){if(!Number.isInteger(o.index)||o.index<0||o.index>=combo.foods.length||seen.has(o.index))throw Error('변경할 음식이 겹치거나 없어요.');seen.add(o.index);if(o.excluded!==true)positive(o.amount);}
  const foods=combo.foods.flatMap((f,index)=>{const o=overrides.find(x=>x.index===index);return o?.excluded?[]:[scale(f,o?o.amount:Number(f.grams)*calculation.ratio)];});if(!foods.length)throw Error('한 가지 이상의 음식을 남겨 주세요.');
  return {...calculation,foods,totals:Object.fromEntries(nutrients.map(k=>[k,foods.some(f=>f[k]==null)?null:Math.round(foods.reduce((n,f)=>n+f[k],0)*10)/10]))};
 }
 function identity(f,brand){return [key(f.name),key(brand??f.manualBrand??f.barcodeProduct?.maker),f.unit||'g'].join('|');}
 function portions(food,memories,owner){return memories.filter(m=>m.user_id===owner&&m.approved_at&&m.portion_label?.trim()&&identity(m.food,m.brand)===identity(food)&&number(m.food.grams)&&Number(m.food.grams)>0).sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));}
 function description(c){const percent=Math.round(c.ratio*10000)/100;return c.mode==='servings'?c.quantity+'인분 / 전체 '+c.denominator+'인분 · '+percent+'%':c.mode==='weight'?c.quantity+'g / 완성 전체 '+c.denominator+'g · '+percent+'%':'저장된 조합 전체의 '+percent+'%';}
 function sameFood(a,b){return ['name','grams','unit','manualBrand','nutritionStatus',...nutrients].every(k=>(a?.[k]??null)===(b?.[k]??null));}
 root.MealLogCombinationCore={nutrients,positive,optional,basis,scale,calculate,identity,portions,description,key,sameFood};
})(typeof globalThis!=='undefined'?globalThis:this);
