import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {makeHandler} from '../api/ai-coach.js';
import {koreaDay} from '../coach-core.js';

const day = koreaDay();
const userId = '11111111-1111-4111-8111-111111111111';
const conversationId = '22222222-2222-4222-8222-222222222222';

function fixture({external = false, allowed = true, providerFails = false} = {}) {
  const state = {messages: [], calls: [], saves: [], aiCalls: 0, releases: 0, authCalls: 0};
  const fetcher = async (url, options = {}) => {
    const parsed = new URL(url);
    const body = options.body ? JSON.parse(options.body) : null;
    state.calls.push({url: parsed, options, body});
    if (parsed.origin === 'https://meallogai.vercel.app' && parsed.pathname === '/api/food-search') {
      assert.equal(parsed.searchParams.get('q'), '과메기');
      // Synthetic nutrition values for arithmetic assertions, not dietary data.
      return Response.json({items: [{name: '과메기', nutritionBase: 100, unit: 'g', calories: 200, carbs: 10, protein: 20, fat: 10, source: 'test-fixture'}]});
    }
    if (parsed.origin === 'https://api.openai.com') {
      state.aiCalls++;
      assert.equal(options.headers.Authorization, 'Bearer test-key');
      assert.equal(body.store, false);
      if (providerFails) return Response.json({error: 'test outage'}, {status: 503});
      const text = body.text ? JSON.stringify({kind: 'food', food: '과메기', include: [], exclude: [], light: false, highProtein: false, noRice: false, vegetarian: false}) : '말씀하신 양을 기준으로 비교했어요.';
      return Response.json({status: 'completed', output: [{content: [{type: 'output_text', text}]}]});
    }
    assert.match(parsed.hostname, /\.supabase\.co$/);
    assert.equal(options.headers.Authorization, 'Bearer fixture-session');
    if (parsed.pathname === '/auth/v1/user') {
      state.authCalls++;
      return Response.json({id: userId});
    }
    if (parsed.pathname === '/rest/v1/ai_coach_messages') {
      assert.equal(parsed.searchParams.get('user_id'), 'eq.' + userId);
      const requestId = parsed.searchParams.get('request_id')?.slice(3);
      if (requestId) return Response.json(state.messages.filter(m => m.role === 'assistant' && m.request_id === requestId));
      assert.equal(parsed.searchParams.get('conversation_id'), 'eq.' + conversationId);
      assert.equal(parsed.searchParams.get('select'), 'role,content,metadata');
      assert.equal(parsed.searchParams.get('limit'), '8');
      assert.equal(parsed.searchParams.get('order'), 'created_at.desc,role.asc');
      return Response.json(state.messages);
    }
    if (parsed.pathname.endsWith('/meallog_coach_context')) return Response.json({
      kind: body.p_kind, day: body.p_day, from: body.p_day, to: body.p_day,
      goal_kcal: 2000, settings: {use_external_ai: external},
      days: [{meal_date: body.p_day, meal_count: 2, nutrients: {
        calories: {value: 1000, missing: 0}, carbs: {value: 100, missing: 0},
        protein: {value: 50, missing: 0}, fat: {value: 30, missing: 0}
      }}]
    });
    if (parsed.pathname.endsWith('/meal_assistant_reserve')) return Response.json({allowed, usage: {used: 1}});
    if (parsed.pathname.endsWith('/meal_assistant_release')) {
      state.releases++;
      return Response.json({ok: true});
    }
    if (parsed.pathname.endsWith('/meallog_coach_save')) {
      state.saves.push(body);
      state.messages.unshift(
        {role: 'assistant', content: body.p_reply, metadata: body.p_metadata, conversation_id: conversationId, request_id: body.p_request},
        {role: 'user', content: body.p_question, metadata: {}, conversation_id: conversationId, request_id: body.p_request}
      );
      return Response.json(conversationId);
    }
    throw Error('Unexpected network request: ' + parsed.pathname);
  };
  const handler = makeHandler(fetcher, external ? {OPENAI_API_KEY: 'test-key'} : {});
  async function ask(message, {conversation = state.messages.length ? conversationId : null, selectedDate = day, requestId = randomUUID(), method = 'POST', authorization = 'Bearer fixture-session'} = {}) {
    const response = {statusCode: 200, headers: {}, setHeader(k, v) {this.headers[k] = v;}, status(code) {this.statusCode = code; return this;}, json(data) {this.data = data; return this;}};
    await handler({method, headers: {authorization}, body: {message, selected_date: selectedDate, conversation_id: conversation, request_id: requestId}}, response);
    return response;
  }
  return {state, ask};
}

