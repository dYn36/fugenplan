import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Point } from '../src/types';
import type { Workspace, BuildingFile, WorkspaceRoom } from '../src/floorplan-types';

import { seedLegacyProject, storedWorkspace, storedBuilding, buildingContents, selectPdfPage } from './helpers';

const fixture = fileURLToPath(new URL('./fixtures/grundriss-drei-seiten.pdf', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('./fixtures/grundriss-erwartungen.json', import.meta.url), 'utf8')) as {
  pages: Array<{ number: number; width: number; height: number; rotation: number;
    calibration: { start: Point; end: Point; lengthMm: number; mmPerPoint: number };
    rooms: Array<{ points: Point[]; widthMm: number; heightMm: number; areaM2: number }> }>;
};
const pdfBytes = await readFile(fixture);
const evidence = 'test-results/pdf-evidence';
const errors = new WeakMap<Page, string[]>();
const requests = new WeakMap<Page, string[]>();
const pointerSamples = new WeakMap<Page, unknown[]>();
const overlay = (page: Page) => page.getByTestId('pdf-overlay');
const floorPlan = (page: Page) => page.getByTestId('floor-plan');

function observe(page: Page) {
  errors.set(page, []); requests.set(page, []);
  page.on('pageerror', error => errors.get(page)!.push(error.message));
  page.context().on('request', request => requests.get(page)!.push(request.url()));
  page.on('websocket', socket => requests.get(page)!.push(socket.url()));
}

async function readyPdf(page: Page, number = 1) {
  const expected = manifest.pages[number - 1];
  await expect(overlay(page)).toBeVisible();
  await expect(overlay(page)).toHaveAttribute('viewBox', `0 0 ${expected.width} ${expected.height}`);
  await expect(overlay(page)).toHaveAttribute('aria-label', `PDF-Grundriss, Seite ${number}`);
  // The renderer must paint real document pixels, not merely show an empty canvas.
  await expect.poll(() => page.getByTestId('pdf-canvas').evaluate((element: HTMLCanvasElement) => {
    if (element.width < 2 || element.height < 2) return 0;
    const data = element.getContext('2d')!.getImageData(0, 0, element.width, element.height).data;
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] < 100 && data[i + 3] > 0) dark++;
    return dark;
  })).toBeGreaterThan(100);
}

async function openFloorPlan(page: Page, number?: number) {
  await page.getByRole('button', { name: 'Grundriss', exact: true }).click();
  if (number) await selectPdfPage(page, number);
  const active = number ?? Number(await page.getByRole('combobox', { name: 'PDF-Seite', exact: true }).inputValue());
  await readyPdf(page, active);
}

async function upload(page: Page) {
  await page.getByRole('button', { name: 'Grundriss', exact: true }).click();
  await page.getByLabel('PDF-Grundriss öffnen', { exact: true }).setInputFiles(fixture);
  await readyPdf(page);
  await expect(page.getByRole('combobox', { name: 'PDF-Seite', exact: true }).locator('option')).toHaveCount(3);
  await page.getByRole('button', { name: 'Seite verwenden', exact: true }).click();
}

async function precisePoint(page: Page, point: Point, number: number) {
  const fields = page.locator('details.fpdf-precise');
  if (await fields.getAttribute('open') === null) await fields.locator('summary').click();
  const expected = manifest.pages[number - 1];
  await page.getByRole('textbox', { name: 'X auf Seite', exact: true }).fill(String(point.x / expected.width * 100).replace('.', ','));
  await page.getByRole('textbox', { name: 'Y auf Seite', exact: true }).fill(String(point.y / expected.height * 100).replace('.', ','));
  await page.getByRole('button', { name: 'Punkt setzen', exact: true }).click();
  return point;
}

