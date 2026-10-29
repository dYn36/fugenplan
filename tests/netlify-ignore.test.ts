import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, expect, test } from 'vitest';

const root = mkdtempSync(join(tmpdir(), 'fugenplan-build-guard-'));
const script = resolve('scripts/netlify-ignore.mjs');
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
git('init', '-q'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
writeFileSync(join(root, 'README.md'), 'Start'); git('add', '.'); git('commit', '-qm', 'Start');
const base = git('rev-parse', 'HEAD');
writeFileSync(join(root, 'README.md'), 'Dokumentation'); git('add', '.'); git('commit', '-qm', 'Dokumentation');
const docs = git('rev-parse', 'HEAD');
writeFileSync(join(root, 'netlify.toml'), '[build]'); git('add', '.'); git('commit', '-qm', 'Build');
const build = git('rev-parse', 'HEAD');
const run = (context: string, from = base, to = build) => spawnSync(process.execPath, [script], {
  cwd: root, env: { ...process.env, CONTEXT: context, CACHED_COMMIT_REF: from, COMMIT_REF: to }, encoding: 'utf8',
}).status;
afterAll(() => rmSync(root, { recursive: true, force: true }));

test('Git-Push veröffentlicht auch bei geändertem Build keine Produktion', () => expect(run('production')).toBe(0));
test('Dokumentation allein benötigt keinen Netlify-Build', () => expect(run('branch-deploy', base, docs)).toBe(0));
test('Geänderte Build-Konfiguration wird in einer Vorschau geprüft', () => expect(run('branch-deploy')).toBe(1));
test('Erste Vorschau und unbekannte Vergleichsstände werden gebaut', () => {
  expect(run('deploy-preview', '', '')).toBe(1);
  expect(run('deploy-preview', 'a'.repeat(40))).toBe(1);
  expect(run('deploy-preview', '--help')).toBe(1);
});
