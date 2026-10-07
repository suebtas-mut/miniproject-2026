import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freeModel, within, jobs, routineAnswers } from './autopilot.mjs';
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
