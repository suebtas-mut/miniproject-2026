import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Deliberately small authority boundary: Codex advice cannot expand this list.
export function eligible(request) {
  return request.permission === 'bash' && Array.isArray(request.patterns) &&
    request.patterns.length > 0 && request.patterns.every(command =>
      ['git status --short', 'git status', 'git diff --stat', 'git branch --show-current'].includes(command));
}

export function validDecision(value, request, kind) {
  if (!value || !['approve', 'answer', 'human'].includes(value.action) ||
      typeof value.reason !== 'string' || !Array.isArray(value.answers)) return false;
  if (value.action === 'human') return true;
  if (kind === 'permission') return value.action === 'approve' && eligible(request);
  return value.action === 'answer' && value.answers.length === request.questions.length &&
    value.answers.every((answer, i) => Array.isArray(answer) && answer.length > 0 &&
      (request.questions[i].multiple || answer.length === 1) &&
      answer.every(label => typeof label === 'string' && label.length > 0 &&
        (request.questions[i].custom !== false || request.questions[i].options.some(o => o.label === label))));
}

export function requestFingerprint(key, request) {
  return createHash('sha256').update(JSON.stringify([key, request])).digest('hex');
}

async function main() {
  const configPath = process.argv[2];
  if (!configPath) throw Error('Usage: node scripts/agent-bridge.mjs CONFIG [--live] [--once]');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const live = process.argv.includes('--live');
  const runtime = path.resolve('.agent-runtime');
  fs.mkdirSync(runtime, { recursive: true });
  const lock = path.join(runtime, 'bridge.lock');
  const lockFd = fs.openSync(lock, 'wx');
  fs.writeSync(lockFd, String(process.pid));
  const cleanup = () => { fs.closeSync(lockFd); fs.unlinkSync(lock); };
  process.once('exit', cleanup);
  process.once('SIGINT', () => process.exit(0));
  process.once('SIGTERM', () => process.exit(0));
  const queue = path.join(runtime, live ? 'queue-live' : 'queue-dry');
  fs.mkdirSync(queue, { recursive: true });
  const seenPath = path.join(runtime, live ? 'seen-live.json' : 'seen-dry.json');
  const seen = new Set(fs.existsSync(seenPath) ? JSON.parse(fs.readFileSync(seenPath, 'utf8')) : []);
  const audit = record => {
    const row = { time: new Date().toISOString(), live, ...record };
    fs.appendFileSync(path.join(runtime, 'audit.jsonl'), JSON.stringify(row) + '\n');
    console.log(JSON.stringify(row));
  };
  const api = async (agent, route, body) => {
    const url = new URL(route, agent.url);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw Error('Use a localhost server or SSH tunnel');
    url.searchParams.set('directory', agent.directory);
    const headers = { 'Content-Type': 'application/json' };
    if (agent.passwordEnv) {
      const password = process.env[agent.passwordEnv];
      if (!password) throw Error(`Missing ${agent.passwordEnv}`);
      headers.Authorization = 'Basic ' + Buffer.from(`opencode:${password}`).toString('base64');
    }
    const result = await fetch(url, { method: body ? 'POST' : 'GET', headers,
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
    if (!result.ok) throw Error(`${route}: HTTP ${result.status}`);
    const text = await result.text();
    return text ? JSON.parse(text) : null;
  };
  for (const agent of config.agents) {
    if (!agent.sessionID || !path.isAbsolute(agent.directory)) throw Error('Explicit sessionID and absolute directory required');
    const spec = await api(agent, '/doc');
    for (const kind of ['permission', 'question']) {
      if (!spec.paths?.[`/${kind}`]?.get || !spec.paths?.[`/${kind}/{requestID}/reply`]?.post)
        throw Error('Unsupported OpenCode API; no replies sent');
    }
    const session = await api(agent, `/session/${encodeURIComponent(agent.sessionID)}`);
    if (path.resolve(session.directory).toLowerCase() !== path.resolve(agent.directory).toLowerCase())
      throw Error('Session directory mismatch');
  }
  let reviews = 0;
  const deadline = Date.now() + (config.maxMinutes ?? 60) * 60000;
  audit({ status: 'started', pid: process.pid, agents: config.agents.map(a => a.name),
    deadline: new Date(deadline).toISOString() });
  do {
    for (const agent of config.agents) {
      for (const kind of ['permission', 'question']) {
        const pending = await api(agent, `/${kind}`);
        if (!Array.isArray(pending)) throw Error('Unexpected request list');
        for (const request of pending.filter(r => r.sessionID === agent.sessionID)) {
          const key = `${agent.url}:${agent.directory}:${kind}:${request.id}`;
          if (seen.has(key)) continue;
          let decision = { action: 'human', reason: 'Permission outside automatic allowlist', answers: [] };
          if (kind === 'question' || eligible(request)) {
            if (reviews >= (config.maxReviews ?? 20) || Date.now() >= deadline) throw Error('Review budget reached; remaining requests await human');
            const fingerprint = requestFingerprint(key, request);
            const input = path.join(queue, `${fingerprint}.request.json`);
            const output = path.join(queue, `${fingerprint}.decision.json`);
            if (!fs.existsSync(input)) {
              fs.writeFileSync(input, JSON.stringify({ fingerprint, agent: agent.name,
                directory: agent.directory, kind, request }, null, 2));
              audit({ agent: agent.name, requestID: request.id, status: 'waiting-for-vscode', input });
            }
            if (!fs.existsSync(output)) continue;
            const envelope = JSON.parse(fs.readFileSync(output, 'utf8'));
            if (envelope.fingerprint !== fingerprint) throw Error('Decision fingerprint mismatch');
            decision = envelope.decision;
            if (!validDecision(decision, request, kind)) throw Error('Invalid decision; request remains pending');
            reviews++;
          }
          audit({ agent: agent.name, requestID: request.id, kind, decision, status: 'reviewed' });
          if (live && decision.action !== 'human') {
            const fresh = await api(agent, `/${kind}`);
            const current = fresh.find(r => r.id === request.id && r.sessionID === agent.sessionID);
            if (JSON.stringify(current) !== JSON.stringify(request)) throw Error('Request changed during review; no reply sent');
            await api(agent, `/${kind}/${encodeURIComponent(request.id)}/reply`,
              kind === 'permission' ? { reply: 'once' } : { answers: decision.answers });
            audit({ agent: agent.name, requestID: request.id, status: 'replied' });
          }
          seen.add(key);
          fs.writeFileSync(seenPath, JSON.stringify([...seen]));
        }
      }
    }
    fs.writeFileSync(path.join(runtime, 'status.json'), JSON.stringify({ pid: process.pid,
      updated: new Date().toISOString(), deadline: new Date(deadline).toISOString(),
      live, reviews, agents: config.agents.map(a => ({ name: a.name, sessionID: a.sessionID })) }, null, 2));
    if (process.argv.includes('--once')) break;
    await new Promise(resolve => setTimeout(resolve, 5000));
  } while (Date.now() < deadline);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
