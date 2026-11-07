import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {memoryRequest} from '../coach-memory.js';
import {makeHandler} from '../api/ai-coach.js';
import {koreaDay} from '../coach-core.js';

const day = koreaDay();
test('remembers the actual lunch under the requested name across common Korean phrases', () => {
  for (const question of [
    '점심으로 저장한 음식들을 조합해서 시오콘부볶음밥이라고 기억해줘',
    '오늘 점심을 시오콘부볶음밥으로 저장해줘.',
    '오늘 점심도 시오콘부볶음밥으로 기억해 주세요',
    '오늘 점심을 “시오콘부 볶음밥”이라는 이름으로 기억해줘'
  ]) {
    const result = memoryRequest(question, day);
    assert.equal(result.day, day);
    assert.equal(result.mealType, '점심');
    assert.equal(result.name.replaceAll(' ', ''), '시오콘부볶음밥');
    assert.equal(result.reply, undefined);
  }
  const latest = memoryRequest('방금기록한거 시오콘부볶음밥이라고 기억해줘', day);
  assert.equal(latest.latest, true);
  assert.equal(latest.mealType, null);
});

test('uses selected, explicit and relative dates without guessing a different meal', () => {
  assert.equal(memoryRequest('점심을 볶음밥으로 기억해줘', '2026-10-01', '2026-11-07').day, '2026-10-01');
  assert.equal(memoryRequest('어제 점심을 볶음밥으로 기억해줘', '2026-10-01', '2026-11-07').day, '2026-11-06');
  assert.equal(memoryRequest('2026-10-03 점심을 볶음밥으로 기억해줘', day).day, '2026-10-03');
  assert.equal(memoryRequest('오늘 점심을 볶음밥으로 기억해줘', '2026-10-01', '2026-11-07').day, '2026-11-07');
});

test('asks instead of writing on ambiguous, hypothetical, negated or unrecorded requests', () => {
  for (const question of [
    '오늘 점심 기억해줘', '시오콘부볶음밥으로 기억해줘',
    '오늘 점심을 볶음밥으로 저장하지 마', '오늘 점심을 볶음밥으로 기억해줄 수 있어?',
    '내일 점심을 볶음밥으로 기억해줘', '오늘 어제 점심을 볶음밥으로 기억해줘',
    '오늘 아침과 점심을 볶음밥으로 기억해줘',
    '추천한 점심을 볶음밥으로 기억해줘', '오늘 점심에서 마요네즈 빼고 볶음밥으로 기억해줘',
    '오늘 점심 반만 볶음밥으로 기억해줘', '나중에 오늘 점심을 볶음밥으로 저장해줘',
    '내가 우유 알레르기가 있다는 걸 기억해줘'
  ]) assert.ok(memoryRequest(question, day)?.reply, question);
  assert.equal(memoryRequest('내 기억에서 음식 추천해줘', day), null);
  assert.equal(memoryRequest('과메기 100g 먹으면?', day), null);
});

function fixture({fail = false, generation = null} = {}) {
  const user = randomUUID(), conversation = randomUUID(), calls = [], saved = new Map();
  const handler = makeHandler(async (url, options) => {
    const path = new URL(url).pathname, body = options.body && JSON.parse(options.body);
    calls.push({path, body});
    assert.equal(options.headers.Authorization, 'Bearer test-session');
    if (path === '/auth/v1/user') return Response.json({id:user});
    if (path === '/rest/v1/ai_coach_messages') {
      const id = new URL(url).searchParams.get('request_id').slice(3);
      return Response.json(saved.has(id) ? [saved.get(id)] : []);
    }
    if (path.endsWith('/meallog_coach_remember')) {
      if (generation) assert.equal(options.headers['x-meallog-generation'],generation);
      if (fail) return Response.json({}, {status:503});
      assert.equal(body.p_name, '시오콘부볶음밥');
      assert.equal(body.p_meal_type, '점심');
      assert.equal(body.p_day, day);
      assert.equal(body.foods, undefined);
      assert.equal(body.user_id, undefined);
      const result = {reply:'“시오콘부볶음밥”을 내 조합으로 저장했어요.', mode:'기억 저장', memory_save:{status:'saved',combination_id:randomUUID()}, suggestions:[]};
      saved.set(body.p_request, {conversation_id:conversation, content:result.reply, metadata:result});
      return Response.json({ok:true, conversation_id:conversation, ...result});
    }
    if (path.endsWith('/meallog_coach_save')) return Response.json(conversation);
    throw Error('Unexpected request: ' + path);
  }, {OPENAI_API_KEY:'not-used'});
  async function ask(message, request_id = randomUUID()) {
    const res = {statusCode:200, setHeader(){}, status(n){this.statusCode=n;return this;}, json(data){this.data=data;}};
    await handler({method:'POST',headers:{authorization:'Bearer test-session',...(generation?{'x-meallog-generation':generation}:{})},body:{message,request_id,selected_date:day}},res);
    return res;
  }
  return {ask,calls};
}

test('API saves with personal memory or external AI disabled and replays without another write', async () => {
  const {ask,calls} = fixture(), request = randomUUID();
  const result = await ask('오늘 점심을 시오콘부볶음밥으로 기억해줘', request);
  assert.equal(result.statusCode,200);
  assert.equal(result.data.memory_save.status,'saved');
  assert.deepEqual((await ask('오늘 점심을 시오콘부볶음밥으로 기억해줘',request)).data,result.data);
  assert.equal(calls.filter(c=>c.path.endsWith('/meallog_coach_remember')).length,1);
  assert.equal(calls.filter(c=>c.path.endsWith('/meallog_coach_save')).length,0);
  assert.equal(calls.filter(c=>c.path.includes('context') || c.path.includes('reserve')).length,0);
});

test('failed persistence never produces a saved confirmation; unclear requests save only chat', async () => {
  const failed = await fixture({fail:true}).ask('오늘 점심을 시오콘부볶음밥으로 기억해줘');
  assert.equal(failed.statusCode,503);
  assert.equal(failed.data.ok,false);
  assert.equal(failed.data.reply,undefined);
  const {ask,calls}=fixture();
  const unclear=await ask('오늘 점심 기억해줘');
  assert.equal(unclear.data.memory_save.status,'needs_details');
  assert.equal(calls.filter(c=>c.path.endsWith('/meallog_coach_remember')).length,0);
  assert.match(unclear.data.reply,/아직 저장하지 않았어요/);
});

test('forwards record reset generation and rejects malformed sync state before writing', async () => {
  assert.equal((await fixture({generation:randomUUID()}).ask('오늘 점심을 시오콘부볶음밥으로 기억해줘')).data.memory_save.status,'saved');
  const {ask,calls}=fixture({generation:'invalid'});
  assert.equal((await ask('오늘 점심을 시오콘부볶음밥으로 기억해줘')).statusCode,400);
  assert.equal(calls.length,0);
});
