import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AppServer, canRescue, boundedPrompt } from './codex-rescue.mjs';

test('rescue requires explicit enablement and persists hard total/per-agent caps', () => {
  const config = { enabled: true, executable: 'codex.exe', model: 'configured', maxCallsTotal: 100, maxCallsPerAgent: 100 };
  assert.equal(canRescue(config, {}, {}), true);
  assert.equal(canRescue({ ...config, enabled: false }, {}, {}), false);
  assert.equal(canRescue(config, { codexCalls: 2 }, {}), false);
  assert.equal(canRescue(config, {}, { codexCalls: 1 }), false);
  assert.equal(canRescue(undefined, {}, {}), false);
});
test('prompt size stays bounded even for very large logs', () => {
  const prompt = boundedPrompt('s'.repeat(100000), 'x'.repeat(100000));
  assert.ok(prompt.length < 10000);
  assert.match(prompt, /untrusted diagnostic/);
});
test('app-server client rejects approvals, routes responses and times out lost requests', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-rpc-test-'));
  const fixture = path.join(directory, 'mock.cjs');
  fs.writeFileSync(fixture, `const rl=require('readline').createInterface({input:process.stdin});
const send=x=>process.stdout.write(JSON.stringify(x)+'\\n');
rl.on('line',line=>{ const x=JSON.parse(line);
if(x.method==='initialize')send({id:x.id,result:{ok:true}});
if(x.method==='probe'){send({id:99,method:'item/commandExecution/requestApproval',params:{}});send({id:x.id,result:{ok:true}});}
if(x.id===99 && x.result)send({method:'test/decision',params:x.result});
});`);
  const events = [];
  const client = new AppServer(process.execPath, directory, e => events.push(e), [fixture]);
  try {
    await client.initialize();
    assert.deepEqual(await client.rpc('probe'), { ok: true });
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.ok(events.some(e => e.message?.method === 'test/decision' && e.message.params.decision === 'decline'));
    await assert.rejects(client.rpc('lost', {}, 50), /RPC timeout/);
  } finally {
    await client.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
