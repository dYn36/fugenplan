import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { BuildingFile } from '../src/floorplan-types';
import type { Point } from '../src/types';
import { buildingContents, createFloor, createProject, libraryHome, setField, storedBuilding, storedLibrary, storedWorkspace } from './helpers';

const fixture = fileURLToPath(new URL('./fixtures/grundriss-drei-seiten.pdf', import.meta.url));
const pdfBytes = await readFile(fixture);
const manifest = JSON.parse(await readFile(new URL('./fixtures/grundriss-erwartungen.json', import.meta.url), 'utf8')) as {
  pages: { width: number; height: number; calibration: { start: Point; end: Point; lengthMm: number }; rooms: { points: Point[] }[] }[];
};
const errors = new WeakMap<Page, string[]>();
const drawing = (page: Page, floor: string) => page.getByRole('group', { name: `Etagenplan ${floor}`, exact: true });
const roomRows = (page: Page) => page.getByRole('region', { name: 'Projektübersicht', exact: true }).getByRole('article');

async function addRoom(page: Page, name: string) {
  await page.getByRole('button', { name: 'Raum hinzufügen', exact: true }).click();
  await setField(page, 'Raumname', name);
  await expect(page.getByTestId('floor-plan')).toBeVisible();
}

async function placeRoom(page: Page, name: string, x: string, y: string) {
  await page.getByRole('button', { name: `Position von ${name} festlegen`, exact: true }).click();
  await page.getByRole('textbox', { name: 'X in cm', exact: true }).fill(x);
  await page.getByRole('textbox', { name: 'Y in cm', exact: true }).fill(y);
  await page.getByRole('button', { name: 'Position speichern', exact: true }).click();
  await expect.poll(async () => (await storedWorkspace(page)).rooms.find(room => room.project.name === name)?.placement).toEqual({ x: Number(x) * 10, y: Number(y) * 10 });
}

async function precisePoint(page: Page, point: Point, number = 1) {
  const fields = page.locator('details.fpdf-precise');
  if (await fields.getAttribute('open') === null) await fields.locator('summary').click();
  const expected = manifest.pages[number - 1];
  await page.getByRole('textbox', { name: 'X auf Seite', exact: true }).fill(String(point.x / expected.width * 100));
  await page.getByRole('textbox', { name: 'Y auf Seite', exact: true }).fill(String(point.y / expected.height * 100));
  await page.getByRole('button', { name: 'Punkt setzen', exact: true }).click();
}

async function calibrate(page: Page, number = 1) {
  const expected = manifest.pages[number - 1].calibration;
  await page.getByRole('button', { name: 'Seite verwenden', exact: true }).click();
  await page.getByRole('button', { name: 'Wand markieren', exact: true }).click();
  await precisePoint(page, expected.start, number);
  await precisePoint(page, expected.end, number);
  await page.getByRole('textbox', { name: 'Länge der Wand', exact: true }).fill(String(expected.lengthMm / 10));
  await page.getByRole('button', { name: 'Maßstab speichern', exact: true }).click();
}

async function markRoom(page: Page, name: string, number = 1, index = 0, next = false) {
  await page.getByRole('button', { name: next ? 'Weiteren Raum markieren' : 'Raum markieren', exact: true }).click();
  await page.getByRole('textbox', { name: 'Raumname', exact: true }).fill(name);
  await expect(page.getByRole('textbox', { name: 'Raumname', exact: true })).toHaveValue(name);
  for (const point of manifest.pages[number - 1].rooms[index].points) await precisePoint(page, point, number);
  await page.getByRole('button', { name: 'Raum übernehmen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Raum übernommen', exact: true })).toBeVisible();
  await expect.poll(async () => (await storedWorkspace(page)).rooms.some(room => room.project.name === name)).toBe(true);
}

