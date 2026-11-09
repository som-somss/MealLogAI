import {koreaDay,validDay} from './coach-core.js';
import './combination-record-core.js';

const C=globalThis.MealLogCombinationCore;
const compact=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[\s“”‘’"']/g,'');
const ending=/(?:기록|저장|등록)(?:해(?:줘요?|주세요|줄래요?|주실래요?)?|하자|부탁해요?)[.!?。！？]*$/;
const help=reply=>({reply:reply+' 아직 식사로 저장하지 않았어요.',mode:'내 조합 기록 안내',warnings:[],evidence:[],suggestions:[],combination_record:{status:'needs_details'}});

// This route prepares a draft only. Neither model output nor a loose food match
// can create a meal. The existing record dialog performs the confirmed RPC.
export function recordRequest(question,selectedDate,today=koreaDay()){
 const text=compact(question);
 if(!/(?:기록|저장|등록)(?:해|하자|부탁)/.test(text))return null;
 // Preserve the existing "오늘 점심을 이름으로 기억/저장" direction.
 if(/기억(?:해|하자)/.test(text))return null;
 if(!/기록(?:해|하자|부탁)/.test(text)&&!/(?:내조합|저장한|저장된|저장해둔)/.test(text))return null;
 if(/하지마|하지는마|말고|하지않|안(?:해|하)|취소|나중에|다음에|만약|한다면|하면|방법|어떻게|할까|해도/.test(text)||!ending.test(text))return help('조합을 실제로 기록하려면 “저장한 시오콘부볶음밥을 오늘 점심으로 기록해줘”처럼 알려 주세요.');
 return {text:text.replace(ending,''),selectedDate,today};
}

export function resolveRecord(intent,combos,requestId){
 if(intent.reply)return intent;
 if(!Array.isArray(combos)||combos.length>500)return help('조합 목록을 정확히 확인하지 못했어요. 홈의 내 조합 다시 기록하기에서 선택해 주세요.');
 const found=combos.filter(c=>c.approved_at&&compact(c.name)&&intent.text.includes(compact(c.name)));
 // A full name wins over a shorter name contained entirely inside it, but
 // equal names and two independent named recipes always need clarification.
 const matches=found.filter(c=>!found.some(other=>compact(other.name)!==compact(c.name)&&compact(other.name).includes(compact(c.name))));
 if(matches.length!==1)return help(matches.length?'같은 이름이거나 여러 조합이 함께 언급됐어요. 홈의 내 조합 다시 기록하기에서 하나를 선택해 주세요.':'저장한 조합 이름을 찾지 못했어요. 내 조합의 정확한 이름과 끼니를 알려 주세요.');
 const combo=matches[0];let rest=intent.text.replace(compact(combo.name),'');
 const explicit=rest.match(/\d{4}-\d{1,2}-\d{1,2}/g)||[],relative=rest.match(/오늘|어제/g)||[],types=rest.match(/아침|점심|저녁|간식/g)||[];
 if(explicit.length+relative.length>1||types.length!==1||/내일|모레|그제|\d+월|\d+일전|지난주/.test(rest))return help('날짜 하나와 끼니 하나를 지정해 주세요. 예: “시오콘부볶음밥을 오늘 점심으로 기록해줘”.');
 const day=explicit[0]||(relative[0]==='오늘'?intent.today:relative[0]==='어제'?new Date(Date.parse(intent.today)-86400000).toISOString().slice(0,10):intent.selectedDate);
 if(!validDay(day)||day<'2000-01-01'||day>intent.today)return help('기록할 날짜를 오늘 또는 과거의 날짜로 확인해 주세요.');
 rest=rest.replace(explicit[0]||relative[0]||'\0','').replace(types[0],'');
 let mode='whole',quantity=1;
 const amounts=[...rest.matchAll(/(?:\d+(?:\.\d+)?(?:인분|그램|g|배|%)|1\/2|1\/4|절반|반만|반인분|한인분|두인분)/g)];
 if(amounts.length>1)return help('먹은 양의 기준을 하나만 알려 주세요. 재료별 양과 개인 분량은 확인 화면에서 바꿀 수 있어요.');
 if(amounts.length){const token=amounts[0][0];rest=rest.replace(token,'');
  if(['절반','반만','1/2'].includes(token))quantity=.5;
  else if(token==='1/4')quantity=.25;
  else if(/인분$/.test(token)){mode='servings';quantity=({'반인분':.5,'한인분':1,'두인분':2})[token]??Number(token.replace('인분',''));}
  else if(/(?:그램|g)$/.test(token)){mode='weight';quantity=Number(token.replace(/그램|g/,''));}
  else quantity=Number(token.replace(/배|%/,''))/(token.endsWith('%')?100:1);
 }
 // Consume only known connective words. Never silently drop an ingredient
 // edit, a second date, "안 먹었어", or another unparsed condition.
 rest=rest.replace(/저장해둔|저장된|저장한|내조합|지난번|전체|그대로|다시|으로|에서|만큼|먹은|먹었어|먹었어요|먹었으니|먹고|을|를|에|은|는|로|만|[,，.!]/g,'');
 if(rest)return help('조합 이름·날짜·끼니·전체 양을 따로 알려 주세요. 예: “시오콘부볶음밥 0.5인분을 오늘 점심으로 기록해줘”. 밥만 반으로 줄이거나 개인 분량을 쓰려면 확인 화면에서 재료별로 선택해 주세요.');
 let calculation;try{calculation=C.calculate(combo,mode,quantity);}catch(e){return help(e.message+' 홈의 내 조합 다시 기록하기에서 기준을 먼저 확인해 주세요.');}
 const draft={version:1,request_id:requestId,combination_id:combo.id,revision:combo.revision,day,meal_type:types[0],mode,quantity};
 return {reply:combo.name+'을 '+day+' '+types[0]+'으로 기록할 초안을 준비했어요.\n'+C.description(calculation)+'\n아직 식사로 저장하지 않았어요. 아래에서 음식과 개인 분량을 확인한 뒤 저장해 주세요.',mode:'내 조합 기록 초안',warnings:[],evidence:['계정에 저장한 조합과 확인된 전체 분량으로 계산했어요. 기본 조합과 과거 기록은 유지돼요.'],suggestions:[],combination_record:{status:'ready',name:combo.name,draft}};
}
