import fs from 'node:fs';
import path from 'node:path';

// A deliberately small read-only PowerShell grammar, never shell-prefix matching.
export function sdkReadPath(command) {
  if (typeof command !== 'string' || command.length > 1600) return null;
  // Expand only this one known environment variable; reject arbitrary interpolation.
  command = command.replace(/Get-Content "\$env:LOCALAPPDATA(\\[a-zA-Z0-9_ .\\/-]+\.dart)"/g, (match, suffix) => {
    const base = process.env.LOCALAPPDATA;
    return base && !/[\r\n'$`]/.test(base) ? `Get-Content '${base}${suffix}'` : match;
  });
  const direct = /^Get-Content(?: -LiteralPath)? '([^'\r\n]+\.dart)'(?: \| Select-Object -Skip (\d{1,5}) -First (\d{1,3}))?$/.exec(command);
  if (direct) return direct[1];
  const parts = command.split('; ');
  const first = /^\$([a-zA-Z][a-zA-Z0-9]*) = Get-Content(?: -LiteralPath)? '([^'\r\n]+\.dart)'$/.exec(parts.shift());
  if (!first || !parts.length || parts.length > 7) return null;
  let ranges = 0;
  for (const part of parts) {
    if (/^Write-Output '[a-zA-Z0-9 _-]{1,80}'$/.test(part)) continue;
    const range = /^\$([a-zA-Z][a-zA-Z0-9]*)\[(\d{1,5})\.\.(\d{1,5})\]$/.exec(part);
    if (!range || range[1] !== first[1] || +range[3] < +range[2] || +range[3] - +range[2] > 500) return null;
    ranges++;
  }
  return ranges ? first[2] : null;
}

export function authorizedSdkRead(request, context) {
  const roots = [context?.sdkSourceRoot, ...(context?.dependencySourceRoots ?? [])].filter(Boolean);
  return roots.some(root => authorizedSourceRead(request, { ...context, sdkSourceRoot: root }));
}

function authorizedSourceRead(request, context) {
  if (!['external_directory', 'bash', 'read'].includes(request.permission) || !context?.sdkSourceRoot) return false;
  const input = context.input;
  const file = context.tool === 'read' ? input?.filePath : context.tool === 'bash' ? sdkReadPath(input?.command) : null;
  if (!file || !path.isAbsolute(file) || !/\.dart$/i.test(file)) return false;
  try {
    const root = fs.realpathSync(context.sdkSourceRoot);
    const target = fs.realpathSync(file);
    const relative = path.relative(root, target);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !fs.statSync(target).isFile()) return false;
    // The SDK root and file must not redirect to another tree through a junction.
    if (path.resolve(context.sdkSourceRoot).toLowerCase() !== root.toLowerCase() || path.resolve(file).toLowerCase() !== target.toLowerCase()) return false;
    if (request.permission === 'external_directory') {
      const expected = path.join(path.dirname(file), '*').toLowerCase();
      if (!request.patterns?.length || !request.patterns.every(p => path.normalize(p).toLowerCase() === expected)) return false;
    }
    return true;
  } catch { return false; }
}