async function pointerPoint(page: Page, point: Point, number: number) {
  await page.getByTestId('pdf-stage').scrollIntoViewIfNeeded();
  const box = (await overlay(page).boundingBox())!;
  const stage = (await page.getByTestId('pdf-stage').boundingBox())!;
  const natural = manifest.pages[number - 1];
  const x = Math.round(box.x + point.x / natural.width * box.width);
  const y = Math.round(box.y + point.y / natural.height * box.height);
  expect(x, 'Testpunkt muss in der sichtbaren PDF-Bühne liegen').toBeGreaterThan(stage.x);
  expect(x).toBeLessThan(stage.x + stage.width);
  expect(y).toBeGreaterThan(stage.y);
  expect(y).toBeLessThan(stage.y + stage.height);
  await overlay(page).evaluate(element => {
    window.addEventListener('pointerup', event => {
      const svg = element as SVGSVGElement;
      const screen = svg.createSVGPoint();
      screen.x = event.clientX; screen.y = event.clientY;
      const local = screen.matrixTransform(svg.getScreenCTM()!.inverse());
      element.setAttribute('data-test-pointer', JSON.stringify({
        screen: { x: event.clientX, y: event.clientY }, source: { x: local.x, y: local.y },
      }));
    }, { once: true, capture: true });
  });
  await page.mouse.click(x, y);
  const observed = JSON.parse((await overlay(page).getAttribute('data-test-pointer'))!);
  pointerSamples.set(page, [...(pointerSamples.get(page) ?? []), { requested: { x, y }, ...observed }]);
  return observed.source as Point;
}

async function calibrate(page: Page, number = 1, method: 'precise' | 'pointer' = 'precise', lengthMm?: number) {
  const expected = manifest.pages[number - 1].calibration;
  await page.getByRole('navigation', { name: 'Schritte zum Verlegeplan' }).getByRole('button', { name: 'Maßstab', exact: true }).click();
  await page.getByRole('button', { name: /^(Wand markieren|Maßstab neu setzen)$/ }).click();
  const point = method === 'pointer' ? pointerPoint : precisePoint;
  const start = await point(page, expected.start, number);
  const end = await point(page, expected.end, number);
  await page.getByRole('textbox', { name: 'Länge der Wand', exact: true }).fill(String((lengthMm ?? expected.lengthMm) / 10).replace('.', ','));
  await page.getByRole('button', { name: 'Maßstab speichern', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Raum markieren', exact: true })).toBeEnabled();
  await expect.poll(async () => {
    const saved = (await storedWorkspace(page)).floorPlan?.pages[number - 1].calibration;
    return !!saved && saved.lengthMm === (lengthMm ?? expected.lengthMm)
      && Math.abs(saved.start.x - start.x) < .0001 && Math.abs(saved.start.y - start.y) < .0001
      && Math.abs(saved.end.x - end.x) < .0001 && Math.abs(saved.end.y - end.y) < .0001;
  }).toBe(true);
  return { start, end, lengthMm: lengthMm ?? expected.lengthMm };
}

async function drawRoom(page: Page, name: string, number = 1, index = 0, method: 'precise' | 'pointer' = 'precise') {
  await page.getByRole('navigation', { name: 'Schritte zum Verlegeplan' }).getByRole('button', { name: 'Raum', exact: true }).click();
  await page.getByRole('button', { name: 'Raum markieren', exact: true }).click();
  await page.getByRole('textbox', { name: 'Raumname', exact: true }).fill(name);
  const point = method === 'pointer' ? pointerPoint : precisePoint;
  const sourcePoints: Point[] = [];
  for (const coordinate of manifest.pages[number - 1].rooms[index].points) sourcePoints.push(await point(page, coordinate, number));
  await page.getByRole('button', { name: 'Raum übernehmen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Raum übernommen', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Raum prüfen', exact: true }).click();
  await expect(floorPlan(page)).toBeVisible();
  await expect(page.getByRole('heading', { name, exact: true }).first()).toBeVisible();
  await expect.poll(async () => (await storedWorkspace(page)).rooms.some(room => room.project.name === name)).toBe(true);
  return sourcePoints;
}

async function setNumber(page: Page, label: string, value: string) {
  const field = page.getByRole('textbox', { name: label, exact: true });
  await field.fill(value); await field.press('Enter');
  await expect(field).not.toHaveAttribute('aria-invalid', 'true');
}

async function selectRoom(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Räume auf dieser Etage' }).getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true }).first()).toBeVisible();
}

function roomNamed(workspace: Workspace, name: string): WorkspaceRoom {
  const room = workspace.rooms.find(room => room.project.name === name);
  expect(room, `Raum ${name} muss vorhanden sein`).toBeDefined();
  return room!;
}

function assertRoom(room: WorkspaceRoom, expected: { widthMm: number; heightMm: number; areaM2: number }, tolerance = 0.01) {
  const points = room.project.room.points;
  const width = Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x));
  const height = Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y));
  // Independent shoelace formula; no production geometry or calibration helper is used.
  const area = Math.abs(points.reduce((sum, p, index) => {
    const next = points[(index + 1) % points.length];
    return sum + p.x * next.y - p.y * next.x;
  }, 0)) / 2e6;
  expect(Math.abs(width - expected.widthMm)).toBeLessThan(tolerance);
  expect(Math.abs(height - expected.heightMm)).toBeLessThan(tolerance);
  expect(Math.abs(area - expected.areaM2), `Raumpunkte: ${JSON.stringify(points)}`).toBeLessThan(tolerance / 100);
}

