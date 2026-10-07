import { eligible, requestFingerprint } from './agent-bridge.mjs';

export function permissionPlan(request) {
  if (eligible(request)) return { action: 'once', level: 'policy', reason: 'Exact authorized read-only Git command', advise: false };
  const patterns = Array.isArray(request.patterns) ? request.patterns : [];
  const text = patterns.join('\n');
  if (request.permission === 'read' && patterns.some(p => /(?:^|[\\/])(?:\.env(?:\.(?!example$|sample$|template$)[^\\/]+)?|id_rsa|id_ed25519|[^\\/]+\.(?:pem|key|p12|pfx))$/i.test(p)))
    return { action: 'reject', level: 'policy', reason: 'Do not send secret files to model context; use examples or injected test configuration', advise: false };
  if (request.permission === 'external_directory' || /(?:remove-item|rm\s|del\s|drop\s|truncate\s|reset\s+--hard|clean\s+-|push|merge|deploy|publish|credential|billing|payment)/i.test(text))
    return { action: 'human', level: 'human', reason: 'External path or potentially consequential operation requires concrete human review', advise: false };
  return { action: 'human', level: 'ollama-advisory', reason: 'Outside the fixed automatic permission policy; AI may suggest an alternative but cannot grant authority', advise: true };
}

// Do not pass raw commands, file contents or potential embedded credentials to AI.
export function permissionAdvicePrompt(request) {
  const kind = ['read', 'edit', 'bash', 'glob', 'grep'].includes(request.permission) ? request.permission : 'other';
  return `An OpenCode worker has a pending ${kind} permission outside a fixed automatic allowlist. Suggest a brief way to continue the coding task with existing workspace files, mocks or smaller reviewable operations. Do not approve the request, change permission settings, ask for secrets, or propose bypassing a sandbox. This is advice only; the request remains pending for a human.`;
}

export async function routePermission({ agent, request, readFresh, reply, advise, getRecord, putRecord }) {
  const fingerprint = requestFingerprint(agent, request);
  const prior = await getRecord(fingerprint);
  if (prior?.delivered || prior?.plan.action === 'human') return prior;
  const record = prior ?? { fingerprint, agent, requestID: request.id, plan: permissionPlan(request), created: new Date().toISOString() };
  if (!prior) {
    // Durable reservation before inference: restart must not invoke advice again.
    record.adviceStatus = record.plan.advise ? 'reserved' : 'not-needed';
    await putRecord(fingerprint, record);
    if (record.plan.advise) {
      try { record.advice = await advise(permissionAdvicePrompt(request)); record.adviceStatus = 'completed'; }
      catch { record.adviceStatus = 'unavailable'; }
      await putRecord(fingerprint, record);
    }
  }
  if (record.plan.action === 'human') return record;
  const fresh = await readFresh();
  if (!fresh || requestFingerprint(agent, fresh) !== fingerprint) return { ...record, stale: true };
  await reply(record.plan.action);
  record.delivered = true;
  await putRecord(fingerprint, record);
  return record;
}
