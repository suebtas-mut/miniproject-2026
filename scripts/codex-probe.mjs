import fs from 'node:fs';
import { AppServer, rescue } from './codex-rescue.mjs';
const config = JSON.parse(fs.readFileSync('.agent-runtime/config.json', 'utf8'));
const executable = config.codexRescue.executable;
if (process.argv.includes('--smoke')) {
  const result = await rescue({ executable, cwd: process.cwd(), model: config.codexRescue.model,
    scope: 'Connectivity smoke test only. Do not use tools or change files. Reply exactly CODEX_RESCUE_READY.',
    evidence: 'No task diagnostics. This checks authorized account inference.', readOnly: true, timeoutMs: 90000 });
  console.log(JSON.stringify(result));
  if (result.status !== 'completed' || !result.text.includes('CODEX_RESCUE_READY')) process.exitCode = 1;
} else {
  const client = new AppServer(executable, process.cwd());
  try {
    await client.initialize();
    const account = await client.rpc('account/read', { refreshToken: false });
    console.log(JSON.stringify({ authenticated: !!account.account, type: account.account?.type }));
    const models = await client.rpc('model/list', {});
    console.log(JSON.stringify(models.data.map(m => ({ id: m.id, model: m.model, isDefault: m.isDefault }))));
  } finally { await client.close(); }
}