async function exportProject(page: Page) {
  await page.getByRole('button', { name: 'Exportieren', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Plan mitnehmen', exact: true });
  const pending = page.waitForEvent('download');
  await dialog.getByRole('button', { name: /^Projektdatei/ }).click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  const contents = await readFile((await download.path())!, 'utf8');
  await page.keyboard.press('Escape');
  return { name: download.suggestedFilename(), contents, data: JSON.parse(contents) as BuildingFile };
}

async function noOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

test.beforeEach(async ({ page }) => {
  errors.set(page, []);
  page.on('pageerror', error => errors.get(page)!.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Deine Projekte', exact: true })).toBeVisible();
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));

test('Leere Bibliothek, mehrere Projekte und Etagen bleiben nach Wechsel und Neuladen getrennt', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Exportieren', exact: true })).toBeDisabled();
  await expect.poll(async () => (await storedLibrary(page)).projects.length).toBe(0);
  await createProject(page, 'Haus am Garten');
  await expect(page.getByRole('button', { name: 'Erste Etage anlegen' })).toBeVisible();
  await createFloor(page, 'Erdgeschoss');
  await expect(roomRows(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Raumplan', exact: true })).toBeDisabled();
  await addRoom(page, 'Wohnen');
  await setField(page, 'Breite', '480');
  await page.getByRole('button', { name: 'Etage', exact: true }).click();
  await placeRoom(page, 'Wohnen', '0', '0');
  await createFloor(page, 'Obergeschoss');
  await expect(roomRows(page)).toHaveCount(0);
  await addRoom(page, 'Bad');
  await setField(page, 'Breite', '240');
  await page.getByRole('button', { name: 'Etage', exact: true }).click();
  await placeRoom(page, 'Bad', '120', '30');
  await expect(drawing(page, 'Obergeschoss').locator('[data-room-id]')).toHaveCount(1);
  await expect(drawing(page, 'Obergeschoss')).not.toContainText('Wohnen');
  await expect.poll(async () => (await storedBuilding(page)).floors.length).toBe(2);
  const first = await storedBuilding(page);

  await libraryHome(page);
  await createProject(page, 'Ferienwohnung');
  await createFloor(page, 'Wohnebene');
  await addRoom(page, 'Wohnen');
  await setField(page, 'Breite', '333');
  await expect.poll(async () => (await storedWorkspace(page)).rooms[0].project.room.width).toBe(3330);
  await libraryHome(page);
  await expect(page.getByRole('button', { name: 'Haus am Garten öffnen', exact: true })).toContainText('2 Etagen');
  await page.getByRole('button', { name: 'Haus am Garten öffnen', exact: true }).click();
  await page.getByRole('navigation', { name: 'Etagen', exact: true }).getByRole('button', { name: 'Erdgeschoss öffnen', exact: true }).click();
  await drawing(page, 'Erdgeschoss').getByRole('button', { name: 'Wohnen bearbeiten', exact: true }).press('Enter');
  await expect(page.getByRole('textbox', { name: 'Breite', exact: true })).toHaveValue('480');
  await expect.poll(async () => (await storedLibrary(page)).projects.length).toBe(2);
  await expect.poll(async () => {
    const active = await storedBuilding(page);
    return { name: active.name, floor: active.floors.find(floor => floor.id === active.activeFloorId)?.name };
  }).toEqual({ name: 'Haus am Garten', floor: 'Erdgeschoss' });
  await page.reload();
  await expect(drawing(page, 'Erdgeschoss')).toBeVisible();
  const library = await storedLibrary(page);
  expect(library.projects[0].floors.map(floor => floor.workspace.rooms)).toEqual(first.floors.map(floor => floor.workspace.rooms));
  expect(library.projects[1].floors[0].workspace.rooms[0].project.room.width).toBe(3330);
});

test('PDF-Räume stehen in einer gemeinsamen Zeichnung; zweite Etage und Export erhalten alle Quellen', async ({ page }) => {
  test.setTimeout(90_000);
  await createProject(page, 'Zwei Geschosse');
  await createFloor(page, 'Erdgeschoss');
  await page.getByRole('button', { name: 'PDF-Grundriss laden', exact: true }).click();
  await page.getByLabel('PDF-Grundriss öffnen', { exact: true }).setInputFiles(fixture);
  await expect(page.getByTestId('pdf-overlay')).toBeVisible();
  await calibrate(page);
  await markRoom(page, 'Küche');
  await markRoom(page, 'Wohnen', 1, 1, true);
  await page.getByRole('button', { name: 'Zur Etagenansicht', exact: true }).click();
  const ground = drawing(page, 'Erdgeschoss');
  await expect(ground.locator('[data-room-id]')).toHaveCount(2);
  await expect(ground.locator('[data-piece]')).not.toHaveCount(0);
  const positions = await ground.locator('.floor-room-highlight').evaluateAll(elements => elements.map(element => ({
    points: element.getAttribute('points'),
    x: element.getBoundingClientRect().x, y: element.getBoundingClientRect().y,
    width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height,
  })));
  // Independent conversion from the known wall: 4,800 mm / 240 PDF units = 20.
  expect(positions.map(item => item.points)).toEqual(manifest.pages[0].rooms.map(room => room.points.map(point => `${point.x * 20},${point.y * 20}`).join(' ')));
  expect(positions[0].x + positions[0].width).toBeCloseTo(positions[1].x, 2);
  expect(positions[0].y).toBeCloseTo(positions[1].y, 2);
  expect(positions[0].height).toBeCloseTo(positions[1].height, 2);
  const groundWorkspace = await storedWorkspace(page);

  await page.getByRole('complementary', { name: 'Projektnavigation' }).getByRole('button', { name: 'Etage hinzufügen', exact: true }).last().click();
  const floorDialog = page.getByRole('dialog', { name: 'Neue Etage', exact: true });
  await floorDialog.getByRole('textbox', { name: 'Etagenname', exact: true }).fill('Obergeschoss');
  await floorDialog.getByRole('combobox', { name: 'Vorhandene PDF verwenden', exact: true }).selectOption({ label: 'grundriss-drei-seiten.pdf' });
  await floorDialog.getByRole('combobox', { name: 'Seite für diese Etage', exact: true }).selectOption('2');
  await floorDialog.getByRole('button', { name: 'Etage anlegen', exact: true }).click();
  await page.getByRole('button', { name: 'Grundriss bearbeiten', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'PDF-Seite', exact: true })).toHaveValue('2');
  await calibrate(page, 2);
  await markRoom(page, 'Bad', 2);
  await page.getByRole('button', { name: 'Zur Etagenansicht', exact: true }).click();
  await expect(drawing(page, 'Obergeschoss').locator('[data-room-id]')).toHaveCount(1);
  await expect(drawing(page, 'Obergeschoss')).not.toContainText('Küche');
  await expect.poll(async () => (await storedBuilding(page)).floors[1].workspace.rooms.length).toBe(1);
  const before = await storedBuilding(page);
  expect(before.floors[0].workspace).toEqual(groundWorkspace);
  expect(before.floors[1].workspace.floorPlan!.pages[1].calibration!.lengthMm).toBe(2000);
  const saved = await exportProject(page);
  expect(saved.name).toBe('Zwei-Geschosse.fugenplan.json');
  expect(saved.data.version).toBe(3);
  expect(saved.data.building).toEqual(before);
  expect(saved.data.assets).toHaveLength(1);
  expect(Buffer.from(saved.data.assets[0].pdfBase64, 'base64')).toEqual(pdfBytes);
  await page.getByLabel('Projektdatei öffnen', { exact: true }).setInputFiles({ name: saved.name, mimeType: 'application/json', buffer: Buffer.from(saved.contents) });
  await expect.poll(async () => (await storedLibrary(page)).projects.length).toBe(2);
  const restored = await storedBuilding(page);
  expect(restored.id).not.toBe(before.id);
  expect(buildingContents(restored)).toEqual(buildingContents(before));
  expect((await storedLibrary(page)).projects[0]).toEqual(before);
  await page.reload();
  await expect(drawing(page, 'Obergeschoss').locator('[data-room-id]')).toHaveCount(1);
  await page.getByRole('navigation', { name: 'Etagen', exact: true }).getByRole('button', { name: 'Erdgeschoss öffnen', exact: true }).click();
  await expect(drawing(page, 'Erdgeschoss').locator('[data-room-id]')).toHaveCount(2);
});

for (const missingOriginal of [false, true]) {
  test(`Neue Etage erhält eine eigene PDF bei ${missingOriginal ? 'fehlender' : 'vorhandener'} Original-PDF der ersten Etage`, { tag: '@smoke' }, async ({ page }) => {
    test.setTimeout(90_000);
    await createProject(page, 'Getrennte Grundrisse');
    await createFloor(page, 'Erdgeschoss');
    await page.getByRole('button', { name: 'PDF-Grundriss laden', exact: true }).click();
    await page.getByLabel('PDF-Grundriss öffnen', { exact: true }).setInputFiles(fixture);
    await expect(page.getByTestId('pdf-overlay')).toBeVisible();
    await calibrate(page);
    await markRoom(page, 'Küche unten');
    await page.getByRole('button', { name: 'Zur Etagenansicht', exact: true }).click();
    const ground = await storedWorkspace(page);

    if (missingOriginal) {
      // Remove only the original bytes, as with storage eviction. Keep the real project and renderer.
      await page.evaluate(async id => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('fugenplan-pdf-v1');
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        try {
          await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction('documents', 'readwrite');
            transaction.objectStore('documents').delete(id);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
          });
        } finally { db.close(); }
      }, ground.floorPlan!.id);
      await page.reload();
      await expect(page.locator('.save-status')).toContainText('PDF fehlt');
    }

    await createFloor(page, 'Obergeschoss');
    await page.getByRole('button', { name: 'PDF-Grundriss laden', exact: true }).click();
    // A trailing PDF comment makes this a second valid file with a different content hash.
    const upperPdf = Buffer.concat([pdfBytes, Buffer.from('\n% Eigenstaendiger Grundriss Obergeschoss\n')]);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'PDF auswählen', exact: true }).click();
    await (await chooser).setFiles({ name: 'obergeschoss.pdf', mimeType: 'application/pdf', buffer: upperPdf });
    await expect(page.getByTestId('pdf-overlay')).toBeVisible();
    await expect(page.locator('.fpdf-error')).toHaveCount(0);
    await calibrate(page);
    await markRoom(page, 'Zimmer oben');
    await page.getByRole('button', { name: 'Zur Etagenansicht', exact: true }).click();
    await expect(drawing(page, 'Obergeschoss').locator('[data-room-id]')).toHaveCount(1);
    await expect(drawing(page, 'Obergeschoss').locator('[data-piece]')).not.toHaveCount(0);
    await expect.poll(async () => (await storedBuilding(page)).floors[1]?.workspace.rooms[0]?.project.name).toBe('Zimmer oben');
    const before = await storedBuilding(page);
    expect(before.floors[0].workspace).toEqual(ground);
    expect(before.floors[1].workspace.floorPlan!.id).not.toBe(ground.floorPlan!.id);
    await page.reload();
    await expect(drawing(page, 'Obergeschoss').locator('[data-room-id]')).toHaveCount(1);
    await expect(drawing(page, 'Obergeschoss').locator('[data-piece]')).not.toHaveCount(0);
    expect(await storedBuilding(page)).toEqual(before);

    if (missingOriginal) {
      await page.getByRole('button', { name: 'Exportieren', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Plan mitnehmen', exact: true });
      const downloads: string[] = [];
      page.on('download', download => downloads.push(download.suggestedFilename()));
      await dialog.getByRole('button', { name: /^Projektdatei/ }).click();
      await expect(dialog.getByRole('alert')).toContainText('Eine Original-PDF fehlt.');
      expect(downloads).toEqual([]);
      await page.keyboard.press('Escape');
      await page.getByRole('navigation', { name: 'Etagen', exact: true }).getByRole('button', { name: 'Erdgeschoss öffnen', exact: true }).click();
      await page.getByRole('button', { name: 'Grundriss bearbeiten', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'PDF-Datei erneut öffnen', exact: true })).toBeVisible();
      await page.getByLabel('PDF-Grundriss öffnen', { exact: true }).setInputFiles(fixture);
      await expect(page.getByTestId('pdf-overlay')).toBeVisible();
      await expect(page.locator('.save-status')).not.toContainText('PDF fehlt');
      await page.getByRole('button', { name: 'Etage', exact: true }).click();
      await expect(drawing(page, 'Erdgeschoss').locator('[data-room-id]')).toHaveCount(1);
      await expect(drawing(page, 'Erdgeschoss').locator('[data-piece]')).not.toHaveCount(0);
      expect((await storedBuilding(page)).floors.map(floor => floor.workspace)).toEqual(before.floors.map(floor => floor.workspace));
    }

    const saved = await exportProject(page);
    expect(saved.data.assets).toHaveLength(2);
    const originals = new Map(saved.data.assets.map(asset => [asset.id, Buffer.from(asset.pdfBase64, 'base64')]));
    expect(originals.get(ground.floorPlan!.id)).toEqual(pdfBytes);
    expect(originals.get(before.floors[1].workspace.floorPlan!.id)).toEqual(upperPdf);
    expect(saved.data.building.floors).toEqual(before.floors);
    await page.getByLabel('Projektdatei öffnen', { exact: true }).setInputFiles({ name: saved.name, mimeType: 'application/json', buffer: Buffer.from(saved.contents) });
    await expect.poll(async () => (await storedLibrary(page)).projects.length).toBe(2);
    expect(buildingContents(await storedBuilding(page))).toEqual(buildingContents(saved.data.building));
  });
}

