import test from 'node:test';
import assert from 'node:assert/strict';
import {plan, koreaDay, compose} from '../coach-core.js';
import {conversationContext, previousIntent, resolveFollowUp, resolveIntent} from '../coach-generation.js';

const day = koreaDay();
const route = question => plan(question, day);
const context = question => conversationContext(route(question), day);
const follow = (question, previous) => resolveFollowUp(question, previous, route(question));
const saved = value => ({role: 'assistant', metadata: {conversation_context: value}});

test('recognizes a question about how much of a specific food to eat', () => {
  const result = route('과메기 어느 정도 먹어야 할까?');
  assert.equal(result.kind, 'food');
  assert.equal(result.foodRequest.query, '과메기');
  assert.equal(result.foodRequest.amount, null);
});

test('halves the explicit serving and can halve the result again', () => {
  const half = follow('그럼 반만 먹으면?', context('과메기 100g 먹으면?'));
  assert.equal(half.foodRequest.query, '과메기');
  assert.equal(half.foodRequest.amount, 50);
  assert.equal(half.foodRequest.unit, 'g');
  const quarter = follow('그러면 절반만?', conversationContext(half, day));
  assert.equal(quarter.foodRequest.amount, 25);
});

test('uses the latest explicit amount, including volume and count units', () => {
  for (const [first, question, expected, unit] of [
    ['과메기 100g 먹으면?', '그럼 150g은?', 150, 'g'],
    ['우유 200ml 먹으면?', '그럼 반만 먹으면?', 100, 'mL'],
    ['김밥 두 줄 먹으면?', '그럼 반만?', 1, '줄'],
    ['과메기 100g 먹으면?', '그러면 두 배로?', 200, 'g'],
    ['과메기 0.2kg 먹으면?', '그럼 반만?', 100, 'g']
  ]) {
    const result = follow(question, context(first));
    assert.equal(result.foodRequest.amount, expected);
    assert.equal(result.foodRequest.unit, unit);
  }
});

test('asks for a baseline instead of halving a suggested upper bound', () => {
  const result = follow('그럼 반만 먹으면?', context('과메기 어느 정도 먹어야 할까?'));
  assert.equal(result.foodRequest.needsAmount, true);
  assert.equal(result.foodRequest.amount, null);
  const reply = compose({kind: 'food', day, foodRequest: result.foodRequest});
  assert.match(reply.reply, /기준 양/);
  assert.equal(reply.suggestions.length, 0);
});

test('does not borrow a food from a new conversation, unrelated topic, or another selected date', () => {
  assert.equal(follow('그럼 반만?', null).foodRequest.needsFood, true);
  const old = context('과메기 100g 먹으면?');
  assert.equal(follow('그럼 반만?', {...old, selected_date: '2000-01-01'}).foodRequest.needsFood, true);
  const latest = previousIntent([saved(context('고마워')), saved(old)], day);
  assert.equal(follow('그럼 반만?', latest).foodRequest.needsFood, true);
});

test('keeps the explicit analysis date when the selected date has not changed', () => {
  const previous = context('2000-01-02 과메기 100g 먹으면?');
  assert.equal(follow('그럼 반만?', previous).day, '2000-01-02');
});

test('a new food, new menu request, or mixed quantity is not treated as a serving follow-up', () => {
  const previous = context('과메기 100g 먹으면?');
  for (const question of ['그럼 연어 150g 먹으면?', '그럼 저녁 뭐 먹을까?', '그럼 50g 말고 100g은?', '반숙 계란 먹으면?']) {
    assert.equal(follow(question, previous), null);
  }
});

test('invalid quantities remain invalid rather than becoming a default serving', () => {
  for (const question of ['그럼 0g은?', '그럼 -50g은?', '그럼 999999g은?']) {
    const result = follow(question, context('과메기 100g 먹으면?'));
    assert.equal(result.foodRequest.invalidAmount, true);
  }
});

test('uses saved structured state, while older conversations use only the immediately previous question', () => {
  const previous = context('과메기 100g 먹으면?');
  assert.equal(previousIntent([saved(previous)], day).amount, 100);
  assert.equal(previousIntent([{role: 'user', content: '과메기 100g 먹으면?'}], day).amount, 100);
  assert.equal(previousIntent([{role: 'user', content: '고마워'}, {role: 'user', content: '과메기 100g 먹으면?'}], day).food, null);
  assert.equal(previousIntent([saved({...previous, selected_date: '2000-01-01'})], day), null);
});

test('model classification cannot overwrite a deterministically resolved quantity', () => {
  const previous = context('과메기 100g 먹으면?');
  const result = follow('그럼 반만?', previous);
  assert.equal(resolveIntent({kind: 'general'}, '그럼 반만?', previous, result), result);
});
