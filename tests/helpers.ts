import { expect, type Page } from '@playwright/test';
import type { BuildingProject, ProjectLibrary, Workspace } from '../src/floorplan-types';
import type { Project } from '../src/types';
import { DEFAULT_PROJECT } from '../src/lib/project';

export const libraryKey = 'fugenplan.library.v3';

/** Existing room regressions start with real legacy data, then exercise migration once. */
export async function seedLegacyProject(page: Page) {
  await page.addInitScript(project => {
    if (localStorage.getItem('fugenplan.library.v3') === null && localStorage.getItem('fugenplan.workspace.v2') === null) {
      localStorage.setItem('fugenplan.workspace.v2', JSON.stringify({ version: 2, activeRoomId: 'legacy-room', rooms: [{ id: 'legacy-room', project }] }));
    }
  }, DEFAULT_PROJECT);
}

async function readStoredLibrary(page: Page): Promise<ProjectLibrary | null> {
  return page.evaluate(key => {
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? 'null');
      return value?.version === 3 && Array.isArray(value.projects) ? value : null;
    } catch { return null; }
  }, libraryKey);
}

export async function storedLibrary(page: Page): Promise<ProjectLibrary> {
  let current: ProjectLibrary | null = null;
  await expect.poll(async () => {
    current = await readStoredLibrary(page);
    return current !== null;
  }, { message: 'Eine gültige Projektsammlung muss nach der Speicherverzögerung vorliegen' }).toBe(true);
  return current!;
}

export async function storedBuilding(page: Page): Promise<BuildingProject> {
  let current: BuildingProject | undefined;
  await expect.poll(async () => {
    const library = await readStoredLibrary(page);
    current = library?.projects.find(item => item.id === library.activeProjectId);
    return current !== undefined;
  }, { message: 'Ein aktives Projekt muss nach der Speicherverzögerung vorliegen' }).toBe(true);
  return current!;
}

export async function storedWorkspace(page: Page): Promise<Workspace> {
  let current: Workspace | undefined;
  await expect.poll(async () => {
    const library = await readStoredLibrary(page);
    const building = library?.projects.find(item => item.id === library.activeProjectId);
    current = building?.floors.find(item => item.id === building.activeFloorId)?.workspace;
    return current !== undefined;
  }, { message: 'Eine aktive Etage muss nach der Speicherverzögerung vorliegen' }).toBe(true);
  return current!;
}

export async function storedRoom(page: Page): Promise<Project> {
  let current: Project | undefined;
  await expect.poll(async () => {
    const workspace = await storedWorkspace(page);
    current = workspace.rooms.find(item => item.id === workspace.activeRoomId)?.project;
    return current !== undefined;
  }, { message: 'Der aktive Raum muss nach der Speicherverzögerung vorliegen' }).toBe(true);
  return current!;
}

export function buildingContents(building: BuildingProject) {
  return {
    name: building.name,
    activeFloor: building.floors.findIndex(floor => floor.id === building.activeFloorId),
    floors: building.floors.map(floor => ({
      name: floor.name,
      activeRoom: floor.workspace.rooms.findIndex(room => room.id === floor.workspace.activeRoomId),
      floorPlan: floor.workspace.floorPlan,
      rooms: floor.workspace.rooms.map(({ project, source, placement }) => ({ project, source, placement })),
    })),
  };
}

export async function createProject(page: Page, name: string) {
  const first = page.getByRole('button', { name: 'Projekt anlegen', exact: true });
  if (await first.isVisible()) await first.click();
  else await page.getByRole('button', { name: 'Neues Projekt', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Neues Projekt', exact: true });
  await dialog.getByRole('textbox', { name: 'Projektname', exact: true }).fill(name);
  await dialog.getByRole('button', { name: 'Projekt anlegen', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

export async function createFloor(page: Page, name: string) {
  const first = page.getByRole('button', { name: 'Erste Etage anlegen', exact: true });
  if (await first.isVisible()) await first.click();
  else await page.getByRole('complementary', { name: 'Projektnavigation' }).getByRole('button', { name: 'Etage hinzufügen', exact: true }).last().click();
  const dialog = page.getByRole('dialog', { name: 'Neue Etage', exact: true });
  await dialog.getByRole('textbox', { name: 'Etagenname', exact: true }).fill(name);
  await dialog.getByRole('button', { name: 'Etage anlegen', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

export async function setField(page: Page, label: string, value: string) {
  const input = page.getByRole('textbox', { name: label, exact: true });
  await input.fill(value);
  await input.press('Enter');
}

export async function libraryHome(page: Page) {
  await page.getByRole('link', { name: 'Fugenplan, zu den Projekten', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Deine Projekte', exact: true })).toBeVisible();
}

export async function selectPdfPage(page: Page, number: number) {
  await page.getByRole('combobox', { name: 'PDF-Seite', exact: true }).selectOption(String(number));
  const dialog = page.getByRole('dialog', { name: 'PDF-Seite als eigene Etage', exact: true });
  // A used page is its own floor. The UI either opens that floor or asks to create it.
  if (await dialog.isVisible()) await dialog.getByRole('button', { name: 'Etage anlegen', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'PDF-Seite', exact: true })).toHaveValue(String(number));
}
