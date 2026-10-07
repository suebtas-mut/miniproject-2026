import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roadmap, roadmapJob, enterStage } from './sprint-roadmap.mjs';

test('every sprint has independent evidence, full regression checks and explicit ownership', () => {
  assert.deepEqual(roadmap.map(s => s.sprint), [4,5,6,7,8,9,10,11,12,13]);
  for (const agent of ['kaengkarn', 'sukhsorn']) {
    const reports = new Set();
    for (let i = 0; i < roadmap.length; i++) {
      const job = roadmapJob(agent, i, { required: ['baseline'], command: 'test all' });
      assert.equal(job.command, 'test all');
      assert.ok(job.required.includes('baseline'));
      reports.add(job.required.at(-1));
      assert.match(job.scope, /Stop after THIS sprint/);
      assert.match(job.scope, /\/api\/v1/);
    }
    assert.equal(reports.size, 10);
  }
  assert.throws(() => roadmapJob('kaengkarn', 10, {}));
});

test('advancing a sprint preserves paid rescue counters and existing history', () => {
  const state = { codexCalls: 1, stageHistory: [{ sprint: 4 }], rounds: 6, phase: 'local-checks-passed' };
  enterStage(state, 1, 'sprints-4-13');
  assert.equal(state.codexCalls, 1);
  assert.equal(state.stageHistory.length, 1);
  assert.equal(state.rounds, 0);
  assert.equal(state.phase, 'queued');
  assert.equal(state.stageIndex, 1);
});
