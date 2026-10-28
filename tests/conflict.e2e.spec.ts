import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import type { BuildingProject, ProjectLibrary } from '../src/floorplan-types';
import { buildingContents, createFloor, createProject, libraryHome, libraryKey, setField, storedBuilding, storedLibrary } from './helpers';

const pageErrors = new WeakMap<BrowserContext, string[]>();
const conflictMessage = 'Die Projekte wurden in einem anderen Tab geändert.';

function roomWidth(building: BuildingProject, name = 'Wohnen') {
  return building.floors.flatMap(floor => floor.workspace.rooms).find(room => room.project.name === name)?.project.room.width;
}

async function conflictSnapshots(page: Page): Promise<{ key: string; library: ProjectLibrary }[]> {
  return page.evaluate(prefix => Object.keys(localStorage).filter(key => key.startsWith(prefix)).map(key => ({
    key, library: JSON.parse(localStorage.getItem(key)!),
  })), `${libraryKey}.conflict.`);
}

async function createHouse(page: Page): Promise<BuildingProject> {
  await page.goto('/');
  await createProject(page, 'Haus');
  await createFloor(page, 'Erdgeschoss');
  await page.getByRole('button', { name: 'Raum hinzufügen', exact: true }).click();
  await setField(page, 'Raumname', 'Wohnen');
  await setField(page, 'Breite', '480');
  await createFloor(page, 'Obergeschoss');
  await page.getByRole('button', { name: 'Raum hinzufügen', exact: true }).click();
  await setField(page, 'Raumname', 'Bad');
  await setField(page, 'Breite', '240');
  await page.getByRole('navigation', { name: 'Etagen', exact: true }).getByRole('button', { name: 'Erdgeschoss öffnen', exact: true }).click();
  await page.getByRole('button', { name: 'Wohnen bearbeiten', exact: true }).click();
  await expect.poll(async () => {
    const building = await storedBuilding(page);
    return {
      floors: building.floors.length,
      activeFloor: building.floors.find(floor => floor.id === building.activeFloorId)?.name,
      living: roomWidth(building), bath: roomWidth(building, 'Bad'),
    };
  }).toEqual({ floors: 2, activeFloor: 'Erdgeschoss', living: 4800, bath: 2400 });
  return storedBuilding(page);
}

async function openSecondTab(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Erdgeschoss', exact: true })).toBeVisible();
  return page;
}

async function editExternalRoom(page: Page, width = '500') {
  await page.getByRole('button', { name: 'Wohnen bearbeiten', exact: true }).click();
  await setField(page, 'Breite', width);
  await expect.poll(async () => roomWidth((await storedLibrary(page)).projects[0])).toBe(Number(width) * 10);
}

test.beforeEach(({ page, context }) => {
  const errors: string[] = [];
  pageErrors.set(context, errors);
  const observe = (tab: Page) => tab.on('pageerror', error => errors.push(error.message));
  observe(page);
  context.on('page', observe);
});
test.afterEach(({ context }) => expect(pageErrors.get(context)).toEqual([]));

