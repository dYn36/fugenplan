import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import type { BuildingFile } from '../src/floorplan-types';
import { createFloor, createProject, storedBuilding, storedWorkspace } from './helpers';

const groundPdf = await readFile(new URL('./fixtures/grundriss-drei-seiten.pdf', import.meta.url));
const upperPdf = Buffer.concat([groundPdf, Buffer.from('\n% Zweite PDF fuer den Neustart-Test\n')]);
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

async function pdfPoint(page: Page, x: number, y: number) {
  const precise = page.locator('details.fpdf-precise');
  if (await precise.getAttribute('open') === null) await precise.locator('summary').click();
  await page.getByRole('textbox', { name: 'X auf Seite', exact: true }).fill(String(x));
  await page.getByRole('textbox', { name: 'Y auf Seite', exact: true }).fill(String(y));
  await page.getByRole('button', { name: 'Punkt setzen', exact: true }).click();
}

async function importFloorPdf(page: Page, bytes: Buffer, name: string) {
  await page.getByRole('button', { name: 'PDF-Grundriss laden', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'PDF auswählen', exact: true }).click();
  await (await chooser).setFiles({ name: `${name}.pdf`, mimeType: 'application/pdf', buffer: bytes });
  await expect(page.getByTestId('pdf-overlay')).toBeVisible();
  await page.getByRole('button', { name: 'Seite verwenden', exact: true }).click();
  await page.getByRole('button', { name: 'Wand markieren', exact: true }).click();
  // Known fixture: 240 PDF units correspond to a 480 cm wall on a 600 x 400 page.
  await pdfPoint(page, 10, 17.5);
  await pdfPoint(page, 50, 17.5);
  await page.getByRole('textbox', { name: 'Länge der Wand', exact: true }).fill('480');
  await page.getByRole('button', { name: 'Maßstab speichern', exact: true }).click();
  await page.getByRole('button', { name: 'Raum markieren', exact: true }).click();
  await page.getByRole('textbox', { name: 'Raumname', exact: true }).fill(name);
  await expect(page.getByRole('textbox', { name: 'Raumname', exact: true })).toHaveValue(name);
  for (const [x, y] of [[10, 17.5], [50, 17.5], [50, 82.5], [10, 82.5]]) await pdfPoint(page, x, y);
  await page.getByRole('button', { name: 'Raum übernehmen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Raum übernommen', exact: true })).toBeVisible();
  await expect.poll(async () => (await storedWorkspace(page)).rooms[0]?.project.name).toBe(name);
  await page.getByRole('button', { name: 'Zur Etagenansicht', exact: true }).click();
}

async function storedPdf(page: Page, id: string) {
  return page.evaluate(async key => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('fugenplan-pdf-v1');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const value = await new Promise<unknown>((resolve, reject) => {
        const request = db.transaction('documents', 'readonly').objectStore('documents').get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (!(value instanceof ArrayBuffer) && !(value instanceof Uint8Array)) return null;
      const bytes = new Uint8Array(value);
      const hash = await crypto.subtle.digest('SHA-256', bytes.buffer);
      return { length: bytes.byteLength, hash: Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('') };
    } finally { db.close(); }
  }, id);
}

