import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
let repositoryRoot;

// Report categories and locations only. Never print a matching value.
const detectors = [
  ['clave privada', /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/g],
  ['token GitHub', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/g],
  ['token GitLab', /\bglpat-[A-Za-z0-9_-]{20,}\b/g],
  ['clave OpenAI', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/g],
  ['clave Supabase', /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{20,}\b/g],
  ['clave AWS', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['token npm', /\bnpm_[A-Za-z0-9]{30,}\b/g],
  ['token Slack', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g],
  ['token JWT', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g],
  [
    'conexión con contraseña',
    /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s:'"<>]+:[^@\s'"<>]+@[^\s'"<>]+/gi,
  ],
  [
    'credencial literal',
    /\b(?:password|passwd|client_secret|api[_-]?key|access[_-]?token|secret[_-]?key|service_role[_-]?key)\b["']?\s*[:=]\s*["']([^\s"']{8,})["']/gi,
  ],
  ['token Bearer literal', /\bBearer\s+[A-Za-z0-9_.-]{24,}/g],
  ['token de registro npm', /_authToken\s*=\s*[A-Za-z0-9_-]{16,}/g],
  [
    'credencial de entorno literal',
    /^[ \t]*(?:export[ \t]+)?(?:[A-Z][A-Z0-9_]*(?:PASSWORD|SECRET|TOKEN|API_KEY)|PASSWORD|SECRET|TOKEN|API_KEY)[ \t]*=[ \t]*([^$\s"'][^\s"']{7,})[ \t]*$/gm,
  ],
];

export function sensitivePath(path, history = false) {
  const name = path.replaceAll('\\', '/');
  if (/(^|\/)\.env(?:$|\.)/.test(name) && !/(^|\/)\.env\.example$/.test(name)) return true;
  if (/(^|\/)(?:\.envrc|\.npmrc|\.netrc|\.pypirc|\.git-credentials)$/.test(name)) return true;
  if (/(^|\/)(?:id_rsa|id_ed25519|id_ecdsa)$|(^|\/)(?:\.ssh|\.aws)\//.test(name)) return true;
  if (/\.(?:pem|key|p12|pfx|dump|backup|sqlite3?|db)$/i.test(name)) return true;
  if (
    /(^|\/)(?:credentials[^/]*|service-account[^/]*|auth-state[^/]*|storage-state[^/]*)\.json$/i.test(
      name,
    )
  )
    return true;
  if (
    /(^|\/)(?:\.auth|backups)\/|(^|\/)supabase\/\.(?:temp|branches)\/|(^|\/)\.vscode\/mcp\.json$/.test(
      name,
    )
  )
    return true;
  // An empty generated config existed in the first commits. Content is still scanned in history.
  return !history && /(^|\/)public\/config(?:\.local)?\.json$/.test(name);
}

export function scanText(text) {
  const findings = [];
  for (const [category, regex] of detectors) {
    regex.lastIndex = 0;
    for (const match of text.matchAll(regex)) {
      const value = match[1] ?? match[0];
      if (/^(?:\$\{|your[-_]|example|placeholder|TU_|REPLACE_|CHANGE_ME)/i.test(value)) continue;
      findings.push({ category, line: text.slice(0, match.index).split('\n').length });
    }
  }
  return findings;
}

function git(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: repositoryRoot,
    maxBuffer: 128 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) throw new Error('No se pudo completar una lectura local de Git.');
  return result.stdout;
}

function scanBatch(objects, report) {
  if (!objects.size) return;
  const output = git(['cat-file', '--batch'], { input: [...objects.keys()].join('\n') + '\n' });
  let offset = 0;
  while (offset < output.length) {
    const end = output.indexOf(10, offset);
    const [oid, type, rawSize] = output.subarray(offset, end).toString('utf8').split(' ');
    const size = Number(rawSize);
    if (!Number.isFinite(size)) throw new Error('Git devolvió un objeto no disponible.');
    const content = output.subarray(end + 1, end + 1 + size);
    offset = end + size + 2;
    if (type === 'blob' && !content.subarray(0, 8192).includes(0)) {
      for (const path of objects.get(oid) ?? [oid]) report(path, content.toString('utf8'));
    }
  }
}

export function auditRepository(args = process.argv.slice(2)) {
  const root = git(['rev-parse', '--show-toplevel']).toString('utf8').trim();
  repositoryRoot = root;
  const findings = [];
  const seen = new Set();
  const counts = { currentFiles: 0, historicalObjects: 0, historicalPaths: 0 };
  const record = (scope, path, category, line = 0) => {
    const key = JSON.stringify([scope, path, category, line]);
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ scope, path, category, line });
  };
  const inspect = (scope, path, text) => {
    for (const hit of scanText(text)) record(scope, path, hit.category, hit.line);
  };

  if (args.includes('--staged')) {
    const objects = new Map();
    const entries = git(['ls-files', '--stage', '-z']).toString('utf8').split('\0').filter(Boolean);
    for (const entry of entries) {
      const split = entry.indexOf('\t');
      const [, oid, stage] = entry.slice(0, split).split(' ');
      const path = entry.slice(split + 1);
      if (stage !== '0') throw new Error('Resuelve los conflictos antes de auditar.');
      counts.currentFiles++;
      if (sensitivePath(path)) record('índice', path, 'archivo confidencial o generado');
      objects.set(oid, [...(objects.get(oid) ?? []), path]);
    }
    scanBatch(objects, (path, text) => inspect('índice', path, text));
  } else {
    const files = new Set(
      git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
        .toString('utf8')
        .split('\0')
        .filter(Boolean),
    );
    for (const path of files) {
      const absolute = resolve(root, path);
      if (!existsSync(absolute)) continue;
      counts.currentFiles++;
      if (sensitivePath(path)) record('archivos actuales', path, 'archivo confidencial o generado');
      if (!lstatSync(absolute).isFile()) continue;
      const content = readFileSync(absolute);
      if (!content.subarray(0, 8192).includes(0))
        inspect('archivos actuales', path, content.toString('utf8'));
    }
  }

  if (args.includes('--history')) {
    const paths = new Set(
      git(['log', '--all', '--format=', '--name-only', '-z'])
        .toString('utf8')
        .split('\0')
        .map((path) => path.replace(/^\n+/, ''))
        .filter(Boolean),
    );
    counts.historicalPaths = paths.size;
    for (const path of paths)
      if (sensitivePath(path, true)) record('historial', path, 'archivo confidencial en un commit');
    const objects = new Map();
    for (const line of git(['-c', 'core.quotePath=false', 'rev-list', '--objects', '--all'])
      .toString('utf8')
      .trim()
      .split('\n')
      .filter(Boolean)) {
      const split = line.indexOf(' ');
      const oid = split < 0 ? line : line.slice(0, split);
      const path = split < 0 ? oid : line.slice(split + 1);
      objects.set(oid, [path]);
    }
    counts.historicalObjects = objects.size;
    scanBatch(objects, (path, text) => inspect('historial', path, text));
  }

  // A remote URL can contain a token even if no tracked file does.
  const remotes = spawnSync('git', ['config', '--get-regexp', '^remote\\..*\\.url$'], {
    cwd: root,
    encoding: 'utf8',
  });
  for (const line of (remotes.stdout ?? '').split('\n')) {
    if (/https?:\/\/[^/\s]+@/.test(line))
      record('configuración Git', line.split(' ')[0], 'credencial en URL remota');
  }
  return { counts, findings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { counts, findings } = auditRepository();
    process.stdout.write(
      `Revisados ${counts.currentFiles} archivos actuales; ${counts.historicalObjects} objetos y ${counts.historicalPaths} rutas del historial.\n`,
    );
    for (const hit of findings)
      process.stdout.write(
        `REVISAR [${hit.scope}] ${hit.path}${hit.line ? ':' + hit.line : ''} — ${hit.category}\n`,
      );
    if (findings.length) {
      process.stderr.write(
        'Se detuvo la operación. Revisa las coincidencias sin publicar sus valores.\n',
      );
      process.exitCode = 1;
    } else
      process.stdout.write(
        'Sin coincidencias de credenciales ni archivos confidenciales versionados.\n',
      );
  } catch {
    process.stderr.write(
      'La auditoría no pudo completarse; la operación se detiene por precaución.\n',
    );
    process.exitCode = 1;
  }
}
