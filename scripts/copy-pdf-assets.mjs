import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageRoot = dirname(require.resolve('pdfjs-dist/package.json'));
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = join(projectRoot, 'public', 'pdfjs');
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const folder of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  await cp(join(packageRoot, folder), join(destination, folder), { recursive: true });
}
await cp(join(packageRoot, 'LICENSE'), join(destination, 'LICENSE'));
console.log('PDF-Schriften, CMaps und Decoder sind lokal verfügbar.');
