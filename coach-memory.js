import {koreaDay, validDay} from './coach-core.js';

// Only an explicit request may cause a write. Model output never supplies a
// name, a source meal, ingredients, or consent for this operation.
export function memoryRequest(question, selectedDate, today = koreaDay()) {
  const text = question.normalize('NFKC').trim();
  const mentionsAction = /(?:기억|저장|등록)\s*(?:해|하|부탁)/.test(text);
  if (!mentionsAction) return null;
  const help = {reply: '기록한 식사를 내 조합으로 저장할 수 있어요. 날짜·끼니·이름을 함께 알려 주세요. 예: “오늘 점심을 시오콘부볶음밥으로 기억해줘”. 아직 저장하지 않았어요.'};
  if (/(?:하지|하지는)\s*마|말고|안\s*(?:해|하)|하지\s*않|취소|나중에|다음에|만약|한다면|하면|방법|어떻게/.test(text)) {
    return {reply: '아직 조합을 저장하지 않았어요. 저장하려면 “오늘 점심을 시오콘부볶음밥으로 기억해줘”처럼 날짜·끼니·이름을 알려 주세요.'};
  }
  const command = text.match(/(?:기억|저장|등록)\s*(?:해\s*(?:줘요?|주세요|줄래요?|주실래요?|주십시오)|해|하자|부탁해요?)[.!?。！？\s]*$/);
  if (!command) return help;
  const prefix = text.slice(0, command.index).trim();
  if (/추천|제안|빼고|제외|추가해서|절반|반만|두\s*배|\d+\s*(?:g|그램|인분)/i.test(prefix)) return help;
  const naming = prefix.match(/^(.*?)(?:이?라고|(?:이)?라는\s*이름으로|(?:으)?로)\s*$/);
  if (!naming) return help;
  let subject = naming[1].trim(), name, source;
  const quoted = subject.match(/[“‘"']([^“”‘’"']+)[”’"']$/);
  if (quoted) {
    name = quoted[1].trim();
    source = subject.slice(0, quoted.index);
  } else {
    const boundaries = [...subject.matchAll(/(?:조합해서|묶어서|합쳐서|(?:저장한|기록한)\s*(?:음식들?|식사|거|것)(?:들)?(?:을|를)?|(?:아침|점심|저녁|간식)(?:으로|을|를|도|은|는)?|(?:이|그)\s*식사(?:를|는)?|방금\s*(?:기록한\s*거|저장한\s*거))\s*/g)];
    const boundary = boundaries.at(-1);
    if (!boundary) return help;
    const end = boundary.index + boundary[0].length;
    source = subject.slice(0, end);
    name = subject.slice(end).trim();
  }
  name = name.replace(/^(?:이름을|이름은)\s*/, '').trim();
  if (/^(?:에서|중(?:에서)?|먹은|음식들을?|식사를?)\s/.test(name) || /(?:만|을|를)\s/.test(name)) return help;
  if (!name || name.length > 80 || /[\n\r<>]|(?:기억|저장|등록|추천)\s*(?:해|하)|(?:라고|으로)\s/.test(name)) return help;
  // Recommended menus, hypothetical meals and changes in quantity are not
  // recorded meals. Ask instead of silently copying or inventing their foods.
  if (/추천|제안|먹을|먹고\s*싶|빼|제외|추가|절반|반만|두\s*배|\d+\s*(?:g|그램|인분)/i.test(source)) return help;
  const dates = source.match(/\d{4}-\d{1,2}-\d{1,2}/g) || [];
  const relative = [...new Set(source.match(/오늘|어제/g) || [])];
  if (dates.length > 1 || relative.length > 1 || (dates.length && relative.length) || /그제|지난|내일|모레|\d+월|\d+일\s*전/.test(source)) return help;
  const day = dates[0] || (relative[0] === '어제' ? new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10) : relative[0] === '오늘' ? today : selectedDate);
  if (!validDay(day) || day > today || day < '2000-01-01') return help;
  const types = [...new Set(source.match(/아침|점심|저녁|간식/g) || [])];
  if (types.length > 1) return help;
  const latest = /방금|마지막|최근에/.test(source);
  if (!types.length && !latest) return help;
  return {day, mealType: types[0] || null, latest, name};
}

export function memoryHelp(reply) {
  return {reply, mode: '기억 저장 안내', warnings: [], evidence: [], suggestions: [], memory_save: {status: 'needs_details'}};
}
