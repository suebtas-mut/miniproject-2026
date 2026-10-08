import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sdkReadPath, authorizedSdkRead } from './sdk-read-policy.mjs';
import { routePermission } from './permission-workflow.mjs';

test('SDK read grammar accepts reviewed range reads but rejects command execution', () => {
  const file = 'D:\\flutter\\lib\\src\\widgets\\routes.dart';
  assert.equal(sdkReadPath(`$c = Get-Content '${file}'; $c[930..985]; Write-Output '---- 2034 ----'; $c[2025..2075]`), file);
  assert.equal(sdkReadPath(`Get-Content -LiteralPath '${file}' | Select-Object -Skip 20 -First 40`), file);
  for (const suffix of ['; Remove-Item x', ' > output', ' | Invoke-Expression', '\nwhoami', '; $c[0..99999]'])
    assert.equal(sdkReadPath(`Get-Content '${file}'${suffix}`), null);
  assert.equal(sdkReadPath(`$c = Get-Content '${file}'; $c.GetType()`), null);
  if (process.env.LOCALAPPDATA) {
    assert.equal(sdkReadPath('$c = Get-Content "$env:LOCALAPPDATA\\Pub\\Cache\\go_router\\delegate.dart"; $c[40..110]'),
      process.env.LOCALAPPDATA + '\\Pub\\Cache\\go_router\\delegate.dart');
    assert.equal(sdkReadPath('Get-Content "$env:LOCALAPPDATA\\$(whoami)\\delegate.dart"'), null);
  }
});

test('SDK approval checks actual file, exact requested directory, tool and configured scope', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-policy-'));
  try {
    const root = path.join(tmp, 'src'); fs.mkdirSync(root);
    const file = path.join(root, 'routes.dart'); fs.writeFileSync(file, '// fixture');
    const request = { id: 'sdk1', permission: 'external_directory', patterns: [path.join(root, '*')] };
    const context = { tool: 'bash', sdkSourceRoot: root, input: { command: `Get-Content '${file}'` } };
    assert.equal(authorizedSdkRead(request, context), true);
    assert.equal(authorizedSdkRead(request, { ...context, sdkSourceRoot: undefined, dependencySourceRoots: [root] }), true);
    assert.equal(authorizedSdkRead(request, { ...context, sdkSourceRoot: undefined }), false);
    assert.equal(authorizedSdkRead({ ...request, patterns: [path.join(tmp, '*')] }, context), false);
    assert.equal(authorizedSdkRead(request, { ...context, tool: 'edit' }), false);
    const outside = path.join(tmp, 'private.dart'); fs.writeFileSync(outside, '// outside');
    assert.equal(authorizedSdkRead(request, { ...context, input: { command: `Get-Content '${outside}'` } }), false);
    const records = new Map(), replies = [];
    const args = { agent: 'test', request, context, getRecord: k => records.get(k), putRecord: (k, v) => records.set(k, v),
      readFresh: async () => request, readContext: async () => ({ ...context, input: { command: 'Remove-Item x' } }),
      advise: async () => { throw Error('No inference needed'); }, reply: async v => replies.push(v) };
    assert.equal((await routePermission(args)).stale, true);
    assert.deepEqual(replies, []);
    args.readContext = async () => context;
    await routePermission(args); await routePermission(args);
    assert.deepEqual(replies, ['once']);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
