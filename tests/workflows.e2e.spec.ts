import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import type { ProjectLibrary } from '../src/floorplan-types';
import { DEFAULT_PROJECT } from '../src/lib/project';
import { createFloor, createProject, libraryHome, libraryKey, setField, storedBuilding, storedLibrary, storedRoom, storedWorkspace } from './helpers';

const errors = new WeakMap<Page, string[]>();
async function exportFile(page: Page) {
  await page.getByRole('button', { name: 'Exportieren', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Plan mitnehmen', exact: true });
  const pending = page.waitForEvent('download');
  await dialog.getByRole('button', { name: /^Projektdatei/ }).click();
  const file = await pending;
  expect(await file.failure()).toBeNull();
  const content = await readFile((await file.path())!, 'utf8');
  await page.keyboard.press('Escape');
  return { name: file.suggestedFilename(), content, data: JSON.parse(content) };
}
async function importJson(page: Page, content: unknown, name = 'testprojekt.json', trigger?: string) {
  const file = {
    name, mimeType: 'application/json', buffer: Buffer.from(typeof content === 'string' ? content : JSON.stringify(content)),
  };
  if (trigger) {
    const pending = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: trigger, exact: true }).click();
    await (await pending).setFiles(file);
  } else await page.getByLabel('Projektdatei öffnen', { exact: true }).setInputFiles(file);
}
async function addRoom(page: Page, name: string) {
  await page.getByRole('button', { name: 'Raum hinzufügen', exact: true }).click();
  await setField(page, 'Raumname', name);
  await expect(page.getByTestId('floor-plan')).toBeVisible();
}
async function seed(page: Page, library: ProjectLibrary) {
  await page.addInitScript(value => localStorage.setItem('fugenplan.library.v3', JSON.stringify(value)), library);
  await page.reload();
}
function fixtureLibrary(): ProjectLibrary {
  return { version: 3, activeProjectId: 'project', projects: [{
    id: 'project', name: 'Grenzhaus', activeFloorId: 'floor', floors: [{
      id: 'floor', name: 'Erdgeschoss', workspace: {
        version: 2, activeRoomId: 'room', rooms: [{ id: 'room', project: structuredClone(DEFAULT_PROJECT) }],
      },
    }],
  }] };
}