async function exportFile(page: Page) {
  await page.getByRole('button', { name: 'Exportieren', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Plan mitnehmen', exact: true });
  await expect(dialog).toBeVisible();
  const pending = page.waitForEvent('download');
  await dialog.getByRole('button', { name: /^Projektdatei/ }).click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  const contents = await readFile((await download.path())!, 'utf8');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  return { data: JSON.parse(contents) as BuildingFile, contents };
}

async function indexedPdf(page: Page, id: string) {
  return page.evaluate(async key => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('fugenplan-pdf-v1');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<number[]>((resolve, reject) => {
        const request = database.transaction('documents', 'readonly').objectStore('documents').get(key);
        request.onsuccess = () => resolve(Array.from(new Uint8Array(request.result)));
        request.onerror = () => reject(request.error);
      });
    } finally { database.close(); }
  }, id);
}

async function accessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? '')).map(item => ({
    id: item.id, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })),
  }))).toEqual([]);
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

test.beforeEach(async ({ page }) => {
  observe(page);
  await seedLegacyProject(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Raumplan', exact: true }).click();
  await expect(floorPlan(page)).toBeVisible();
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page), 'Keine unbehandelten JavaScript-Fehler').toEqual([]);
});

test('Echte PDF: Wandmaß und Raum bleiben bei Zeiger-Eingabe unabhängig vom Zoom', async ({ page }, testInfo) => {
  await upload(page);
  await expect(page.getByRole('navigation', { name: 'Schritte zum Verlegeplan' }).getByRole('button', { name: 'Raum', exact: true })).toBeDisabled();
  const originalInput = await calibrate(page, 1, 'pointer');
  const original = (await storedWorkspace(page)).floorPlan!.pages[0].calibration!;
  await page.getByRole('button', { name: 'PDF vergrößern', exact: true }).click();
  await expect(page.getByLabel('PDF-Zoom', { exact: true })).toHaveText('125 %');
  const zoomedInput = await calibrate(page, 1, 'pointer');
  const zoomed = (await storedWorkspace(page)).floorPlan!.pages[0].calibration!;
  for (const key of ['start', 'end'] as const) {
    expect(Math.abs(original[key].x - originalInput[key].x)).toBeLessThan(0.0001);
    expect(Math.abs(original[key].y - originalInput[key].y)).toBeLessThan(0.0001);
    expect(Math.abs(zoomed[key].x - zoomedInput[key].x), JSON.stringify(pointerSamples.get(page))).toBeLessThan(0.0001);
    expect(Math.abs(zoomed[key].y - zoomedInput[key].y)).toBeLessThan(0.0001);
  }
  // Use the delivered integer pointer coordinates as the independent oracle.
  // Rounding one screen pixel can represent several mm at this document zoom.
  const marked = await drawRoom(page, 'PDF Küche', 1, 0, 'pointer');
  const mmPerPoint = 4800 / Math.hypot(zoomedInput.end.x - zoomedInput.start.x, zoomedInput.end.y - zoomedInput.start.y);
  const widthMm = (Math.max(...marked.map(p => p.x)) - Math.min(...marked.map(p => p.x))) * mmPerPoint;
  const heightMm = (Math.max(...marked.map(p => p.y)) - Math.min(...marked.map(p => p.y))) * mmPerPoint;
  const areaM2 = Math.abs(marked.reduce((sum, p, index) => {
    const next = marked[(index + 1) % marked.length];
    return sum + p.x * next.y - p.y * next.x;
  }, 0)) / 2 * mmPerPoint ** 2 / 1e6;
  assertRoom(roomNamed(await storedWorkspace(page), 'PDF Küche'), { widthMm, heightMm, areaM2 });
  await testInfo.attach('Gemessene Zeigereingaben', { body: JSON.stringify(pointerSamples.get(page), null, 2), contentType: 'application/json' });
  await openFloorPlan(page, 1);
  await page.getByRole('button', { name: 'PDF einpassen', exact: true }).click();
  if (await page.getByRole('button', { name: 'Meldung schließen', exact: true }).count()) await page.getByRole('button', { name: 'Meldung schließen', exact: true }).click();
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/desktop-1440x1000.png`, fullPage: true });
  await mkdir('tests/screenshots', { recursive: true });
  await copyFile(`${evidence}/desktop-1440x1000.png`, 'tests/screenshots/pdf-desktop.png');
  await accessible(page);
});

test('Eigene Maßstäbe für Vektor, gedrehte Seite und Raster; neue Kalibrierung ändert nur zugeordnete Räume', async ({ page }) => {
  test.setTimeout(90_000);
  await upload(page); await calibrate(page);
  await drawRoom(page, 'PDF Küche');
  await page.getByRole('button', { name: 'Belag', exact: true }).click();
  await setNumber(page, 'Länge', '60'); await setNumber(page, 'Breite', '30'); await setNumber(page, 'Fuge', '3');
  await page.getByRole('button', { name: 'Verlegung', exact: true }).click();
  await page.getByRole('button', { name: 'Drittelverband', exact: true }).click();
  await setNumber(page, 'Versatz X', '12');
  await page.getByRole('button', { name: 'Raum', exact: true }).click();
  await page.locator('summary').filter({ hasText: /^Hindernisse/ }).click();
  await page.getByRole('button', { name: 'Hindernis hinzufügen', exact: true }).click();
  for (const [label, value] of [['X', '100'], ['Y', '100'], ['Breite', '50'], ['Tiefe', '40']]) await setNumber(page, `Hindernis 1, ${label}`, value);
  await openFloorPlan(page, 1); await drawRoom(page, 'PDF Wohnen', 1, 1);
  await page.getByRole('button', { name: 'Belag', exact: true }).click();
  await page.getByRole('button', { name: 'Diele', exact: true }).click();
  await setNumber(page, 'Länge', '180'); await setNumber(page, 'Breite', '20');
  await page.getByRole('button', { name: 'Verlegung', exact: true }).click();
  await page.getByRole('button', { name: 'Wilder Verband', exact: true }).click();
  await selectRoom(page, 'PDF Küche');
  await page.getByRole('button', { name: 'Belag', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fliese', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: 'Länge', exact: true })).toHaveValue('60');
  await expect(page.getByRole('textbox', { name: 'Breite', exact: true })).toHaveValue('30');

  await openFloorPlan(page, 2);
  await expect(page.getByRole('navigation', { name: 'Schritte zum Verlegeplan' }).getByRole('button', { name: 'Raum', exact: true })).toBeDisabled();
  await calibrate(page, 2); await drawRoom(page, 'PDF Bad', 2);
  assertRoom(roomNamed(await storedWorkspace(page), 'PDF Bad'), manifest.pages[1].rooms[0]);
  await openFloorPlan(page, 3); await calibrate(page, 3); await drawRoom(page, 'PDF Scan', 3);
  assertRoom(roomNamed(await storedWorkspace(page), 'PDF Scan'), manifest.pages[2].rooms[0]);
  const beforeBuilding = await storedBuilding(page);
  const beforeRooms = beforeBuilding.floors.flatMap(floor => floor.workspace.rooms);
  const before = { ...(await storedWorkspace(page)), rooms: beforeRooms };
  expect(beforeBuilding.floors).toHaveLength(3);
  expect(before.floorPlan!.pages.map(p => p.rotation)).toEqual([0, 90, 0]);
  expect(beforeBuilding.floors.map(floor => floor.workspace.floorPlan!.pages[floor.workspace.floorPlan!.activePage - 1].calibration!.lengthMm)).toEqual([4800, 2000, 3000]);
  assertRoom(roomNamed(before, 'PDF Küche'), manifest.pages[0].rooms[0]);
  assertRoom(roomNamed(before, 'PDF Wohnen'), manifest.pages[0].rooms[1]);

  await openFloorPlan(page, 1); await calibrate(page, 1, 'precise', 2400);
  const afterBuilding = await storedBuilding(page);
  const after = { ...(await storedWorkspace(page)), rooms: afterBuilding.floors.flatMap(floor => floor.workspace.rooms) };
  for (const name of ['PDF Küche', 'PDF Wohnen']) {
    const current = roomNamed(after, name), previous = roomNamed(before, name);
    assertRoom(current, { widthMm: 2400, heightMm: 2600, areaM2: 6.24 });
    expect(current.project.material).toEqual(previous.project.material);
    expect(current.project.layout).toEqual(previous.project.layout);
    expect(current.source).toEqual(previous.source);
  }
  expect(roomNamed(after, 'PDF Küche').project.room.obstacles[0]).toMatchObject({ x: 500, y: 500, width: 250, height: 200 });
  expect(roomNamed(after, 'PDF Bad')).toEqual(roomNamed(before, 'PDF Bad'));
  expect(roomNamed(after, 'PDF Scan')).toEqual(roomNamed(before, 'PDF Scan'));
  await page.getByRole('navigation', { name: 'Schritte zum Verlegeplan' }).getByRole('button', { name: 'Prüfen', exact: true }).click();
  await page.getByRole('region', { name: 'Räume auf Seite 1', exact: true }).getByRole('button', { name: 'PDF Wohnen öffnen', exact: true }).click();
  await page.getByRole('button', { name: 'Belag', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Diele', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: 'Länge', exact: true })).toHaveValue('180');
});

test('IndexedDB und vollständiger JSON-Roundtrip erhalten Original-PDF, Räume und Einstellungen', async ({ page, browser }) => {
  test.setTimeout(90_000);
  await upload(page); await calibrate(page); await drawRoom(page, 'PDF Küche');
  await page.getByRole('button', { name: 'Belag', exact: true }).click();
  await setNumber(page, 'Länge', '79,8'); await setNumber(page, 'Breite', '39,8');
  await openFloorPlan(page, 2); await calibrate(page, 2); await drawRoom(page, 'PDF Bad', 2);
  await page.getByRole('button', { name: 'Verlegung', exact: true }).click();
  await page.getByRole('button', { name: 'Diagonalverband', exact: true }).click();
  await openFloorPlan(page, 2);
  await expect.poll(async () => {
    const workspace = await storedWorkspace(page);
    return workspace.rooms.find(room => room.id === workspace.activeRoomId)!.project.layout.pattern;
  }).toBe('diagonal');
  const before = await storedWorkspace(page);
  const beforeBuilding = await storedBuilding(page);
  expect(await indexedPdf(page, before.floorPlan!.id)).toEqual(Array.from(pdfBytes));
  await page.reload(); await openFloorPlan(page, 2);
  expect(await storedWorkspace(page)).toEqual(before);
  expect(await indexedPdf(page, before.floorPlan!.id)).toEqual(Array.from(pdfBytes));
  const exported = await exportFile(page);
  expect(exported.data.format).toBe('fugenplan'); expect(exported.data.version).toBe(3);
  expect(exported.data.building).toEqual(beforeBuilding);
  expect(exported.data.assets).toHaveLength(1);
  expect(Buffer.from(exported.data.assets[0].pdfBase64, 'base64')).toEqual(pdfBytes);

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'de-DE', reducedMotion: 'reduce' });
  const restored = await context.newPage(); observe(restored);
  try {
    await restored.goto(new URL('/', page.url()).href);
    await expect(restored.getByRole('heading', { name: 'Deine Projekte', exact: true })).toBeVisible();
    await restored.getByLabel('Projektdatei öffnen', { exact: true }).setInputFiles({ name: 'vollstaendig.fugenplan.json', mimeType: 'application/json', buffer: Buffer.from(exported.contents) });
    await expect(restored.getByRole('heading', { name: 'Seite 2', exact: true }).first()).toBeVisible();
    await expect.poll(async () => (await storedWorkspace(restored)).rooms.length).toBe(before.rooms.length);
    expect(buildingContents(await storedBuilding(restored))).toEqual(buildingContents(beforeBuilding));
    expect(await indexedPdf(restored, before.floorPlan!.id)).toEqual(Array.from(pdfBytes));
    await openFloorPlan(restored, 2);
    const second = await exportFile(restored);
    expect(buildingContents(second.data.building)).toEqual(buildingContents(exported.data.building));
    expect(second.data.assets).toEqual(exported.data.assets);
    await restored.reload(); await openFloorPlan(restored, 2);
    expect(errors.get(restored)).toEqual([]);
  } finally { await context.close(); }
});

test('Fehlerhafte PDF und JSON erhalten das bereits geladene Projekt', async ({ page }) => {
  await upload(page); await calibrate(page); await drawRoom(page, 'PDF bleibt');
  const saved = await exportFile(page);
  const before = await storedWorkspace(page);
  await openFloorPlan(page, 1);
  await page.getByLabel('PDF-Grundriss öffnen', { exact: true }).setInputFiles({ name: 'defekt.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nno objects\n%%EOF') });
  await expect(page.getByRole('alert').filter({ hasText: /PDF/ })).toBeVisible();
  expect(await storedWorkspace(page)).toEqual(before);
  await readyPdf(page);
  await page.getByRole('button', { name: 'Hinweis schließen', exact: true }).click();

  await page.getByLabel('Projektdatei öffnen', { exact: true }).setInputFiles({ name: 'defekt.json', mimeType: 'application/json', buffer: Buffer.from('{invalid json') });
  await expect(page.locator('.toast')).toContainText('Die Datei ist keine gültige Projektdatei.');
  expect(await storedWorkspace(page)).toEqual(before);
  await page.getByLabel('Projektdatei öffnen', { exact: true }).setInputFiles({ name: 'falsche-pdf.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...saved.data, assets: saved.data.assets.map(asset => ({ ...asset, pdfBase64: 'defekt?' })) })) });
  await expect(page.locator('.toast')).toContainText('PDF');
  expect(await storedWorkspace(page)).toEqual(before);
  expect(await indexedPdf(page, before.floorPlan!.id)).toEqual(Array.from(pdfBytes));
  await readyPdf(page);
});

test('Mobile PDF-Bedienung: präzise Tastaturpunkte, Raum übernehmen und sichtbare Bedienelemente', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await upload(page); await noOverflow(page);
  await calibrate(page, 1);
  await drawRoom(page, 'Mobiler PDF-Raum');
  assertRoom(roomNamed(await storedWorkspace(page), 'Mobiler PDF-Raum'), manifest.pages[0].rooms[0]);
  await noOverflow(page);
  await openFloorPlan(page, 1);
  if (await page.getByRole('button', { name: 'Meldung schließen', exact: true }).count()) await page.getByRole('button', { name: 'Meldung schließen', exact: true }).click();
  await page.getByTestId('pdf-stage').scrollIntoViewIfNeeded();
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/mobile-fullpage.png`, fullPage: true });
  await page.screenshot({ path: `${evidence}/mobile-390x844.png` });
  await mkdir('tests/screenshots', { recursive: true });
  await copyFile(`${evidence}/mobile-390x844.png`, 'tests/screenshots/pdf-mobile.png');
  await noOverflow(page); await accessible(page);
  await page.getByRole('button', { name: 'PDF vergrößern', exact: true }).click();
  await expect(page.getByLabel('PDF-Zoom', { exact: true })).toHaveText('125 %');
  await page.getByRole('button', { name: 'PDF einpassen', exact: true }).click();
  await expect(page.getByLabel('PDF-Zoom', { exact: true })).toHaveText('100 %');
  await noOverflow(page);
});

