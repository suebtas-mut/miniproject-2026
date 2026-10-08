import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roadmap, roadmapJob, enterStage, lastStageIndex } from './sprint-roadmap.mjs';

test('every sprint has independent evidence, full regression checks and explicit ownership', () => {
  assert.deepEqual(roadmap.map(s => s.sprint), [4,5,6,7,8,9,10,11,12,13,14]);
  for (const agent of ['kaengkarn', 'sukhsorn']) {
    const reports = new Set();
    for (let i = 0; i <= lastStageIndex(agent); i++) {
      const job = roadmapJob(agent, i, { required: ['baseline'], command: 'test all' });
      assert.equal(job.command, 'test all');
      assert.ok(job.required.includes('baseline'));
      reports.add(job.required.at(-1));
      assert.match(job.scope, /Stop after THIS sprint/);
      assert.match(job.scope, /\/api\/v1/);
    }
    assert.equal(reports.size, agent === 'kaengkarn' ? 11 : 10);
  }
  assert.throws(() => roadmapJob('kaengkarn', 11, {}));
  assert.throws(() => roadmapJob('sukhsorn', 10, {}));
  const audit = roadmapJob('kaengkarn', 10, { required: [] });
  assert.ok(audit.required.includes('docs/security/next-security-sprint-plan.md'));
  assert.ok(audit.required.includes('docs/security/sprint14-baseline-audit.md'));
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
