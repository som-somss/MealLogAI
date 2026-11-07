import test from 'node:test';
import assert from 'node:assert/strict';
import {createGenerator, generationDiagnostic} from '../coach-generation.js';

test('writer cannot claim a successful or future write without a persistence result', async () => {
  const generator = createGenerator(async () => Response.json({status:'completed', output:[{content:[{type:'output_text', text:'시오콘부볶음밥으로 저장해 드리겠습니다. 기억에 반영했어요. 식사 기록을 확인해 주세요.'}]}]}), {OPENAI_API_KEY:'test-key'});
  assert.equal(await generator.answer('기억됐어?', {kind:'general'}, {}), '식사 기록을 확인해 주세요.');
});

test('classifies provider failures without retaining error messages or credentials', async () => {
  for (const code of ['insufficient_quota', 'invalid_api_key', 'unexpected-private-value']) {
    const generator = createGenerator(async () => Response.json({error: {
      code, message: 'secret-token and private question'
    }}, {status: 429}), {OPENAI_API_KEY: 'test-key'});
    await assert.rejects(generator.answer('test question', {kind: 'general'}, {}), error => {
      const diagnostic = generationDiagnostic(error, 'answer');
      assert.deepEqual(diagnostic, {stage: 'answer', code: code === 'unexpected-private-value' ? 'provider_http' : code, http_status: 429});
      assert.doesNotMatch(JSON.stringify(diagnostic), /secret-token|private question|unexpected-private/);
      return true;
    });
  }
});

test('distinguishes timeout, incomplete responses and unverified generated numbers', async () => {
  const cases = [
    [async () => {throw new DOMException('private message', 'TimeoutError');}, 'timeout'],
    [async () => Response.json({status: 'incomplete', output: []}), 'incomplete_response'],
    [async () => Response.json({status: 'completed', output: [{content: [{type: 'output_text', text: '100g을 드세요.'}]}]}), 'unverified_numbers']
  ];
  for (const [fetcher, expected] of cases) {
    const generator = createGenerator(fetcher, {OPENAI_API_KEY: 'test-key'});
    await assert.rejects(generator.answer('test', {kind: 'general'}, {}), error => {
      assert.deepEqual(generationDiagnostic(error, 'answer'), {stage: 'answer', code: expected});
      return true;
    });
  }
});

test('rewrites numeric prose once, keeping exact calculations out of the model input', async () => {
  const calls = [];
  const generator = createGenerator(async (_url, options) => {
    calls.push(JSON.parse(options.body));
    const text = calls.length === 1 ? '100g을 기준으로 비교했어요.' : '말씀하신 양을 기준으로 비교했어요. 곁들이는 음식도 함께 생각해 주세요.';
    return Response.json({status: 'completed', output: [{content: [{type: 'output_text', text}]}]});
  }, {OPENAI_API_KEY: 'test-key'});
  const reply = await generator.answer('과메기 100g 먹으면?', {kind: 'food', foodRequest: {query: '과메기'}}, {reply: '100g 약 371kcal → 오늘 예상 371kcal', warnings: ['식사 기록이 빠져 있어 확정할 수 없어요.']});
  assert.equal(calls.length, 2);
  for (const call of calls) assert.doesNotMatch(call.input, /100|371/);
  assert.deepEqual(JSON.parse(calls[0].input).warnings, ['식사 기록이 빠져 있어 확정할 수 없어요.']);
  assert.doesNotMatch(reply, /\p{N}|\[수치\]/u);
  assert.match(reply, /말씀하신 양/);
});

test('drops an entire numeric sentence while preserving useful qualitative explanation', async () => {
  let calls = 0;
  const generator = createGenerator(async () => {
    calls++;
    return Response.json({status: 'completed', output: [{content: [{type: 'output_text',
      text: '과메기 100.5g이면 999kcal예요. 곁들이는 음식도 함께 고려해 주세요.\n[수치]g을 권장해요. 기록이 빠져 있으면 목표 이내라고 확정할 수 없어요.'
    }]}]});
  }, {OPENAI_API_KEY: 'test-key'});
  const reply = await generator.answer('과메기 100g 먹으면?', {kind: 'food'}, {reply: '검증된 계산'});
  assert.equal(reply, '곁들이는 음식도 함께 고려해 주세요. 기록이 빠져 있으면 목표 이내라고 확정할 수 없어요.');
  assert.equal(calls, 1);
});