test('Navigation im zweiten Tab bleibt ohne Warnung; eine echte Bearbeitung löst weiter einen Konflikt aus', async ({ page, context }) => {
  test.setTimeout(60_000);
  await createHouse(page);
  await page.getByRole('button', { name: 'Neuen Raum hinzufügen', exact: true }).click();
  await setField(page, 'Raumname', 'Küche');
  await libraryHome(page);
  await createProject(page, 'Anbau');
  await libraryHome(page);
  await page.getByRole('button', { name: 'Haus öffnen', exact: true }).click();
  await page.getByRole('button', { name: 'Wohnen bearbeiten', exact: true }).click();

  const storedSelection = async () => {
    const building = await storedBuilding(page);
    const floor = building.floors.find(item => item.id === building.activeFloorId);
    return {
      project: building.name, floor: floor?.name,
      room: floor?.workspace.rooms.find(room => room.id === floor.workspace.activeRoomId)?.project.name,
    };
  };
  const expectNoConflict = async () => {
    await expect(page.getByText(conflictMessage, { exact: true })).toHaveCount(0);
    await expect(page.getByText('Nicht gespeichert', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Lokal gespeichert', { exact: true })).toBeVisible();
  };

  await expect.poll(storedSelection).toEqual({ project: 'Haus', floor: 'Erdgeschoss', room: 'Wohnen' });
  await expectNoConflict();
  const baseline = await storedLibrary(page);
  expect(baseline.projects).toHaveLength(2);
  expect(baseline.projects[0].floors[0].workspace.rooms.map(room => room.project.name)).toEqual(['Wohnen', 'Küche']);
  const other = await openSecondTab(context);

  await libraryHome(other);
  await other.getByRole('button', { name: 'Anbau öffnen', exact: true }).click();
  await expect.poll(storedSelection).toEqual({ project: 'Anbau', floor: undefined, room: undefined });
  await expectNoConflict();
  await libraryHome(other);
  await other.getByRole('button', { name: 'Haus öffnen', exact: true }).click();
  await expect.poll(storedSelection).toEqual({ project: 'Haus', floor: 'Erdgeschoss', room: 'Wohnen' });
  await expectNoConflict();

  const floors = other.getByRole('navigation', { name: 'Etagen', exact: true });
  await floors.getByRole('button', { name: 'Obergeschoss öffnen', exact: true }).click();
  await expect.poll(storedSelection).toEqual({ project: 'Haus', floor: 'Obergeschoss', room: 'Bad' });
  await expectNoConflict();
  await floors.getByRole('button', { name: 'Erdgeschoss öffnen', exact: true }).click();
  await expect.poll(storedSelection).toEqual({ project: 'Haus', floor: 'Erdgeschoss', room: 'Wohnen' });
  await expectNoConflict();

  await other.getByRole('button', { name: 'Küche bearbeiten', exact: true }).click();
  await expect.poll(storedSelection).toEqual({ project: 'Haus', floor: 'Erdgeschoss', room: 'Küche' });
  await expectNoConflict();
  await other.getByRole('navigation', { name: 'Räume auf dieser Etage', exact: true }).getByRole('button', { name: 'Wohnen', exact: true }).click();
  await expect.poll(storedSelection).toEqual({ project: 'Haus', floor: 'Erdgeschoss', room: 'Wohnen' });
  await expectNoConflict();
  expect(await storedLibrary(page)).toEqual(baseline);
  expect(await conflictSnapshots(page)).toHaveLength(0);

  await setField(other, 'Breite', '505');
  await expect.poll(async () => roomWidth((await storedLibrary(other)).projects[0])).toBe(5050);
  await expect(page.getByText(conflictMessage, { exact: true })).toBeVisible();
  await expect(page.getByText('Nicht gespeichert', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Breite', exact: true })).toHaveValue('480');
});

test('Ein älterer Tab erhält neue externe Projekte und erzeugt bei Navigation keine Projektkopie', async ({ page, context }) => {
  test.setTimeout(60_000);
  const original = await createHouse(page);
  const other = await openSecondTab(context);
  await libraryHome(other);
  await createProject(other, 'Anbau');
  await expect.poll(async () => (await storedLibrary(other)).projects.map(building => building.name)).toEqual(['Haus', 'Anbau']);

  await expect(page.getByText(conflictMessage, { exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Etagen', exact: true }).getByRole('button', { name: 'Obergeschoss öffnen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Obergeschoss', exact: true })).toBeVisible();
  // The stale tab has attempted its delayed save. The newer shared value must survive it.
  await expect.poll(async () => (await conflictSnapshots(page)).length).toBeGreaterThan(0);
  const beforeMerge = await storedLibrary(other);
  expect(beforeMerge.projects.map(building => building.name)).toEqual(['Haus', 'Anbau']);
  expect(beforeMerge.projects[0]).toEqual(original);

  await page.getByRole('button', { name: 'Beide Stände erhalten', exact: true }).click();
  await expect(page.getByText(conflictMessage, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Anbau öffnen', exact: true })).toBeVisible();
  await expect.poll(async () => (await storedLibrary(page)).projects.map(building => building.name)).toEqual(['Haus', 'Anbau']);
  expect((await storedLibrary(page)).projects).toEqual(beforeMerge.projects);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Haus öffnen', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Anbau öffnen', exact: true })).toBeVisible();
  expect((await storedLibrary(page)).projects).toHaveLength(2);
});

test('Zusammenführen erhält unterschiedliche Änderungen desselben Projekts als vollständige Fassungen', async ({ page, context }) => {
  test.setTimeout(60_000);
  await createHouse(page);
  const other = await openSecondTab(context);
  await editExternalRoom(other);
  const external = (await storedLibrary(other)).projects[0];

  await expect(page.getByText(conflictMessage, { exact: true })).toBeVisible();
  await setField(page, 'Breite', '333');
  await expect(page.getByRole('textbox', { name: 'Breite', exact: true })).toHaveValue('333');
  await expect.poll(async () => (await conflictSnapshots(page)).some(snapshot => roomWidth(snapshot.library.projects[0]) === 3330)).toBe(true);
  const local = (await conflictSnapshots(page)).find(snapshot => roomWidth(snapshot.library.projects[0]) === 3330)!.library.projects[0];
  expect(roomWidth((await storedLibrary(other)).projects[0])).toBe(5000);

  await page.getByRole('button', { name: 'Beide Stände erhalten', exact: true }).click();
  await expect(page.getByText(conflictMessage, { exact: true })).toHaveCount(0);
  await expect.poll(async () => (await storedLibrary(page)).projects.length).toBe(2);
  const merged = await storedLibrary(page);
  expect(merged.projects[0]).toEqual(external);
  const own = merged.projects.find(building => building.name === 'Haus (eigene Fassung)')!;
  expect(buildingContents(own)).toEqual({ ...buildingContents(local), name: 'Haus (eigene Fassung)' });
  expect(own.id).not.toBe(external.id);
  expect(own.floors.map(floor => floor.id)).not.toEqual(external.floors.map(floor => floor.id));
  expect(own.floors.flatMap(floor => floor.workspace.rooms.map(room => room.id))).not.toEqual(external.floors.flatMap(floor => floor.workspace.rooms.map(room => room.id)));

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Erdgeschoss', exact: true })).toBeVisible();
  await libraryHome(page);
  await expect(page.getByRole('button', { name: 'Haus öffnen', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Haus (eigene Fassung) öffnen', exact: true })).toBeVisible();
  expect((await storedLibrary(page)).projects).toEqual(merged.projects);
  expect(roomWidth((await storedLibrary(page)).projects[0])).toBe(5000);
  expect(roomWidth((await storedLibrary(page)).projects[1])).toBe(3330);
});

test('Aktuellen Stand laden sichert die lokale Fassung vor dem Ersetzen als Recovery-Snapshot', async ({ page, context }) => {
  test.setTimeout(60_000);
  const baseline = await createHouse(page);
  const other = await openSecondTab(context);
  await editExternalRoom(other, '510');
  const external = await storedLibrary(other);

  await expect(page.getByText(conflictMessage, { exact: true })).toBeVisible();
  await setField(page, 'Breite', '345');
  // Resolve immediately: recovery must not depend on the 220 ms autosave timer.
  await page.getByRole('button', { name: 'Aktuellen Stand laden', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Deine Projekte', exact: true })).toBeVisible();
  await expect(page.getByText(conflictMessage, { exact: true })).toHaveCount(0);
  await expect.poll(async () => (await storedLibrary(page)).projects).toEqual(external.projects);
  const recovered = (await conflictSnapshots(page)).find(snapshot => roomWidth(snapshot.library.projects[0]) === 3450);
  expect(recovered).toBeDefined();
  expect(recovered!.key).toMatch(/^fugenplan\.library\.v3\.conflict\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  const expectedLocal = structuredClone(baseline);
  expectedLocal.floors[0].workspace.rooms[0].project.room.width = 3450;
  expect(recovered!.library.projects).toEqual([expectedLocal]);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Erdgeschoss', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Wohnen bearbeiten', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Breite', exact: true })).toHaveValue('510');
  expect((await conflictSnapshots(page)).find(snapshot => snapshot.key === recovered!.key)).toEqual(recovered);
});
