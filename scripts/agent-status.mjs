import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = path.join(root, '.agent-runtime');
const read = name => JSON.parse(fs.readFileSync(path.join(runtime, name), 'utf8').replace(/^\uFEFF/, ''));
const config = read('config.json'), state = read('autopilot-state.json');
console.log(`Automatic Codex: ${config.codexRescue.enabled}; supervisor stopped: ${state.stopped ?? 'no stop recorded'}`);
for (const a of config.agents) {
  const worker = state.agents[a.name];
  const sessionID = worker.localSessionID ?? a.sessionID;
  try {
    const get = async route => {
      const u = new URL(route, a.url); u.searchParams.set('directory', a.directory);
      const r = await fetch(u, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) throw Error(`HTTP ${r.status}`); return r.json();
    };
    const [status, permissions] = await Promise.all([get('/session/status'), get('/permission')]);
    console.log(`${a.name}: Sprint ${4 + worker.stageIndex}, ${status[sessionID]?.type ?? 'idle'}, phase ${worker.phase}, pending permissions ${permissions.filter(p => p.sessionID === sessionID).length}${worker.localSessionID ? ', local fallback session ' + sessionID : ''}`);
  } catch (e) { console.log(`${a.name}: ${e.message}`); }
}
console.log('Local status only. No AI inference requested.');