test.beforeEach(async ({ page }) => {
  errors.set(page, []);
  page.on('pageerror', error => errors.get(page)!.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Deine Projekte', exact: true })).toBeVisible();
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));

test('Leere Projekte und Etagen werden vollständig exportiert und als zusätzliche Projekte wieder geöffnet', async ({ page }) => {
  await createProject(page, 'Leeres Haus');
  const empty = await exportFile(page);
  expect(empty.data).toMatchObject({ format: 'fugenplan', version: 3, assets: [], building: { name: 'Leeres Haus', floors: [], activeFloorId: '' } });
  await importJson(page, empty.content);
  await expect.poll(async () => (await storedLibrary(page)).projects.length).toBe(2);
  await createFloor(page, 'Leeres Erdgeschoss');
  await expect(page.getByRole('button', { name: 'Raumplan', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Varianten', exact: true })).toBeDisabled();
  const floorFile = await exportFile(page);
  expect(floorFile.data.building.floors[0]).toMatchObject({
    name: 'Leeres Erdgeschoss', workspace: { version: 2, rooms: [], activeRoomId: '' },
  });
  expect(floorFile.data.assets).toEqual([]);
  await importJson(page, floorFile.content);
  await expect.poll(async () => (await storedLibrary(page)).projects.length).toBe(3);
  const library = await storedLibrary(page);
  expect(library.projects.map(project => project.floors.length)).toEqual([0, 1, 1]);
  expect(new Set(library.projects.map(project => project.id)).size).toBe(3);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Leeres Erdgeschoss', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Raum hinzufügen', exact: true })).toBeEnabled();
});

test('Alte Einzelraum- und Mehrraumdateien werden über die Oberfläche migriert, defektes JSON erhält alle Projekte', async ({ page }) => {
  await createProject(page, 'Bestehendes Projekt');
  const v1 = { ...structuredClone(DEFAULT_PROJECT), name: 'Alter Einzelraum' };
  await libraryHome(page);
  await importJson(page, v1, 'einzelraum.json', 'Gespeichertes Projekt importieren');
  await expect.poll(async () => (await storedLibrary(page)).projects.length).toBe(2);
  await page.getByRole('button', { name: 'Raumplan', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Raumname', exact: true })).toHaveValue('Alter Einzelraum');
  expect(await storedRoom(page)).toEqual(v1);
  const v2 = {
    format: 'fugenplan', version: 2, workspace: { version: 2, activeRoomId: 'old-b', rooms: [
      { id: 'old-a', project: { ...structuredClone(DEFAULT_PROJECT), name: 'Alt A' } },
      { id: 'old-b', project: { ...structuredClone(DEFAULT_PROJECT), name: 'Alt B' } },
    ] },
  };
  await importJson(page, v2, 'mehrere-raeume.json', 'Öffnen');
  await expect.poll(async () => (await storedLibrary(page)).projects.length).toBe(3);
  await page.getByRole('button', { name: 'Raumplan', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Raumname', exact: true })).toHaveValue('Alt B');
  const building = await storedBuilding(page);
  expect(building.floors[0].workspace.rooms.map(room => room.project.name)).toEqual(['Alt A', 'Alt B']);
  expect(building.floors[0].workspace.rooms.every(room => !['old-a', 'old-b'].includes(room.id))).toBe(true);
  const before = await storedLibrary(page);
  await importJson(page, '{');
  await expect(page.locator('.toast')).toContainText('keine gültige Projektdatei');
  expect(await storedLibrary(page)).toEqual(before);
  await page.getByRole('button', { name: 'Meldung schließen', exact: true }).click();
  await expect(page.locator('.toast')).toHaveCount(0);
  await libraryHome(page);
  await expect(page.getByRole('button', { name: 'Bestehendes Projekt öffnen', exact: true })).toBeVisible();
});

test('Bei vollem Browserspeicher bleiben Bearbeitung und vollständige Sicherung in einem neuen Browserkontext nutzbar', async ({ page, browser }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key: string, value: string) {
      if (key === 'fugenplan.library.v3') throw new DOMException('Simuliertes Speicherlimit', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.reload();
  await createProject(page, 'Sicherbares Haus');
  await createFloor(page, 'Erdgeschoss');
  await addRoom(page, 'Trotz Speicherfehler');
  await setField(page, 'Breite', '431,2');
  await expect(page.locator('.save-status')).toContainText('Nicht gespeichert');
  await expect(page.locator('.toast')).toContainText('Sichere deine Planung über „Projektdatei“');
  expect(await page.evaluate(key => localStorage.getItem(key), libraryKey)).toBeNull();
  const file = await exportFile(page);
  const saved = file.data.building.floors[0].workspace.rooms[0].project;
  expect(saved).toMatchObject({ name: 'Trotz Speicherfehler', room: { width: 4312 } });
  const context = await browser.newContext({ locale: 'de-DE' });
  try {
    const restored = await context.newPage();
    const restoredErrors: string[] = [];
    restored.on('pageerror', error => restoredErrors.push(error.message));
    await restored.goto(new URL('/', page.url()).href);
    await importJson(restored, file.content, file.name);
    await expect.poll(async () => (await storedLibrary(restored)).projects.length).toBe(1);
    await restored.getByRole('button', { name: 'Raumplan', exact: true }).click();
    await expect(restored.getByRole('textbox', { name: 'Breite', exact: true })).toHaveValue('431,2');
    expect(await storedRoom(restored)).toEqual(saved);
    await restored.reload();
    await restored.getByRole('button', { name: 'Raumplan', exact: true }).click();
    await expect(restored.getByRole('textbox', { name: 'Raumname', exact: true })).toHaveValue('Trotz Speicherfehler');
    expect(restoredErrors).toEqual([]);
  } finally { await context.close(); }
});

test('Projekt-, Etagen- und Raumgrenzen erhalten bestehende Daten und geben nach Entfernen wieder Platz frei', async ({ page }) => {
  test.setTimeout(60_000);
  // A boundary fixture avoids repeating the already tested create workflow 120 times.
  const library = fixtureLibrary();
  const building = library.projects[0];
  const first = building.floors[0];
  first.workspace.rooms = Array.from({ length: 50 }, (_, index) => ({
    id: 'room-' + index, project: { ...structuredClone(DEFAULT_PROJECT), name: 'Raum ' + (index + 1) },
  }));
  first.workspace.activeRoomId = 'room-0';
  for (let i = 1; i < 50; i++) building.floors.push({
    id: 'floor-' + i, name: 'Etage ' + (i + 1), workspace: { version: 2, activeRoomId: '', rooms: [] },
  });
  for (let i = 1; i < 20; i++) library.projects.push({ id: 'project-' + i, name: 'Projekt ' + (i + 1), activeFloorId: '', floors: [] });
  await seed(page, library);
  await expect(page.getByRole('button', { name: 'Raum hinzufügen', exact: true })).toBeDisabled();
  await libraryHome(page);
  await page.getByRole('button', { name: 'Neues Projekt', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Projektname' }).fill('Ein Projekt zu viel');
  await dialog.getByRole('button', { name: 'Projekt anlegen', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('höchstens 20 Projekte');
  await dialog.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await page.getByRole('button', { name: 'Grenzhaus öffnen', exact: true }).click();
  await page.getByRole('complementary', { name: 'Projektnavigation' }).getByRole('button', { name: 'Etage hinzufügen', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Etagenname' }).fill('Eine Etage zu viel');
  await dialog.getByRole('button', { name: 'Etage anlegen', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('höchstens 50 Etagen');
  await dialog.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  const before = await storedLibrary(page);
  expect(before.projects).toHaveLength(20);
  expect(before.projects[0].floors).toHaveLength(50);
  expect(before.projects[0].floors[0].workspace.rooms).toHaveLength(50);
  await page.getByRole('button', { name: 'Position von Raum 50 festlegen', exact: true }).click();
  const placement = page.getByRole('dialog');
  await placement.getByRole('textbox', { name: 'X in cm' }).fill('abc');
  await placement.getByRole('textbox', { name: 'Y in cm' }).fill('0');
  await placement.getByRole('button', { name: 'Position speichern', exact: true }).click();
  await expect(placement.getByRole('alert')).toContainText('zwischen');
  await placement.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  expect(await storedLibrary(page)).toEqual(before);
  await page.getByRole('button', { name: 'Raum 50 entfernen', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Raum entfernen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Raum hinzufügen', exact: true })).toBeEnabled();
  await expect.poll(async () => (await storedWorkspace(page)).rooms.length).toBe(49);
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Raum hinzufügen', exact: true })).toBeDisabled();
  await expect.poll(() => storedLibrary(page)).toEqual(before);
});

test('Grenzen für Eckpunkte und Hindernisse sowie numerische Pfeiltasten bleiben bedienbar', async ({ page }) => {
  const library = fixtureLibrary();
  const project = library.projects[0].floors[0].workspace.rooms[0].project;
  project.room.shape = 'custom';
  project.room.points = Array.from({ length: 32 }, (_, index) => ({
    x: Math.round(2100 + 2000 * Math.cos(index * Math.PI / 16)),
    y: Math.round(1800 + 1700 * Math.sin(index * Math.PI / 16)),
  }));
  project.room.obstacles = Array.from({ length: 24 }, (_, index) => ({
    id: 'obstacle-' + index, x: 1500 + index % 8 * 100, y: 1400 + Math.floor(index / 8) * 100, width: 50, height: 50,
  }));
  await seed(page, library);
  await page.getByRole('button', { name: 'Raumplan', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Punkt hinzufügen', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Hindernis hinzufügen', exact: true })).toBeDisabled();
  const x = page.getByRole('textbox', { name: 'Punkt 1, X', exact: true });
  await x.focus();
  await x.press('ArrowUp');
  await x.press('ArrowUp');
  await x.press('ArrowDown');
  await x.press('Tab');
  await expect.poll(async () => (await storedRoom(page)).room.points[0].x).toBe(project.room.points[0].x + 1);
  await page.getByRole('button', { name: 'Punkt 32 entfernen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Punkt hinzufügen', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Punkt hinzufügen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Punkt hinzufügen', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Hindernis 24 entfernen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Hindernis hinzufügen', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Hindernis hinzufügen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Hindernis hinzufügen', exact: true })).toBeDisabled();
  await expect.poll(async () => {
    const room = (await storedRoom(page)).room;
    return [room.points.length, room.obstacles.length];
  }).toEqual([32, 24]);
  await expect(page.getByTestId('floor-plan')).toBeVisible();
});

test('PDF per Drag-and-drop, ungültige Maßangaben, Tastaturkontur und Entfernen des letzten PDF-Raums', async ({ page }) => {
  test.setTimeout(60_000);
  await createProject(page, 'PDF Tastaturhaus');
  await createFloor(page, 'Erdgeschoss');
  await page.getByRole('button', { name: 'Grundriss', exact: true }).click();
  const input = page.getByLabel('PDF-Grundriss öffnen', { exact: true });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'PDF auswählen', exact: true }).click();
  await (await chooser).setFiles({ name: 'leer.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) });
  await expect(page.getByRole('alert')).toContainText('Datei ist leer');
  await input.setInputFiles({ name: 'zu-gross.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(20 * 1024 * 1024 + 1) });
  await expect(page.getByRole('alert')).toContainText('höchstens 20 MiB');
  await input.setInputFiles({ name: 'keine-pdf.txt', mimeType: 'text/plain', buffer: Buffer.from('Keine PDF') });
  await expect(page.getByRole('alert')).toContainText('Bitte wähle eine PDF-Datei');
  const bytes = await readFile(new URL('./fixtures/grundriss-drei-seiten.pdf', import.meta.url));
  const transfer = await page.evaluateHandle(data => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(data)], 'grundriss-drei-seiten.pdf', { type: 'application/pdf' }));
    transfer.items.add(new File([new Uint8Array(data)], 'zweite.pdf', { type: 'application/pdf' }));
    return transfer;
  }, Array.from(bytes));
  const wizard = page.locator('.fpdf-editor');
  await wizard.dispatchEvent('dragenter', { dataTransfer: transfer });
  await expect(page.getByText('PDF zum Öffnen ablegen', { exact: true })).toBeVisible();
  await wizard.dispatchEvent('drop', { dataTransfer: transfer });
  await expect(page.getByRole('alert')).toContainText('jeweils eine PDF-Datei');
  await transfer.evaluate(value => value.items.remove(1));
  await wizard.dispatchEvent('drop', { dataTransfer: transfer });
  const overlay = page.getByTestId('pdf-overlay');
  await expect(overlay).toBeVisible();
  await page.getByRole('button', { name: 'Seite verwenden', exact: true }).click();
  await page.getByRole('button', { name: 'Wand markieren', exact: true }).click();
  await page.locator('details.fpdf-precise summary').click();
  const point = async (x: string, y: string) => {
    const precise = page.locator('details.fpdf-precise');
    if (await precise.getAttribute('open') === null) await precise.locator('summary').click();
    await page.getByRole('textbox', { name: 'X auf Seite', exact: true }).fill(x);
    await page.getByRole('textbox', { name: 'Y auf Seite', exact: true }).fill(y);
    await page.getByRole('button', { name: 'Punkt setzen', exact: true }).click();
  };
  await point('101', '17,5');
  await expect(page.getByRole('alert')).toContainText('zwischen 0 und 100');
  await point('10', '17,5');
  await point('10', '17,5');
  await expect(page.getByRole('alert')).toContainText('verschiedene Punkte');
  await point('50', '17,5');
  await page.getByRole('textbox', { name: 'Länge der Wand', exact: true }).fill('0');
  await page.getByRole('button', { name: 'Maßstab speichern', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('größer als 0');
  await page.getByRole('textbox', { name: 'Länge der Wand', exact: true }).fill('480');
  await page.getByRole('textbox', { name: 'Länge der Wand', exact: true }).press('Enter');
  await expect.poll(async () => (await storedWorkspace(page)).floorPlan?.pages[0].calibration?.lengthMm).toBe(4800);
  await overlay.press('+');
  await expect(page.getByLabel('PDF-Zoom')).toHaveText('125 %');
  await overlay.press('-');
  await expect(page.getByLabel('PDF-Zoom')).toHaveText('100 %');
  await page.getByRole('button', { name: 'Raum markieren', exact: true }).click();
  await page.getByRole('button', { name: 'PDF-Ansicht verschieben', exact: true }).click();
  const position = await page.locator('.fpdf-paper').boundingBox();
  await overlay.press('ArrowRight');
  await expect.poll(async () => (await page.locator('.fpdf-paper').boundingBox())?.x).not.toBe(position!.x);
  await page.getByRole('button', { name: 'PDF einpassen', exact: true }).click();
  await page.getByRole('button', { name: 'Punkte markieren', exact: true }).click();
  const scale = (await overlay.boundingBox())!.width / 600;
  await overlay.press('Enter');
  for (const direction of ['Right', 'Down', 'Left']) {
    await overlay.press('Shift+Arrow' + direction);
    await overlay.press('Shift+Arrow' + direction);
    await overlay.press('Enter');
  }
  await expect(page.getByText('4 von 32 Eckpunkten', { exact: true })).toBeVisible();
  await overlay.press('Control+z');
  await expect(page.getByText('3 von 32 Eckpunkten', { exact: true })).toBeVisible();
  await overlay.press('Enter');
  await page.getByRole('button', { name: 'Letzten Punkt entfernen', exact: true }).click();
  await expect(page.getByText('3 von 32 Eckpunkten', { exact: true })).toBeVisible();
  await overlay.press('Enter');
  await point('50', '50');
  await expect(page.getByText('Geschlossen', { exact: true })).toBeVisible();
  const name = page.getByRole('textbox', { name: 'Raumname', exact: true });
  await name.fill('');
  await page.getByRole('button', { name: 'Raum übernehmen', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Namen');
  await name.fill('Tastaturraum');
  await name.press('Enter');
  await expect(page.getByRole('heading', { name: 'Raum übernommen', exact: true })).toBeVisible();
  const workspace = await storedWorkspace(page);
  await expect.poll(async () => (await storedWorkspace(page)).rooms.length).toBe(1);
  const room = (await storedWorkspace(page)).rooms[0];
  expect(room.project.room.width).toBeCloseTo(400 / scale, 2);
  expect(room.project.room.height).toBeCloseTo(400 / scale, 2);
  await page.getByRole('button', { name: 'Zur Etagenansicht', exact: true }).click();
  const floor = page.getByRole('group', { name: 'Etagenplan Erdgeschoss', exact: true });
  await expect(floor.locator('image')).toHaveCount(1);
  await page.getByRole('button', { name: 'Vorlage', exact: true }).click();
  await expect(floor.locator('image')).toHaveCount(0);
  await page.getByRole('button', { name: 'Vorlage', exact: true }).click();
  await expect(floor.locator('image')).toHaveCount(1);
  const initialView = await floor.getAttribute('viewBox');
  await page.getByRole('button', { name: 'Etagenplan vergrößern', exact: true }).click();
  await expect(floor).not.toHaveAttribute('viewBox', initialView!);
  await page.getByRole('button', { name: 'Etagenplan verkleinern', exact: true }).click();
  await expect(floor).toHaveAttribute('viewBox', initialView!);
  const box = (await floor.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 20, { steps: 4 });
  await page.mouse.up();
  await expect(floor).not.toHaveAttribute('viewBox', initialView!);
  await page.getByRole('button', { name: 'Etagenplan einpassen', exact: true }).click();
  await expect(floor).toHaveAttribute('viewBox', initialView!);
  expect((await storedWorkspace(page)).rooms).toEqual([room]);
  await page.getByRole('button', { name: 'Grundriss', exact: true }).click();
  await page.getByRole('button', { name: 'Tastaturraum entfernen', exact: true }).click();
  await page.getByRole('button', { name: 'Behalten', exact: true }).click();
  expect((await storedWorkspace(page)).rooms).toHaveLength(1);
  await page.getByRole('button', { name: 'Tastaturraum entfernen', exact: true }).click();
  await page.getByRole('button', { name: 'Entfernen', exact: true }).click();
  await expect.poll(async () => (await storedWorkspace(page)).rooms.length).toBe(0);
  const empty = await storedWorkspace(page);
  expect(empty.activeRoomId).toBe('');
  expect(empty.floorPlan).toEqual(workspace.floorPlan);
  await page.getByRole('button', { name: 'Zur Etagenansicht', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Erdgeschoss', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Raumplan', exact: true })).toBeDisabled();
});
