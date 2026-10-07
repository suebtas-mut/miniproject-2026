import fs from 'node:fs';
import path from 'node:path';

export const controllerTests = ['agent-bridge', 'autopilot', 'codex-rescue', 'sprint-roadmap', 'permission-workflow', 'local-test-policy'];

// Check the complete tool invocation, not a shell prefix shown in a permission dialog.
export function authorizedLocalTest(request, context) {
  if (request.permission !== 'bash' || !context?.root || !context?.input?.command) return false;
  try {
    const root = fs.realpathSync(context.root);
    const input = context.input;
    let command = input.command;
    let cwd = fs.realpathSync(input.workdir ? path.resolve(root, input.workdir) : root);
    const candidates = [root, path.join(root, 'backend'), path.join(root, 'app')];
    // Only exact literal paths generated from this configured workspace are accepted.
    for (const target of candidates) {
      for (const spelling of [target, target.replaceAll('\\', '/')]) {
        if (spelling.includes("'")) continue;
        const prefix = `Set-Location -LiteralPath '${spelling}'; `;
        if (command.startsWith(prefix)) { cwd = fs.realpathSync(target); command = command.slice(prefix.length); }
      }
    }
    const same = target => fs.existsSync(target) && cwd.toLowerCase() === fs.realpathSync(target).toLowerCase();
    const inside = target => {
      const relative = path.relative(root, fs.realpathSync(target));
      return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
    };
    if (!inside(cwd)) return false;
    if (same(path.join(root, 'backend')) && ['npm.cmd test -- --runInBand', 'npm test -- --runInBand'].includes(command)) {
      const file = path.join(cwd, 'package.json');
      if (!inside(file)) return false;
      const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
      return pkg.scripts?.test === 'jest' && !Object.hasOwn(pkg.scripts, 'pretest') && !Object.hasOwn(pkg.scripts, 'posttest');
    }
    if (same(path.join(root, 'app')) && ['flutter test --no-pub', 'flutter analyze --no-pub'].includes(command)) return true;
    if (same(root)) {
      const allowed = controllerTests.map(n => `scripts/${n}.test.mjs`);
      if (!command.startsWith('node --test ')) return false;
      const files = command.slice('node --test '.length).split(' ');
      return files.length > 0 && files.every(f => allowed.includes(f) && inside(path.join(root, f)));
    }
  } catch { return false; }
  return false;
}
