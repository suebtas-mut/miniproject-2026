import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eligible, validDecision } from './agent-bridge.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('only exact read-only commands are eligible', () => {
  assert.equal(eligible({ permission: 'bash', patterns: ['git status --short'] }), true);
  for (const command of ['git status; git push', 'git status\nrm -rf .', 'git push', 'git status --short && echo x'])
    assert.equal(eligible({ permission: 'bash', patterns: [command] }), false);
  assert.equal(eligible({ permission: 'bash', patterns: [] }), false);
  assert.equal(eligible({ permission: 'edit', patterns: ['git status'] }), false);
});
test('model cannot widen permission authority', () => {
  assert.equal(validDecision({ action: 'approve', reason: 'safe', answers: [] },
    { permission: 'bash', patterns: ['git push'] }, 'permission'), false);
});
test('answers must match cardinality and non-custom options', () => {
  const request = { questions: [{ custom: false, options: [{ label: 'A' }] }] };
  const decision = answers => ({ action: 'answer', reason: 'evidence', answers });
  assert.equal(validDecision(decision([['A']]), request, 'question'), true);
  for (const answers of [[], [['B']], [['A', 'A']], [[]]])
    assert.equal(validDecision(decision(answers), request, 'question'), false);
});

test('VS Code file queue waits for a decision then replies once without Codex CLI', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-bridge-'));
  const request = { id: 'que_test', sessionID: 'ses_test',
    questions: [{ custom: false, options: [{ label: 'A' }] }] };
  const replies = [];
  const server = http.createServer((req, res) => {
    const route = new URL(req.url, 'http://localhost').pathname;
    res.setHeader('Content-Type', 'application/json');
    if (route.endsWith('/reply')) {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => { replies.push(JSON.parse(body)); res.end('true'); });
      return;
    }
    const routes = {
      '/doc': { paths: { '/permission': { get: {} }, '/question': { get: {} },
        '/permission/{requestID}/reply': { post: {} }, '/question/{requestID}/reply': { post: {} } } },
      '/session/ses_test': { directory }, '/permission': [], '/question': [request],
    };
    res.end(JSON.stringify(routes[route]));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const config = path.join(directory, 'config.json');
    fs.writeFileSync(config, JSON.stringify({ agents: [{ name: 'test', directory,
      sessionID: 'ses_test', url: `http://127.0.0.1:${server.address().port}` }] }));
    const run = () => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [fileURLToPath(new URL('./agent-bridge.mjs', import.meta.url)),
        config, '--live', '--once'], { cwd: directory, windowsHide: true, stdio: 'ignore' });
      child.on('error', reject);
      child.on('exit', code => code === 0 ? resolve() : reject(Error(`Bridge exited ${code}`)));
    });
    await run();
    assert.equal(replies.length, 0);
    const queue = path.join(directory, '.agent-runtime', 'queue-live');
    const filename = fs.readdirSync(queue).find(name => name.endsWith('.request.json'));
    const envelope = JSON.parse(fs.readFileSync(path.join(queue, filename), 'utf8'));
    fs.writeFileSync(path.join(queue, filename.replace('.request.json', '.decision.json')),
      JSON.stringify({ fingerprint: envelope.fingerprint,
        decision: { action: 'answer', reason: 'test evidence', answers: [['A']] } }));
    await run();
    await run();
    assert.deepEqual(replies, [{ answers: [['A']] }]);
  } finally {
    await new Promise(resolve => server.close(resolve));
    // This directory is uniquely created by this test under the OS temp directory.
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
