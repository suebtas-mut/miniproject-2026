import fs from 'node:fs';

const config = JSON.parse(fs.readFileSync('.agent-runtime/config.json', 'utf8'));
const models = ['nemotron-3.5-lightning-free', 'mimo-v2.6-flash-free', 'nemotron-3-ultra-free'];
const state = new Map(config.agents.map(a => [a.name, { index: 0, handled: new Set(), messages: new Set() }]));
const started = Date.now();
const audit = value => fs.appendFileSync('.agent-runtime/free-model-watch.jsonl',
  JSON.stringify({ time: new Date().toISOString(), ...value }) + '\n');
async function api(a, route, body) {
  const url = new URL(route, a.url);
  url.searchParams.set('directory', a.directory);
  const res = await fetch(url, { method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw Error(`HTTP ${res.status} ${route}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
// Record only usage for messages generated after this watcher starts, not historical session totals.
audit({ event: 'started', pid: process.pid, models, durationMinutes: 60 });
while (Date.now() - started < 3600000) {
  for (const a of config.agents) {
    const s = state.get(a.name);
    try {
      const statuses = await api(a, '/session/status');
      const messages = await api(a, `/session/${a.sessionID}/message?limit=8`);
      for (const m of messages) {
        if (m.info.role !== 'assistant' || !m.info.time?.completed ||
            m.info.time.created < started || s.messages.has(m.info.id)) continue;
        s.messages.add(m.info.id);
        audit({ event: 'usage', agent: a.name, messageID: m.info.id,
          model: m.info.modelID, provider: m.info.providerID, tokens: m.info.tokens, cost: m.info.cost });
      }
      const latest = messages.filter(m => m.info.role === 'assistant').at(-1);
      const activeIndex = models.indexOf(latest?.info.modelID);
      if (activeIndex > s.index) s.index = activeIndex;
      const retry = statuses[a.sessionID]?.type === 'retry' ? statuses[a.sessionID] : null;
      const error = latest?.info.error ?? retry;
      const signature = latest?.info.id + ':' + JSON.stringify(error);
      if (!error || s.handled.has(signature)) continue;
      const message = JSON.stringify(error);
      if (!/429|rate.?limit|quota|credit|insufficient|exhausted/i.test(message)) continue;
      s.handled.add(signature);
      if (s.index >= models.length - 1) {
        await api(a, `/session/${a.sessionID}/abort`, {});
        audit({ event: 'free-models-exhausted', agent: a.name });
        continue;
      }
      const providers = await api(a, '/provider');
      const next = models[s.index + 1];
      const model = providers.all.find(p => p.id === 'opencode')?.models[next];
      const cost = model?.cost;
      if (!cost || cost.input !== 0 || cost.output !== 0 ||
          Object.values(cost.cache ?? {}).some(n => n !== 0)) {
        await api(a, `/session/${a.sessionID}/abort`, {});
        audit({ event: 'stopped-unverified-price', agent: a.name, model: next });
        continue;
      }
      await api(a, `/session/${a.sessionID}/abort`, {});
      // Abort must finish before resuming; never run two turns on the same session.
      const after = await api(a, '/session/status');
      if (after[a.sessionID] && after[a.sessionID].type !== 'idle') {
        audit({ event: 'abort-not-idle', agent: a.name });
        continue;
      }
      s.index++;
      await api(a, `/session/${a.sessionID}/prompt_async`, {
        model: { providerID: 'opencode', modelID: next }, agent: 'build', tools: { task: false },
        parts: [{ type: 'text', text: 'Previous free model reached a quota/rate limit. Resume the assigned Sprint 3 task from existing files and tool results; inspect unfinished operations before retrying. Preserve dirty work. Same scope and human escalation rules. No paid models, OpenAI/ChatGPT/openchat, or subagents. Keep output concise. Finish with actual tests and handoff.' }],
      });
      audit({ event: 'free-fallback', agent: a.name, model: next });
    } catch (e) { audit({ event: 'monitor-error', agent: a.name, error: e.message }); }
  }
  await new Promise(resolve => setTimeout(resolve, 15000));
}
audit({ event: 'monitor-finished' });