test('PDF-Renderer, Worker, Schriften und Eingaben verwenden nur lokale Requests', async ({ page }) => {
  await upload(page); await calibrate(page); await drawRoom(page, 'Lokaler PDF-Raum');
  await openFloorPlan(page, 3); await calibrate(page, 3);
  await page.getByRole('button', { name: 'PDF vergrößern', exact: true }).click();
  await readyPdf(page, 3);
  // readyPdf checks rendered pixels; await fonts instead of disposed worker requests.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const urls = requests.get(page)!;
  expect(urls.some(url => url.includes('pdf.worker'))).toBe(true);
  const external = urls.filter(url => /^(https?|wss?):/.test(url)).filter(url => new URL(url).host !== new URL(page.url()).host);
  expect(external).toEqual([]);
});

test('Fehlende PDF in IndexedDB lässt sich ohne Verlust der Räume und Maßstäbe wiederherstellen', async ({ page }) => {
  test.setTimeout(60_000);
  await upload(page); await calibrate(page); await drawRoom(page, 'Erhaltener PDF-Raum');
  await page.getByRole('button', { name: 'Belag', exact: true }).click();
  await setNumber(page, 'Länge', '89,8'); await setNumber(page, 'Breite', '29,8');
  await openFloorPlan(page, 2); await calibrate(page, 2);
  await drawRoom(page, 'Zweiter erhaltener Raum', 2);
  const before = await storedWorkspace(page);
  // Simulate browser storage eviction. Actual PDF bytes are removed, without mocking the renderer.
  await page.evaluate(async id => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('fugenplan-pdf-v1');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('documents', 'readwrite');
        transaction.objectStore('documents').delete(id);
        transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error);
      });
    } finally { db.close(); }
  }, before.floorPlan!.id);
  await page.reload();
  await expect(page.locator('.save-status')).toContainText('PDF fehlt');
  await page.getByRole('button', { name: 'Raumplan', exact: true }).click();
  await expect(floorPlan(page)).toBeVisible();
  expect(await storedWorkspace(page)).toEqual(before);
  await page.getByRole('button', { name: 'Exportieren', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Plan mitnehmen', exact: true });
  const downloads: string[] = [];
  page.on('download', file => downloads.push(file.suggestedFilename()));
  await dialog.getByRole('button', { name: /^Projektdatei/ }).click();
  await expect(dialog.getByRole('alert')).toContainText('PDF');
  expect(downloads).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Grundriss', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'PDF-Datei erneut öffnen', exact: true })).toBeVisible();
  await expect(page.locator('.fpdf-file-name')).toContainText('Original-PDF nicht geladen');
  await expect(page.getByRole('button', { name: 'Weiteren Raum markieren', exact: true })).toBeDisabled();
  await page.getByLabel('PDF-Grundriss öffnen', { exact: true }).setInputFiles(fixture);
  await readyPdf(page, 2);
  await expect(page.locator('.toast')).toContainText('PDF wiederhergestellt. Maßstab und Räume sind erhalten.');
  await expect(page.locator('.save-status')).not.toContainText('PDF fehlt');
  expect(await storedWorkspace(page)).toEqual(before);
  expect(await indexedPdf(page, before.floorPlan!.id)).toEqual(Array.from(pdfBytes));
  const recovered = await exportFile(page);
  expect(recovered.data.building.floors.find(floor => floor.id === recovered.data.building.activeFloorId)!.workspace).toEqual(before);
  expect(Buffer.from(recovered.data.assets[0].pdfBase64, 'base64')).toEqual(pdfBytes);
});
