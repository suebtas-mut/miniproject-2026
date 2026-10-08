import fs from 'node:fs';
const base = 'http://127.0.0.1:4097';
export const localAgent = {
  description: 'Bounded local coding worker', mode: 'primary', steps: 8,
  prompt: 'You are a coding worker. Use actual tools to read and edit files. For each tool call emit a JSON object with name and arguments inside <tool_call></tool_call>, without markdown fences. Never print JSON as a substitute for calling a tool. Read files before edits. Run the requested test. Stop after reporting actual results.',
  tools: { '*': false, read: true, edit: true, write: true, bash: true, glob: true, grep: true },
};
const api = async (route, body, method = 'POST') => {
  const r = await fetch(base + route, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw Error(`${r.status}: ${await r.text()}`);
  const text = await r.text(); return text ? JSON.parse(text) : null;
};
await api('/config', { agent: { 'local-fallback': localAgent } }, 'PATCH');
const session = await api('/session', { title: 'Strict local tool-use acceptance' });
fs.writeFileSync('.agent-runtime/ollama-smoke-session.txt', session.id);
await api(`/session/${session.id}/prompt_async`, {
  agent: 'local-fallback', model: { providerID: 'ollama-local', modelID: 'shuttle-coder:latest' },
  parts: [{ type: 'text', text: 'Read sum.js and test.js using read. Fix sum.js to add a and b using edit. Run node test.js using bash. Do not change test.js.' }],
});
console.log(session.id);
