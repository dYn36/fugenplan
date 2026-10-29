import { spawnSync } from 'node:child_process';

// Netlify's ignore command uses 0 to skip a build and 1 to build.
// Never publish production on an ordinary Git push, including documentation edits.
if (process.env.CONTEXT === 'production') {
  console.log('Automatischer Produktionsbuild übersprungen. Geprüfte Vorschau ausdrücklich veröffentlichen.');
  process.exit(0);
}

const base = process.env.CACHED_COMMIT_REF;
const head = process.env.COMMIT_REF;
if (!base || !head || !/^[a-f0-9]{40,64}$/.test(base) || !/^[a-f0-9]{40,64}$/.test(head)) {
  console.log('Kein gültiger Vergleichsstand vorhanden: Vorschau bauen.');
  process.exit(1);
}
const diff = spawnSync('git', ['diff', '--name-only', base, head, '--',
  'src/', 'public/', 'scripts/', 'index.html', 'package.json', 'package-lock.json',
  'vite.config.ts', 'tsconfig.json', '.nvmrc', 'netlify.toml',
], { encoding: 'utf8' });
if (diff.status !== 0 || diff.stdout.trim()) {
  console.log('Anwendung oder Build geändert: Vorschau bauen.');
  process.exit(1);
}
console.log('Nur Dokumentation oder Tests geändert: Netlify-Build übersprungen. GitHub prüft die Tests.');
