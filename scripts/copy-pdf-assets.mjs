import { cp, mkdir, rm, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageRoot = dirname(require.resolve('pdfjs-dist/package.json'));
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
const assetRoot = join(projectRoot, 'public', 'pdfjs');
const destination = join(assetRoot, version);
await rm(assetRoot, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const folder of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  await cp(join(packageRoot, folder), join(destination, folder), { recursive: true });
}
await cp(join(packageRoot, 'LICENSE'), join(destination, 'LICENSE'));
console.log('PDF-Schriften, CMaps und Decoder sind lokal verfügbar.');
