(function(root){'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x)), nutrients=['calories','carbs','protein','fat'];
 const key=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
 function scaled(food,amount){
  const base=Number(food.grams),next=Number(amount);
  if(!Number.isFinite(base)||base<=0||!Number.isFinite(next)||next<=0||next>100000)throw Error('섭취량과 영양 기준을 확인해 주세요.');
  const out=clone(food);out.grams=next;if(food.nutritionStatus==='unknown'){for(const n of nutrients)out[n]=null;return out;}
  for(const n of nutrients){const v=Number(food[n]);if(food[n]==null||!Number.isFinite(v)||v<0)throw Error('영양정보가 부족해요. 기존 기록 화면에서 먼저 확인해 주세요.');out[n]=Math.round(v*next/base*10000)/10000;}
  return out;
 }
 function foodUnit(food){const explicit=food.unit||food.nutritionUnit||food.barcodeProduct?.unit||food.barcodeProduct?.nutritionUnit;if(explicit)return String(explicit).toLowerCase()==='ml'?'mL':explicit;return food.portions?.some(([label,amount])=>/^100\s*ml$/i.test(String(label).trim())&&Number(amount)===100)?'mL':'g';}
 function portionOptions(food,source){const options=[],seen=new Set(),unit=foodUnit(food);if(!['g','mL'].includes(unit))return options;function add(label,value){const amount=Number(value);if(!Number.isFinite(amount)||amount<.001||amount>100000||seen.has(amount))return;seen.add(amount);options.push({label,amount,unit});}if(source&&foodUnit(source)===unit)for(const [label,value] of source.portions||[])add(label,value);const product=food.barcodeProduct;if(product?.packageAmountKnown===true&&(product.unit||product.nutritionUnit)&&foodUnit(product)===unit){add('한 팩',product.productAmount);add('반 팩',Number(product.productAmount)/2);}add('기준 양',food.grams);add('기준 양의 절반',Number(food.grams)/2);return options.slice(0,12);}
 function mealTimes(rows,owner,day,type){const format=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}),times=new Set();for(const row of rows){if(row.user_id!==owner||row.meal_date!==day||row.meal_type!==type||!row.meal_time)continue;const date=new Date(row.meal_time);if(Number.isNaN(date.getTime()))continue;const time=format.format(date);if(/^\d{2}:\d{2}$/.test(time))times.add(time);}return [...times].sort();}
 function amount(text,food,db=[]){
  text=String(text).normalize('NFKC').replace(/⁄/g,'/');
  if(/(?:^|[^d])[-−]s*(?:d|.)|마이너스/.test(text))throw Error('섭취량은 양수로 입력해 주세요.');
  const unit=foodUnit(food);
  const number='(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
  const pattern=new RegExp('('+number+'(?:\\s*/\\s*'+number+')?|반|한|두|세)\\s*(kg|ml|g|줄|개|봉지|봉|공기|잔|팩|조각|인분)','gi');
  const tokens=[...text.matchAll(pattern)];
  if(tokens.length>1||(tokens.length&&/반만|절반/.test(text)))throw Error('변경할 섭취량을 하나만 알려 주세요. 예: 김밥 반 줄로 바꿔줘');
  if(!tokens.length)return /반만|절반/.test(text)?Number(food.grams)/2:null;
  const token=tokens[0],raw=token[1].replace(/s+/g,''),parts=raw.split('/');
  const count=({반:.5,한:1,두:2,세:3})[raw]??(parts.length===2?Number(parts[0])/Number(parts[1]):Number(raw));
  if(!Number.isFinite(count)||count<=0)throw Error('섭취량과 분모는 0보다 커야 해요.');
  const target=token[2].toLowerCase();
  if(['kg','g','ml'].includes(target)){let n=count,u=target;if(u==='kg'){n*=1000;u='g';}if(unit==='kg'&&u==='g')return n/1000;if(u!==unit.toLowerCase())throw Error('단위가 달라요. 이 후보는 '+unit+' 기준이에요. '+(u==='ml'?'mL':u)+' 기준 후보를 선택하거나 제품 영양정보를 직접 입력해 주세요.');return n;}
  let grams;const source=db.find(f=>key(f.name)===key(food.name));
  const portion=source?.portions?.find(([label])=>key(label)===key('1'+target));
  if(portion&&foodUnit(source)===unit&&['g','mL'].includes(unit))grams=Number(portion[1]);
  if(!grams&&['봉지','봉','팩'].includes(target)&&food.barcodeProduct){if(food.barcodeProduct.packageAmountKnown!==true)throw Error('이 제품의 포장당 양을 확인하지 못했어요. g 또는 mL로 입력해 주세요.');const product=food.barcodeProduct;if((product.unit||'g')===unit)grams=Number(product.productAmount||product.displayAmount);}
  if(!grams)throw Error('이 음식의 '+target+'당 양을 몰라요. g 또는 mL로 알려 주세요.');return count*grams;
 }
 function intent(text){if(/바꿔|변경|수정|줄여|반만|절반/.test(text))return 'edit';if(/오늘도|또 먹|다시 먹/.test(text))return 'repeat';if(/먹었|추가|기록/.test(text))return 'add';return 'unknown';}
 function dayOffset(day,offset){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);}
 function candidates(text,rows,today,selected){const kind=intent(text),day=/어제/.test(text)?dayOffset(today,-1):/오늘/.test(text)?today:selected;
  const all=rows.filter(r=>r.meal_date===day).flatMap(r=>(r.foods||[]).map((food,index)=>({row:r,food,index})));
  const matches=all.filter(x=>[x.food.name,x.food.barcodeProduct?.maker].filter(Boolean).some(n=>key(text).includes(key(n))||key(n).includes(key(text.replace(/어제|오늘도|오늘|먹은|먹었어|바꿔줘|로|반|한|줄|\s/g,'')))));
  return {kind,day,items:matches.length?matches:all};
 }
 function suggestion(memory){return '이전에 승인한 양 '+memory.food.grams+(memory.food.unit||'g')+' · 이번에도 이 양인가요?';}
 root.MealLogFoodCore={scaled,foodUnit,portionOptions,mealTimes,amount,intent,dayOffset,candidates,suggestion,key,nutrients};
 if(typeof module==='object'&&module.exports)module.exports=root.MealLogFoodCore;
})(typeof window==='object'?window:globalThis);
