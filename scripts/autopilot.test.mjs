import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freeModel, within, jobs, routineAnswers, rescueAdvice, recoverTimedOutTurn } from './autopilot.mjs';

test('timeout recovery rechecks work, survives restart, and stops at a bounded stage budget', () => {
  let s = { stageIndex: 5, rounds: 2 };
  assert.equal(recoverTimedOutTurn(s, 123), true);
  assert.equal(s.phase, 'working'); assert.equal(s.lastDispatch, 123); assert.equal(s.rounds, 2);
  s = JSON.parse(JSON.stringify(s));
  assert.equal(recoverTimedOutTurn(s), true);
  assert.equal(recoverTimedOutTurn(s), false); assert.equal(s.phase, 'needs-review');
  s.stageIndex = 6;
  assert.equal(recoverTimedOutTurn(s), true);
  assert.equal(recoverTimedOutTurn({ rounds: 6 }), false);
  assert.equal(recoverTimedOutTurn({ rounds: 1, localSessionID: 'local' }), false);
});

test('pending approval and active worker never trigger repeated local inference', async () => {
  let calls = 0;
  const state = {};
  const options = { scope: 'sprint 4', evidence: 'timeout', advise: async () => { calls++; return 'advice'; } };
  for (let i = 0; i < 100; i++) {
    assert.equal(await rescueAdvice(state, { ...options, pending: true }), null);
    assert.equal(await rescueAdvice(state, { ...options, status: { type: 'busy' } }), null);
  }
  assert.equal(calls, 0);
  for (let i = 0; i < 100; i++) assert.equal(await rescueAdvice(state, options), 'advice');
  assert.equal(calls, 1);
  const restored = JSON.parse(JSON.stringify(state));
  await rescueAdvice(restored, options);
  assert.equal(calls, 1);
  await rescueAdvice(restored, { ...options, scope: 'sprint 5' });
  assert.equal(calls, 2);
});

test('unavailable advisor empty response is cached instead of retried each poll', async () => {
  let calls = 0;
  const state = {};
  const options = { scope: 'sprint 4', evidence: 'test failed', advise: async () => { calls++; return ''; } };
  await rescueAdvice(state, options);
  await rescueAdvice(state, options);
  assert.equal(calls, 1);
});
test('unknown and paid prices cannot be free fallbacks', () => {
  for (const value of [undefined, {}, { cost: {} }, { cost: { input: 0, output: 1 } },
    { cost: { input: 0, output: 0, cache: { read: 1 } } }]) assert.equal(freeModel(value), false);
  assert.equal(freeModel({ cost: { input: 0, output: 0, cache: { read: 0 } } }), true);
});
test('path scope rejects sibling prefix and parent escape', () => {
  assert.equal(within('D:/data/shuttle', 'D:/data/shuttle/app'), true);
  assert.equal(within('D:/data/shuttle', 'D:/data/shuttle-other'), false);
  assert.equal(within('D:/data/shuttle', 'D:/data/shuttle/../other'), false);
});
test('each worker has a real verification command and handoff requirement', () => {
  for (const job of Object.values(jobs)) {
    assert.match(job.command, /test/);
    assert.ok(job.required.some(file => file.includes('handoffs')));
  }
});
test('routine questions follow project conventions but cannot approve deployment', () => {
  const request = question => ({ questions: [{ question, options: [{ label: 'Jest' }, { label: 'Vitest' }] }] });
  assert.deepEqual(routineAnswers(request('Which test framework?'), 'kaengkarn'), [['Jest']]);
  assert.equal(routineAnswers(request('Approve production deployment using this test framework?'), 'kaengkarn'), null);
  assert.equal(routineAnswers(request('Which test framework?'), 'sukhsorn'), null);
  assert.equal(routineAnswers(request('Change requirements?'), 'kaengkarn'), null);
});
