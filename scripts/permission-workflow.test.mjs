import { test } from 'node:test';
import assert from 'node:assert/strict';
import { permissionPlan, permissionAdvicePrompt, routePermission } from './permission-workflow.mjs';

test('authority comes from exact policy, never from an AI recommendation', async () => {
  const records = new Map(); let calls = 0; const replies = [];
  const request = { id: 'p1', sessionID: 's1', permission: 'bash', patterns: ['some-unknown-command'] };
  const args = { agent: 'kaengkarn', request, getRecord: k => records.get(k), putRecord: (k,v) => records.set(k, structuredClone(v)),
    advise: async () => { calls++; return '{"action":"approve"}'; }, readFresh: async () => request, reply: async x => replies.push(x) };
  for (let i = 0; i < 100; i++) await routePermission(args);
  assert.equal(calls, 1); assert.deepEqual(replies, []);
});

test('exact read-only command replies once and changed requests receive no approval', async () => {
  const records = new Map(); const replies = [];
  const request = { id: 'p1', sessionID: 's1', permission: 'bash', patterns: ['git status --short'] };
  const args = { agent: 'kaengkarn', request, getRecord: k => records.get(k), putRecord: (k,v) => records.set(k, structuredClone(v)),
    advise: async () => { throw Error('must not call'); }, readFresh: async () => ({ ...request, patterns: ['git push'] }), reply: async x => replies.push(x) };
  assert.equal((await routePermission(args)).stale, true); assert.deepEqual(replies, []);
  args.readFresh = async () => request;
  await routePermission(args); await routePermission(args);
  assert.deepEqual(replies, ['once']);
});

test('secret reads are rejected; examples are not classified as secrets; external changes stay human', () => {
  for (const p of ['backend\\.env', 'backend/.env.local', 'keys/server.pem'])
    assert.equal(permissionPlan({ permission: 'read', patterns: [p] }).action, 'reject');
  assert.equal(permissionPlan({ permission: 'read', patterns: ['backend/.env.example'] }).action, 'human');
  assert.equal(permissionPlan({ permission: 'external_directory', patterns: ['D:/other/*'] }).level, 'human');
  assert.equal(permissionPlan({ permission: 'bash', patterns: ['git status; git push'] }).action, 'human');
  const prompt = permissionAdvicePrompt({ permission: 'bash', patterns: ['echo PRIVATE_VALUE'] });
  assert.ok(!prompt.includes('PRIVATE_VALUE'));
});
