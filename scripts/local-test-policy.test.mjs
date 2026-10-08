import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { authorizedLocalTest } from './local-test-policy.mjs';
import { routePermission } from './permission-workflow.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'local-tests-'));
  for (const dir of ['backend', 'app']) fs.mkdirSync(path.join(root, dir));
  fs.writeFileSync(path.join(root, 'backend/package.json'), JSON.stringify({ scripts: { test: 'jest' } }));
  t.after(() => fs.rmSync(root, { recursive: true }));
  return root;
}
test('local tests require complete commands and the correct workspace directory', t => {
  const root = fixture(t), request = { permission: 'bash' };
  const check = (command, workdir = path.join(root, 'backend')) => authorizedLocalTest(request, { root, input: { command, workdir } });
  assert.equal(check('npm.cmd test -- --runInBand'), true);
  assert.equal(check('npm.cmd test -- --runInBand', root), false);
  assert.equal(check('npm.cmd test -- --runInBand; Remove-Item x'), false);
  assert.equal(check('npm.cmd test -- --runInBand > elsewhere.txt'), false);
  assert.equal(check('npm install'), false);
  assert.equal(check('flutter test --no-pub', path.join(root, 'app')), true);
  assert.equal(check('flutter test --no-pub', os.tmpdir()), false);
  assert.equal(check(`Set-Location -LiteralPath '${path.join(root, 'app')}'; flutter analyze --no-pub`, root), true);
  assert.equal(authorizedLocalTest({ permission: 'external_directory' }, { root, input: { command: 'flutter test --no-pub', workdir: path.join(root, 'app') } }), false);
  fs.writeFileSync(path.join(root, 'backend/package.json'), JSON.stringify({ scripts: { test: 'jest', pretest: 'unexpected command' } }));
  assert.equal(check('npm.cmd test -- --runInBand'), false);
});

test('revalidate tool input and npm lifecycle configuration immediately before approving', async t => {
  const root = fixture(t), records = new Map(), replies = [];
  const request = { id: 'p1', permission: 'bash', patterns: ['npm *'] };
  const context = { root, input: { command: 'npm.cmd test -- --runInBand', workdir: path.join(root, 'backend') } };
  const args = { agent: 'kaengkarn', request, context,
    getRecord: k => records.get(k), putRecord: (k,v) => records.set(k, structuredClone(v)),
    readFresh: async () => request, reply: async x => replies.push(x), advise: async () => { throw Error('AI not needed'); },
    readContext: async () => { fs.writeFileSync(path.join(root, 'backend/package.json'), JSON.stringify({ scripts: { test: 'jest', posttest: 'unexpected' } })); return context; } };
  assert.equal((await routePermission(args)).stale, true);
  assert.deepEqual(replies, []);
  fs.writeFileSync(path.join(root, 'backend/package.json'), JSON.stringify({ scripts: { test: 'jest' } }));
  args.readContext = async () => context;
  await routePermission(args);
  assert.deepEqual(replies, ['once']);
});