test('Raum verschieben, Namen ändern und Etage oder Projekt entfernen sind nachvollziehbar und rückgängig', async ({ page }) => {
  await createProject(page, 'Haus');
  await createFloor(page, 'Unten');
  await addRoom(page, 'Arbeitszimmer');
  await page.getByRole('button', { name: 'Etage', exact: true }).click();
  await placeRoom(page, 'Arbeitszimmer', '25', '40');
  await createFloor(page, 'Oben');
  await page.getByRole('navigation', { name: 'Etagen', exact: true }).getByRole('button', { name: 'Unten öffnen', exact: true }).click();
  await drawing(page, 'Unten').getByRole('button', { name: 'Arbeitszimmer bearbeiten', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Raum in andere Etage verschieben', exact: true }).click();
  const move = page.getByRole('dialog', { name: 'Raum verschieben', exact: true });
  await expect(move).toContainText('Arbeitszimmer');
  await expect(move).toContainText('Position');
  await move.getByRole('combobox', { name: 'Zieletage', exact: true }).selectOption({ label: 'Oben' });
  await move.getByRole('button', { name: 'Raum verschieben', exact: true }).click();
  await expect.poll(async () => (await storedBuilding(page)).floors[0].workspace.rooms.length).toBe(0);
  let building = await storedBuilding(page);
  expect(building.floors[1].workspace.rooms[0].project.name).toBe('Arbeitszimmer');
  expect(building.floors[1].workspace.rooms[0].placement).toBeUndefined();
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect.poll(async () => (await storedBuilding(page)).floors[0].workspace.rooms[0]?.placement).toEqual({ x: 250, y: 400 });
  await page.getByRole('button', { name: 'Wiederholen', exact: true }).click();
  await page.getByRole('navigation', { name: 'Etagen', exact: true }).getByRole('button', { name: 'Oben öffnen', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Noch nicht angeordnete Räume' })).toContainText('Arbeitszimmer');
  await page.getByRole('button', { name: 'Oben verwalten', exact: true }).click();
  const manageFloor = page.getByRole('dialog', { name: 'Etage verwalten', exact: true });
  await manageFloor.getByRole('textbox', { name: 'Etagenname', exact: true }).fill('Obergeschoss');
  await manageFloor.getByRole('button', { name: 'Änderungen speichern', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Obergeschoss', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Obergeschoss verwalten', exact: true }).click();
  await manageFloor.getByRole('button', { name: 'Etage entfernen', exact: true }).click();
  await expect(manageFloor).toContainText('„Obergeschoss“ wird mit 1 Raum entfernt');
  await manageFloor.getByRole('button', { name: 'Behalten', exact: true }).click();
  await manageFloor.getByRole('button', { name: 'Etage entfernen', exact: true }).click();
  await manageFloor.getByRole('button', { name: 'Etage entfernen', exact: true }).click();
  await expect.poll(async () => (await storedBuilding(page)).floors.length).toBe(1);
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect.poll(async () => (await storedBuilding(page)).floors.length).toBe(2);
  await page.getByRole('button', { name: 'Projekt verwalten', exact: true }).click();
  const manageProject = page.getByRole('dialog', { name: 'Projekt verwalten', exact: true });
  await manageProject.getByRole('textbox', { name: 'Projektname', exact: true }).fill('Haus am Park');
  await manageProject.getByRole('button', { name: 'Änderungen speichern', exact: true }).click();
  await libraryHome(page);
  await expect(page.getByRole('button', { name: 'Haus am Park öffnen', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Haus am Park verwalten', exact: true }).click();
  await manageProject.getByRole('button', { name: 'Projekt entfernen', exact: true }).click();
  await expect(manageProject).toContainText('Haus am Park');
  await manageProject.getByRole('button', { name: 'Projekt entfernen', exact: true }).click();
  await expect.poll(async () => (await storedLibrary(page)).projects.length).toBe(0);
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Haus am Park öffnen', exact: true })).toBeVisible();
  building = await storedBuilding(page);
  expect(building.floors.flatMap(floor => floor.workspace.rooms)).toHaveLength(1);
});

test('PDF-Entwurf bleibt bei abgebrochenem Projekt- und Etagenwechsel erhalten', async ({ page }) => {
  test.setTimeout(60_000);
  await createProject(page, 'Entwurfsschutz');
  await createFloor(page, 'Erdgeschoss');
  await createFloor(page, 'Obergeschoss');
  await page.getByRole('navigation', { name: 'Etagen', exact: true }).getByRole('button', { name: 'Erdgeschoss öffnen', exact: true }).click();
  await page.getByRole('button', { name: 'PDF-Grundriss laden', exact: true }).click();
  await page.getByLabel('PDF-Grundriss öffnen', { exact: true }).setInputFiles(fixture);
  await calibrate(page);
  await page.getByRole('button', { name: 'Raum markieren', exact: true }).click();
  await page.getByRole('textbox', { name: 'Raumname', exact: true }).fill('Entwurf Wohnen');
  for (const point of manifest.pages[0].rooms[0].points.slice(0, 3)) await precisePoint(page, point);
  await page.getByRole('navigation', { name: 'Etagen', exact: true }).getByRole('button', { name: 'Obergeschoss öffnen', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Markierung verwerfen?' })).toBeVisible();
  await page.getByRole('button', { name: 'Weiter markieren', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Raumname', exact: true })).toHaveValue('Entwurf Wohnen');
  await expect(page.getByText('3 von 32 Eckpunkten', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Fugenplan, zu den Projekten', exact: true }).click();
  await page.getByRole('button', { name: 'Weiter markieren', exact: true }).click();
  await expect(page.getByText('3 von 32 Eckpunkten', { exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Etagen', exact: true }).getByRole('button', { name: 'Obergeschoss öffnen', exact: true }).click();
  await page.getByRole('button', { name: 'Verwerfen und fortfahren', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Obergeschoss', exact: true })).toBeVisible();
  expect((await storedBuilding(page)).floors.flatMap(floor => floor.workspace.rooms)).toHaveLength(0);
});

test('PDF-Seitenwechsel verwirft einen Entwurf genau einmal und erhält gespeicherte Etagen', async ({ page }) => {
  test.setTimeout(90_000);
  await createProject(page, 'Seitenwechsel');
  await createFloor(page, 'Erdgeschoss');
  await page.getByRole('button', { name: 'PDF-Grundriss laden', exact: true }).click();
  await page.getByLabel('PDF-Grundriss öffnen', { exact: true }).setInputFiles(fixture);
  await calibrate(page);
  await markRoom(page, 'Wohnen');

  await page.getByRole('complementary', { name: 'Projektnavigation' }).getByRole('button', { name: 'Etage hinzufügen', exact: true }).last().click();
  const floorDialog = page.getByRole('dialog', { name: 'Neue Etage', exact: true });
  await floorDialog.getByRole('textbox', { name: 'Etagenname', exact: true }).fill('Obergeschoss');
  await floorDialog.getByRole('combobox', { name: 'Vorhandene PDF verwenden', exact: true }).selectOption({ label: 'grundriss-drei-seiten.pdf' });
  await floorDialog.getByRole('combobox', { name: 'Seite für diese Etage', exact: true }).selectOption('2');
  await floorDialog.getByRole('button', { name: 'Etage anlegen', exact: true }).click();
  await page.getByRole('button', { name: 'Grundriss bearbeiten', exact: true }).click();
  await calibrate(page, 2);
  await markRoom(page, 'Bad', 2);
  const savedFloors = (await storedBuilding(page)).floors;

  const groundFloor = page.getByRole('navigation', { name: 'Etagen', exact: true }).getByRole('button', { name: 'Erdgeschoss öffnen', exact: true });
  const pdfPage = page.getByRole('combobox', { name: 'PDF-Seite', exact: true });
  const discard = page.getByRole('dialog', { name: 'Markierung verwerfen?', exact: true });
  await groundFloor.click();
  await page.getByRole('button', { name: 'Grundriss bearbeiten', exact: true }).click();
  await page.getByRole('button', { name: 'Weiteren Raum markieren', exact: true }).click();
  await page.getByRole('textbox', { name: 'Raumname', exact: true }).fill('Entwurf vor bestehender Etage');
  for (const point of manifest.pages[0].rooms[1].points.slice(0, 3)) await precisePoint(page, point);
  await pdfPage.selectOption('2');
  await expect(discard).toHaveCount(1);
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(discard).toContainText('Beim Wechsel auf Seite 2');
  await discard.getByRole('button', { name: 'Verwerfen und Seite wechseln', exact: true }).click();

  // One confirmation must open the existing floor directly, without a second App dialog.
  await expect(page.getByRole('navigation', { name: 'Position im Projekt' })).toContainText('Obergeschoss');
  await expect(pdfPage).toHaveValue('2');
  await expect(page.getByTestId('pdf-overlay')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(async () => (await storedBuilding(page)).activeFloorId).toBe(savedFloors[1].id);
  expect((await storedBuilding(page)).floors).toEqual(savedFloors);

  await groundFloor.click();
  await page.getByRole('button', { name: 'Grundriss bearbeiten', exact: true }).click();
  await page.getByRole('button', { name: 'Weiteren Raum markieren', exact: true }).click();
  await page.getByRole('textbox', { name: 'Raumname', exact: true }).fill('Entwurf vor neuer Etage');
  for (const point of manifest.pages[0].rooms[1].points.slice(0, 3)) await precisePoint(page, point);
  await pdfPage.selectOption('3');
  await expect(discard).toHaveCount(1);
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(discard).toContainText('Beim Wechsel auf Seite 3');
  await discard.getByRole('button', { name: 'Verwerfen und Seite wechseln', exact: true }).click();

  const newFloor = page.getByRole('dialog', { name: 'PDF-Seite als eigene Etage', exact: true });
  await expect(newFloor).toBeVisible();
  await expect(discard).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(newFloor.getByRole('textbox', { name: 'Etagenname', exact: true })).toHaveValue('Seite 3');
  await newFloor.getByRole('textbox', { name: 'Etagenname', exact: true }).fill('Dachgeschoss');
  await newFloor.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(pdfPage).toHaveValue('1');
  await expect(page.getByRole('navigation', { name: 'Position im Projekt' })).toContainText('Erdgeschoss');

  // Cancelling floor creation does not restore the draft that was already discarded.
  await page.getByRole('button', { name: 'Raum markieren', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Raumname', exact: true })).toHaveValue('Raum 2');
  await expect(page.getByText('0 von 32 Eckpunkten', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Raum übernehmen', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Etage', exact: true }).click();
  await expect(drawing(page, 'Erdgeschoss').getByRole('button', { name: 'Wohnen bearbeiten', exact: true })).toBeVisible();
  await expect(drawing(page, 'Erdgeschoss').locator('[data-room-id]')).toHaveCount(1);
  await expect.poll(async () => (await storedBuilding(page)).activeFloorId).toBe(savedFloors[0].id);
  expect((await storedBuilding(page)).floors).toEqual(savedFloors);
});

test('Ein Raum über der Rastergrenze blockiert die übrigen Räume der Etage nicht', async ({ page }) => {
  test.setTimeout(60_000);
  const rasterError = 'Das Raster ist zu dicht. Die Grenze liegt bei 60.000 Rasterelementen. Vergrößere das Materialformat oder verkleinere den Raum.';
  await createProject(page, 'Unabhängige Raumpläne');
  await createFloor(page, 'Erdgeschoss');
  // The failing room comes first, so the overview must continue calculating the next room.
  await addRoom(page, 'Große Halle');
  await page.getByRole('button', { name: 'Etage', exact: true }).click();
  await placeRoom(page, 'Große Halle', '0', '0');
  await addRoom(page, 'Arbeitszimmer');
  await setField(page, 'Breite', '400');
  await setField(page, 'Tiefe', '300');
  await page.getByRole('button', { name: 'Etage', exact: true }).click();
  await placeRoom(page, 'Arbeitszimmer', '5100', '0');

  const floorPlan = drawing(page, 'Erdgeschoss');
  const hall = floorPlan.getByRole('button', { name: 'Große Halle bearbeiten', exact: true });
  const healthy = floorPlan.getByRole('button', { name: 'Arbeitszimmer bearbeiten', exact: true });
  const hallRow = roomRows(page).filter({ has: page.getByRole('button', { name: 'Große Halle bearbeiten', exact: true }) });
  const healthyRow = roomRows(page).filter({ has: page.getByRole('button', { name: 'Arbeitszimmer bearbeiten', exact: true }) });
  await expect(healthy.locator('[data-piece]')).not.toHaveCount(0);
  const healthyGeometry = await healthy.locator('[data-piece]').evaluateAll(elements => elements.map(element => element.getAttribute('d')));
  await hall.press('Enter');
  // Keep intermediate plans small, then exceed the 60,000-candidate guard in geometry.ts.
  await setField(page, 'Tiefe', '50');
  await setField(page, 'Breite', '5000');
  await page.getByRole('button', { name: 'Belag', exact: true }).click();
  await setField(page, 'Länge', '10');
  await setField(page, 'Breite', '10');
  await setField(page, 'Fuge', '0');
  await page.getByRole('button', { name: 'Raum', exact: true }).click();
  await setField(page, 'Tiefe', '5000');
  await expect(page.getByRole('textbox', { name: 'Breite', exact: true })).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('textbox', { name: 'Tiefe', exact: true })).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('alert')).toContainText(rasterError);
  await expect.poll(async () => {
    const room = (await storedWorkspace(page)).rooms[0].project;
    return [room.room.width, room.room.height, room.material.width, room.material.height, room.material.grout];
  }).toEqual([50_000, 50_000, 100, 100, 0]);

  await page.getByRole('button', { name: 'Etage', exact: true }).click();
  await expect(floorPlan.locator('.floor-room-highlight')).toHaveCount(2);
  await expect(hall.locator('.floor-room-highlight')).toBeVisible();
  await expect(healthy.locator('.floor-room-highlight')).toBeVisible();
  await expect(hallRow.locator('.floor-room-error')).toHaveText(rasterError);
  await expect(hall).toContainText('Eingaben prüfen');
  await expect(hall.locator('[data-piece]')).toHaveCount(0);
  await expect(healthy.locator('[data-piece]')).not.toHaveCount(0);
  expect(await healthy.locator('[data-piece]').evaluateAll(elements => elements.map(element => element.getAttribute('d')))).toEqual(healthyGeometry);
  await expect(healthyRow.locator('.floor-room-error')).toHaveCount(0);
  await expect(healthyRow.locator('.floor-room-facts strong')).toHaveText('12 m²');

  await healthy.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Raumname', exact: true })).toHaveValue('Arbeitszimmer');
  await expect(page.getByTestId('floor-plan').locator('[data-piece]')).not.toHaveCount(0);
  await setField(page, 'Breite', '450');
  await expect.poll(async () => (await storedWorkspace(page)).rooms[1].project.room.width).toBe(4500);
  await page.getByRole('button', { name: 'Etage', exact: true }).click();
  await expect(healthyRow.locator('.floor-room-facts strong')).toHaveText('13,5 m²');
  await expect(healthy.locator('[data-piece]')).not.toHaveCount(0);
  await expect(hallRow.locator('.floor-room-error')).toHaveText(rasterError);

  // The failed room remains reachable and can recover through valid product dimensions.
  await hallRow.getByRole('button', { name: 'Große Halle bearbeiten', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Raumname', exact: true })).toHaveValue('Große Halle');
  await expect(page.getByRole('alert')).toContainText(rasterError);
  await page.getByRole('button', { name: 'Belag', exact: true }).click();
  await setField(page, 'Länge', '500');
  await setField(page, 'Breite', '500');
  await expect(page.getByTestId('floor-plan').locator('[data-piece]')).not.toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Etage', exact: true }).click();
  await expect(hall.locator('[data-piece]')).not.toHaveCount(0);
  await expect(hallRow.locator('.floor-room-error')).toHaveCount(0);
  await expect(healthy.locator('[data-piece]')).not.toHaveCount(0);
  await expect(healthyRow.locator('.floor-room-facts strong')).toHaveText('13,5 m²');
});

test('Mobile Etagenwahl hält den Kontext und den Grundriss bei 390 und 320 Pixeln bedienbar', async ({ page }) => {
  test.setTimeout(60_000);
  await createProject(page, 'Haus mit einem langen Projektnamen');
  await createFloor(page, 'Erdgeschoss');
  await addRoom(page, 'Wohnen');
  await page.getByRole('button', { name: 'Etage', exact: true }).click();
  await placeRoom(page, 'Wohnen', '0', '0');
  await createFloor(page, 'Obergeschoss');
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await noOverflow(page);
    await page.getByRole('button', { name: 'Etagen', exact: true }).click();
    const chooser = page.getByRole('dialog', { name: 'Etagen', exact: true });
    await chooser.getByRole('button', { name: /^Erdgeschoss/ }).click();
    await expect(drawing(page, 'Erdgeschoss')).toBeVisible();
    await noOverflow(page);
    await expect(page.getByRole('navigation', { name: 'Position im Projekt' })).toContainText('Erdgeschoss');
    const controls = await page.locator('.floor-overview-actions button, .floor-zoom button, .mobile-floor-switch').evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height, label: element.getAttribute('aria-label') || element.textContent };
    }).filter(rect => rect.width > 0 && rect.height > 0));
    for (const control of controls) {
      expect(control.width, control.label ?? '').toBeGreaterThanOrEqual(44);
      expect(control.height, control.label ?? '').toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('button', { name: 'Etagen', exact: true }).click();
    await chooser.getByRole('button', { name: /^Obergeschoss/ }).click();
    await expect(page.getByRole('heading', { name: 'Obergeschoss', exact: true })).toBeVisible();
    await expect(roomRows(page)).toHaveCount(0);
  }
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? '')).map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([]);
});