for (const migrateLegacy of [false, true]) {
  test(`Original-PDFs überstehen Neuladen und vollständigen Browser-Neustart ${migrateLegacy ? 'mit Übernahme aus Version 2' : 'mit zwei Etagen'}`, { tag: migrateLegacy ? [] : ['@smoke'] }, async ({ playwright, browserName, baseURL }, info) => {
    test.setTimeout(90_000);
    const profile = await mkdtemp(join(tmpdir(), `fugenplan-pdf-${info.project.name}-`));
    const errors: string[] = [];
    let context: BrowserContext | undefined;
    const startBrowser = async () => {
      context = await playwright[browserName].launchPersistentContext(profile, {
        headless: true, channel: info.project.use.channel, baseURL,
        viewport: { width: 1440, height: 1000 }, locale: 'de-DE', reducedMotion: 'reduce',
      });
      const page = context.pages()[0] ?? await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/');
      return page;
    };
    const closeBrowser = async () => {
      if (!context) return;
      const previous = context;
      context = undefined;
      await previous.close();
    };
    try {
      let page = await startBrowser();
      info.annotations.push({ type: 'browser', description: `${info.project.name} ${context!.browser()!.version()}` });
      await createProject(page, 'Dauerhafte Grundrisse');
      await createFloor(page, 'Erdgeschoss');
      await importFloorPdf(page, groundPdf, 'Küche unten');
      const ground = await storedWorkspace(page);
      expect(ground.floorPlan!.id).toBe(digest(groundPdf));
      expect(await storedPdf(page, digest(groundPdf))).toEqual({ length: groundPdf.length, hash: digest(groundPdf) });
      if (migrateLegacy) {
        // Recreate only the old metadata format. Keep the original PDF written by the real import.
        await page.evaluate(workspace => {
          localStorage.setItem('fugenplan.workspace.v2', JSON.stringify(workspace));
          localStorage.removeItem('fugenplan.library.v3');
        }, ground);
        await closeBrowser();
        page = await startBrowser();
        await expect(page.getByRole('button', { name: 'Grundriss bearbeiten', exact: true })).toBeVisible();
        expect(await storedWorkspace(page)).toEqual(ground);
        expect(await storedPdf(page, digest(groundPdf))).toEqual({ length: groundPdf.length, hash: digest(groundPdf) });
      }
      await createFloor(page, 'Obergeschoss');
      await importFloorPdf(page, upperPdf, 'Zimmer oben');
      await expect.poll(async () => (await storedBuilding(page)).floors[1]?.workspace.rooms[0]?.project.name).toBe('Zimmer oben');
      const before = await storedBuilding(page);
      expect(before.floors[0].workspace).toEqual(ground);
      expect(before.floors[1].workspace.floorPlan!.id).toBe(digest(upperPdf));

      // End the browser process, then read the same profile from a new process. No storageState copy.
      await closeBrowser();
      page = await startBrowser();
      await expect(page.getByRole('heading', { name: 'Obergeschoss', exact: true })).toBeVisible();
      expect(await storedBuilding(page)).toEqual(before);
      for (const [index, bytes] of [groundPdf, upperPdf].entries()) {
        const floor = before.floors[index];
        expect(await storedPdf(page, digest(bytes))).toEqual({ length: bytes.length, hash: digest(bytes) });
        await page.getByRole('navigation', { name: 'Etagen', exact: true }).getByRole('button', { name: `${floor.name} öffnen`, exact: true }).click();
        await page.getByRole('button', { name: 'Grundriss bearbeiten', exact: true }).click();
        await expect(page.getByTestId('pdf-overlay')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'PDF-Datei erneut öffnen', exact: true })).toHaveCount(0);
        await page.getByRole('button', { name: 'Etage', exact: true }).click();
        await expect(page.getByRole('group', { name: `Etagenplan ${floor.name}`, exact: true }).locator('[data-piece]')).not.toHaveCount(0);
      }
      await expect.poll(() => storedBuilding(page)).toEqual(before);
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Obergeschoss', exact: true })).toBeVisible();
      expect(await storedBuilding(page)).toEqual(before);
      await page.getByRole('button', { name: 'Exportieren', exact: true }).click();
      const download = page.waitForEvent('download');
      await page.getByRole('dialog', { name: 'Plan mitnehmen', exact: true }).getByRole('button', { name: /^Projektdatei/ }).click();
      const exported = await download;
      expect(await exported.failure()).toBeNull();
      const saved = JSON.parse(await readFile((await exported.path())!, 'utf8')) as BuildingFile;
      expect(saved.building).toEqual(before);
      expect(saved.assets).toHaveLength(2);
      for (const bytes of [groundPdf, upperPdf]) expect(Buffer.from(saved.assets.find(asset => asset.id === digest(bytes))!.pdfBase64, 'base64')).toEqual(bytes);
      await page.keyboard.press('Escape');
      await info.attach('Etage nach Browser-Neustart und Neuladen', { body: await page.screenshot(), contentType: 'image/png' });
    } finally {
      await closeBrowser();
      await rm(profile, { recursive: true, force: true });
    }
    expect(errors).toEqual([]);
  });
}

test('Eine fehlerhafte PDF-Speicherung wird vor der Übernahme erkannt und lässt sich erneut versuchen', { tag: '@smoke' }, async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await createProject(page, 'Speicherung prüfen');
  await createFloor(page, 'Erdgeschoss');
  await importFloorPdf(page, groundPdf, 'Erhaltener Raum');
  const ground = await storedWorkspace(page);
  await createFloor(page, 'Obergeschoss');
  await expect.poll(async () => {
    const building = await storedBuilding(page);
    return building.floors.find(floor => floor.id === building.activeFloorId)?.name;
  }).toBe('Obergeschoss');
  // Simulate a successful write transaction that stored different bytes. The real database stays in use.
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value: unknown, key?: IDBValidKey) {
      if (this.name === 'documents' && value instanceof ArrayBuffer) {
        const bytes = new Uint8Array(value.slice(0));
        bytes[bytes.length - 1] ^= 1;
        return original.call(this, bytes.buffer, key);
      }
      return original.call(this, value, key);
    };
  });
  await page.getByRole('button', { name: 'PDF-Grundriss laden', exact: true }).click();
  await page.getByLabel('PDF-Grundriss öffnen', { exact: true }).setInputFiles({ name: 'obergeschoss.pdf', mimeType: 'application/pdf', buffer: upperPdf });
  await expect(page.getByRole('alert')).toContainText('Die PDF konnte nicht vollständig gespeichert werden.');
  expect((await storedWorkspace(page)).floorPlan).toBeUndefined();
  expect((await storedWorkspace(page)).rooms).toEqual([]);
  expect((await storedBuilding(page)).floors[0].workspace).toEqual(ground);
  expect(await storedPdf(page, digest(groundPdf))).toEqual({ length: groundPdf.length, hash: digest(groundPdf) });
  // Reload removes the injected fault. A fresh import must now succeed with the actual original bytes.
  await expect.poll(async () => (await storedBuilding(page)).floors[1]?.name).toBe('Obergeschoss');
  await page.reload();
  await importFloorPdf(page, upperPdf, 'Geretteter Import');
  expect(await storedPdf(page, digest(upperPdf))).toEqual({ length: upperPdf.length, hash: digest(upperPdf) });
  expect((await storedBuilding(page)).floors[0].workspace).toEqual(ground);
});
