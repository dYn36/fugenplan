import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { DEFAULT_PROJECT } from '../src/lib/project';
import { createProject, createFloor } from './helpers';

test('Netlify liefert Schutzregeln, Cache-Regeln und echte 404-Antworten', async ({ request }) => {
  const response = await request.get('/');
  expect(response.status()).toBe(200);
  expect(response.url()).toMatch(/^https:\/\//);
  const headers = response.headers();
  const csp = headers['content-security-policy'];
  expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
  for (const rule of ["object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "connect-src 'self'", "form-action 'none'"]) expect(csp).toContain(rule);
  expect(csp).toContain("style-src 'self';");
  expect(csp).toContain("style-src-attr 'unsafe-inline';");
  expect(csp.split(';').find(rule => rule.trim().startsWith('script-src '))).not.toContain("'unsafe-inline'");
  expect(csp).not.toContain("'unsafe-eval'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('no-referrer');
  expect(headers['strict-transport-security']).toContain('max-age=31536000');
  expect(headers['cache-control']).toContain('max-age=0');
  const html = await response.text();
  const script = html.match(/<script[^>]+src="([^"]+)"/)!;
  expect(script).not.toBeNull();
  const asset = await request.get(script[1]);
  expect(asset.status()).toBe(200);
  expect(asset.headers()['content-type']).toMatch(/javascript/);
  expect(asset.headers()['cache-control']).toContain('immutable');
  for (const path of ['/.env', '/.git/config', '/src/App.tsx', '/tests/fixtures/grundriss-drei-seiten.pdf', '/assets/fehlt.js', '/pdfjs/fehlt.wasm']) {
    const missing = await request.get(path);
    expect(missing.status(), path).toBe(404);
    expect(await missing.text()).not.toContain('<div id="root">');
  }
  const licenses = await request.get('/third-party-licenses.txt');
  expect(licenses.status()).toBe(200);
  expect(await licenses.text()).toContain('SIL OPEN FONT LICENSE');
});

test('Importierte Namen bleiben Text in Oberfläche, SVG und Druck', async ({ page }, info) => {
  const attack = '<img src=x onerror=alert(1)>';
  const dialogs: string[] = [];
  page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  await page.goto('/');
  await page.getByLabel('Projektdatei öffnen', { exact: true }).setInputFiles({
    name: 'sicherheitsprobe.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...DEFAULT_PROJECT, name: attack, ['__proto__']: { polluted: true } })),
  });
  await page.getByRole('button', { name: 'Raumplan', exact: true }).click();
  await expect(page.getByRole('heading', { name: attack, exact: true })).toBeVisible();
  await expect(page.getByTestId('floor-plan').locator('[data-piece]').first()).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await expect(page.locator('.print-drawing svg title')).toContainText(attack);
  await expect(page.locator('.print-drawing script, .print-drawing img')).toHaveCount(0);
  await page.getByRole('button', { name: 'Exportieren', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Plan als SVG/ }).click();
  const download = await downloadPromise;
  const svg = await readFile((await download.path())!, 'utf8');
  expect(svg).toContain('&lt;img src=x onerror=alert(1)&gt;');
  expect(svg).not.toContain('<img');
  expect(dialogs).toEqual([]);
  expect(await page.evaluate(() => Object.hasOwn(Object.prototype, 'polluted'))).toBe(false);
  await info.attach('Namen als Text', { body: await page.screenshot(), contentType: 'image/png' });
});

test('PDF-Import funktioniert unter CSP ohne externe Anfragen oder Laufzeitfehler', async ({ page }, info) => {
  const errors: string[] = [];
  const requests: { url: string; method: string }[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.context().on('request', request => requests.push({ url: request.url(), method: request.method() }));
  await page.addInitScript(() => {
    const violations: unknown[] = [];
    Object.assign(window, { cspViolations: violations });
    document.addEventListener('securitypolicyviolation', event => violations.push({
      directive: event.effectiveDirective, blockedURI: event.blockedURI,
      sourceFile: event.sourceFile, lineNumber: event.lineNumber, sample: event.sample,
    }));
  });
  await page.goto('/');
  await createProject(page, 'Hosting-Prüfung');
  await createFloor(page, 'Erdgeschoss');
  await page.getByRole('button', { name: 'Grundriss', exact: true }).click();
  await page.getByLabel('PDF-Grundriss öffnen', { exact: true }).setInputFiles('tests/fixtures/grundriss-drei-seiten.pdf');
  await expect(page.getByTestId('pdf-overlay')).toBeVisible();
  await expect.poll(() => page.getByTestId('pdf-canvas').evaluate((canvas: HTMLCanvasElement) => {
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let dark = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 100 && pixels[i + 3] > 0) dark++;
    return dark;
  })).toBeGreaterThan(100);
  await info.attach('CSP-Ereignisse', { body: JSON.stringify(await page.evaluate(() => Reflect.get(window, 'cspViolations'))), contentType: 'application/json' });
  expect(requests.some(request => request.url.includes('pdf.worker'))).toBe(true);
  expect(requests.filter(request => /^https?:/.test(request.url)).every(request => new URL(request.url).origin === new URL(page.url()).origin)).toBe(true);
  expect(requests.filter(request => request.method !== 'GET')).toEqual([]);
  expect(errors).toEqual([]);
  await info.attach('PDF unter CSP', { body: await page.screenshot(), contentType: 'image/png' });
});
