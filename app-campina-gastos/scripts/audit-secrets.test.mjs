import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanText, sensitivePath } from './audit-secrets.mjs';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

test('reconoce claves y conexiones sin devolver sus valores', () => {
  const samples = [
    'sk-proj-' + 'a'.repeat(40),
    'sb_secret_' + 'b'.repeat(30),
    'ghp_' + 'c'.repeat(40),
    ['-----BEGIN', 'PRIVATE KEY-----'].join(' '),
    ['postgresql://usuario:', 'clave_de_prueba', '@localhost/db'].join(''),
    'password="' + 'd'.repeat(12) + '"',
  ];
  for (const value of samples) {
    const hits = scanText(value);
    assert.ok(hits.length > 0);
    assert.equal(JSON.stringify(hits).includes(value), false);
  }
});
test('bloquea nombres sensibles incluso si se fuerzan con git add', () => {
  for (const path of [
    '.env',
    'app/.env.production',
    'app/.npmrc',
    'certs/private.pem',
    'supabase/.temp/pooler-url',
    'app/public/config.json',
    'app/.vscode/mcp.json',
  ])
    assert.equal(sensitivePath(path), true);
  for (const path of ['app/.env.example', 'supabase/config.toml', 'src/app/core/auth.ts'])
    assert.equal(sensitivePath(path), false);
});
test('no confunde el ejemplo público ni los hashes del lockfile con claves', () => {
  assert.deepEqual(scanText('SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key'), []);
  assert.deepEqual(scanText('"integrity": "sha512-' + 'x'.repeat(90) + '"'), []);
});

test('audita desde una subcarpeta y detecta un .env eliminado en commits anteriores', () => {
  const folder = mkdtempSync(join(tmpdir(), 'campina-security-'));
  const script = fileURLToPath(new URL('./audit-secrets.mjs', import.meta.url));
  const runGit = (...args) => {
    const result = spawnSync(
      'git',
      [
        '-c',
        'core.hooksPath=',
        '-c',
        'commit.gpgSign=false',
        '-c',
        'user.name=Security Test',
        '-c',
        'user.email=security@example.test',
        ...args,
      ],
      { cwd: folder },
    );
    assert.equal(result.status, 0, result.stderr?.toString('utf8'));
  };
  try {
    runGit('init');
    mkdirSync(join(folder, 'app'));
    writeFileSync(join(folder, 'app', 'safe.txt'), 'Archivo sin credenciales.');
    writeFileSync(join(folder, '.env'), ['PASSWORD=', 'x'.repeat(16)].join(''));
    runGit('add', '.');
    runGit('commit', '-m', 'Test initial snapshot');
    unlinkSync(join(folder, '.env'));
    runGit('add', '-u');
    runGit('commit', '-m', 'Test remove env');
    const current = spawnSync(process.execPath, [script], {
      cwd: join(folder, 'app'),
      encoding: 'utf8',
    });
    assert.equal(current.status, 0);
    assert.match(current.stdout, /Revisados 1 archivos actuales/);
    const history = spawnSync(process.execPath, [script, '--history'], {
      cwd: join(folder, 'app'),
      encoding: 'utf8',
    });
    assert.equal(history.status, 1);
    assert.match(history.stdout, /historial.*\.env/);
    assert.equal(history.stdout.includes('x'.repeat(16)), false);
    writeFileSync(join(folder, 'app', '.env.production'), 'LOCAL_ONLY=true');
    runGit('add', '.');
    const staged = spawnSync(process.execPath, [script, '--staged'], {
      cwd: join(folder, 'app'),
      encoding: 'utf8',
    });
    assert.equal(staged.status, 1);
    assert.match(staged.stdout, /índice.*\.env.production/);
  } finally {
    const target = resolve(folder);
    assert.ok(
      target.startsWith(resolve(tmpdir()) + sep) &&
        basename(target).startsWith('campina-security-'),
    );
    rmSync(target, { recursive: true, force: true });
  }
});