test('API persists 100g → 50g → 25g and calculates nutrients without external AI', async () => {
  const {state, ask} = fixture();
  const first = await ask('과메기 100g 먹으면?');
  assert.equal(first.statusCode, 200);
  assert.equal(first.data.conversation_context.amount, 100);
  assert.ok(first.data.suggestions.length);
  const half = await ask('그럼 반만 먹으면?');
  assert.equal(half.statusCode, 200);
  assert.match(half.data.reply, /과메기 50g/);
  assert.equal(half.data.conversation_context.amount, 50);
  assert.equal(half.data.suggestions[0].foods[0].grams, 50);
  assert.equal(half.data.suggestions[0].foods[0].calories, first.data.suggestions[0].foods[0].calories / 2);
  const quarter = await ask('그러면 반만?');
  assert.equal(quarter.data.conversation_context.amount, 25);
  assert.equal(state.saves.at(-1).p_metadata.conversation_context.amount, 25);
  assert.equal(state.aiCalls, 0);
  assert.equal(state.saves.length, 3);
});

test('generative mode preserves the quantity and only calls the writer for a clear follow-up', async () => {
  const {state, ask} = fixture({external: true});
  await ask('과메기 100g 먹으면?');
  assert.equal(state.aiCalls, 2);
  const half = await ask('그럼 반만 먹으면?');
  assert.equal(half.statusCode, 200);
  assert.equal(half.data.mode, '생성형 AI 코치');
  assert.equal(half.data.conversation_context.amount, 50);
  assert.equal(state.aiCalls, 3);
  assert.equal(state.releases, 2);
});

test('unknown baseline is clarified and a later explicit amount resolves it', async () => {
  const {ask} = fixture();
  await ask('과메기 어느 정도 먹어야 할까?');
  const half = await ask('그럼 반만 먹으면?');
  assert.equal(half.statusCode, 200);
  assert.match(half.data.reply, /기준 양/);
  assert.equal(half.data.conversation_context.amount, null);
  assert.deepEqual(half.data.suggestions, []);
  const explicit = await ask('그럼 100g은?');
  assert.equal(explicit.data.conversation_context.amount, 100);
});

test('provider failure or exhausted quota still returns the deterministic follow-up', async () => {
  for (const options of [{external: true, providerFails: true}, {external: true, allowed: false}]) {
    const {ask} = fixture(options);
    await ask('과메기 100g 먹으면?');
    const half = await ask('그럼 반만?');
    assert.equal(half.statusCode, 200);
    assert.equal(half.data.mode, '기록 기반 코칭');
    assert.equal(half.data.conversation_context.amount, 50);
    assert.match(half.data.reply, /50g/);
    assert.ok(half.data.warnings.some(w => /생성형 AI/.test(w)));
    if (options.providerFails) assert.deepEqual(half.data.generation_diagnostic,
      {stage: 'answer', code: 'provider_http', http_status: 503});
  }
});

test('a selected date change does not reuse the previous quantity', async () => {
  const {ask} = fixture();
  await ask('과메기 100g 먹으면?');
  const result = await ask('그럼 반만?', {selectedDate: '2000-01-01'});
  assert.equal(result.statusCode, 200);
  assert.match(result.data.reply, /어떤 음식/);
  assert.equal(result.data.conversation_context.food, null);
});

test('retrying the same request does not save or generate twice', async () => {
  const {state, ask} = fixture({external: true});
  const requestId = randomUUID();
  const first = await ask('과메기 100g 먹으면?', {requestId});
  const retry = await ask('과메기 100g 먹으면?', {requestId});
  assert.equal(retry.data.reply, first.data.reply);
  assert.equal(state.saves.length, 1);
  assert.equal(state.aiCalls, 2);
});

test('method and authentication are validated before any data lookup', async () => {
  const {state, ask} = fixture();
  assert.equal((await ask('그럼 반만?', {authorization: ''})).statusCode, 401);
  assert.equal((await ask('그럼 반만?', {method: 'GET'})).statusCode, 405);
  assert.equal(state.calls.length, 0);
});
