import { expect, test, type Page } from '@playwright/test';
import type { BuildingProject, ProjectLibrary, WorkspaceRoom } from '../src/floorplan-types';
import { DEFAULT_PROJECT } from '../src/lib/project';
import { LIBRARY_KEY } from '../src/lib/library';

const pdfId = 'a'.repeat(64);
function fixture(withManualPlacement = true): ProjectLibrary {
  const attached: WorkspaceRoom = {
    id: 'pdf-room',
    project: { ...structuredClone(DEFAULT_PROJECT), name: 'Wohnen', room: { ...structuredClone(DEFAULT_PROJECT.room), shape: 'custom', width: 4800, height: 5200, points: [{ x: 0, y: 0 }, { x: 4800, y: 0 }, { x: 4800, y: 5200 }, { x: 0, y: 5200 }] } },
    source: { documentId: pdfId, page: 1, origin: { x: 60, y: 70 }, points: [{ x: 60, y: 70 }, { x: 300, y: 70 }, { x: 300, y: 330 }, { x: 60, y: 330 }] },
  };
  const manual: WorkspaceRoom = {
    id: 'manual-room', project: { ...structuredClone(DEFAULT_PROJECT), name: 'Flur', room: { ...structuredClone(DEFAULT_PROJECT.room), width: 2400, height: 2800 } },
    ...(withManualPlacement ? { placement: { x: 7000, y: 1400 } } : {}),
  };
  const building: BuildingProject = { id: 'house', name: 'Prüfhaus', activeFloorId: 'ground', floors: [{ id: 'ground', name: 'Erdgeschoss', workspace: {
    version: 2, activeRoomId: attached.id, rooms: [attached, manual], floorPlan: { id: pdfId, name: 'Prüfvorlage.pdf', pageCount: 1, activePage: 1, pages: [{ number: 1, width: 600, height: 400, rotation: 0, calibration: { start: { x: 60, y: 70 }, end: { x: 300, y: 70 }, lengthMm: 4800 } }] },
  } }] };
  return { version: 3, activeProjectId: building.id, projects: [building] };
}
async function setup(page: Page, withManualPlacement = true, library = fixture(withManualPlacement)) {
  await page.addInitScript(({ key, library }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(library));
  }, { key: LIBRARY_KEY, library });
  await page.goto('/');
  await expect(page.getByRole('group', { name: 'Etagenplan Erdgeschoss', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rückgängig', exact: true })).toBeDisabled();
  return library;
}
async function saved(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), LIBRARY_KEY) as Promise<ProjectLibrary>;
}
async function dragStart(page: Page, roomId: string) {
  const target = page.locator(`[data-room-id="${roomId}"]`);
  const box = await target.boundingBox();
  if (!box) throw new Error('Raum fehlt in der Etagenzeichnung.');
  // Integer screen coordinates are delivered consistently by Chromium and WebKit.
  const start = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  return { target, start };
}

test('Direktes Anordnen zeigt Vorschau und speichert genau einen rückgängig machbaren Schritt', async ({ page }) => {
  await setup(page);
  const before = await saved(page);
  const originalRoom = before.projects[0].floors[0].workspace.rooms[1];
  await page.getByRole('button', { name: 'Räume anordnen', exact: true }).click();
  const unit = await page.locator('.floor-drawing-svg').evaluate(element => (element as SVGSVGElement).viewBox.baseVal.width / element.getBoundingClientRect().width);
  const { target, start } = await dragStart(page, 'manual-room');
  await page.mouse.move(start.x + 80, start.y + 40, { steps: 10 });
  await expect(target).toHaveAttribute('data-placement-preview', 'true');
  expect((await saved(page)).projects[0].floors[0].workspace.rooms[1]).toEqual(originalRoom);
  await page.mouse.up();
  await expect(target).not.toHaveAttribute('data-placement-preview', 'true');
  const expected = { x: Math.round((7000 + 80 * unit) * 10) / 10, y: Math.round((1400 + 40 * unit) * 10) / 10 };
  await expect.poll(async () => (await saved(page)).projects[0].floors[0].workspace.rooms[1].placement).toEqual(expected);
  expect((await saved(page)).projects[0].floors[0].workspace.rooms[1].project).toEqual(originalRoom.project);
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect.poll(async () => (await saved(page)).projects[0].floors[0].workspace.rooms[1]).toEqual(originalRoom);
  await expect(page.getByRole('button', { name: 'Rückgängig', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Wiederholen', exact: true }).click();
  await expect.poll(async () => (await saved(page)).projects[0].floors[0].workspace.rooms[1].placement).toEqual(expected);
  await page.reload();
  await expect(page.locator('[data-room-id="manual-room"]')).toHaveAttribute('data-origin-x', String(expected.x));
});

test('Escape und Pointercancel verwerfen eine Verschiebung vollständig', async ({ page }) => {
  await setup(page);
  const before = await saved(page);
  await page.getByRole('button', { name: 'Räume anordnen', exact: true }).click();
  const first = await dragStart(page, 'manual-room');
  await page.mouse.move(first.start.x + 70, first.start.y + 30, { steps: 5 });
  await expect(first.target).toHaveAttribute('data-placement-preview', 'true');
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(first.target).not.toHaveAttribute('data-placement-preview', 'true');
  expect(await saved(page)).toEqual(before);
  await expect(page.getByRole('button', { name: 'Rückgängig', exact: true })).toBeDisabled();
  const second = await dragStart(page, 'manual-room');
  await page.mouse.move(second.start.x - 50, second.start.y + 20, { steps: 5 });
  await expect(second.target).toHaveAttribute('data-placement-preview', 'true');
  await page.locator('.floor-drawing-svg').dispatchEvent('pointercancel');
  await page.mouse.up();
  await expect(second.target).not.toHaveAttribute('data-placement-preview', 'true');
  expect(await saved(page)).toEqual(before);
  await expect(page.getByRole('button', { name: 'Rückgängig', exact: true })).toBeDisabled();
});

test('PDF-Räume bleiben gebunden; nicht angeordnete Räume erhalten keine automatische Position', async ({ page }) => {
  await setup(page);
  const before = await saved(page);
  await page.getByRole('button', { name: 'Räume anordnen', exact: true }).click();
  const { target, start } = await dragStart(page, 'pdf-room');
  await expect(target).toHaveAttribute('aria-disabled', 'true');
  await page.mouse.move(start.x + 50, start.y + 20, { steps: 5 });
  await page.mouse.up();
  expect(await saved(page)).toEqual(before);
  await expect(target).not.toHaveAttribute('data-placement-preview', 'true');
  await expect(page.getByRole('button', { name: 'Rückgängig', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Anordnen beenden', exact: true }).click();
  await page.getByRole('button', { name: 'Position von Flur festlegen', exact: true }).click();
  await page.getByRole('button', { name: 'Position aufheben', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Räume anordnen', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-room-id="manual-room"]')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Noch nicht angeordnete Räume' })).toContainText('Flur');
});

test('Positionsdialog bleibt bei 320 px vollständig bedienbar und zeigt nach Drag kompakte Koordinaten', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const library = fixture();
  const workspace = library.projects[0].floors[0].workspace;
  workspace.rooms = workspace.rooms.filter(room => room.id === 'manual-room');
  workspace.activeRoomId = 'manual-room';
  delete workspace.floorPlan;
  await setup(page, true, library);
  await expect(page.locator('.floor-overview-summary')).not.toContainText('Pläne werden berechnet');
  const title = page.getByText('Manuell angeordnet', { exact: true });
  const titleSize = await title.evaluate(element => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return { width: box.width, height: box.height, lineHeight: parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5 };
  });
  expect(titleSize.width).toBeGreaterThan(220);
  expect(titleSize.height).toBeLessThanOrEqual(titleSize.lineHeight * 2);
  await page.getByRole('button', { name: 'Räume anordnen', exact: true }).click();
  const room = page.locator('[data-room-id="manual-room"]');
  await room.scrollIntoViewIfNeeded();
  const unit = await page.locator('.floor-drawing-svg').evaluate(element => (element as SVGSVGElement).viewBox.baseVal.width / element.getBoundingClientRect().width);
  const { start } = await dragStart(page, 'manual-room');
  const endY = Math.round(start.y + (2167.1 - 1400) / unit);
  await page.mouse.move(start.x, endY, { steps: 5 });
  await page.mouse.up();
  const expectedY = Math.round((1400 + (endY - start.y) * unit) * 10) / 10;
  await expect(room).toHaveAttribute('data-origin-y', String(expectedY));
  await room.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Position von „Flur“' });
  const x = dialog.getByRole('textbox', { name: 'X in cm', exact: true });
  const y = dialog.getByRole('textbox', { name: 'Y in cm', exact: true });
  await expect(x).toHaveValue('700');
  await expect(y).toHaveValue(/^\d+(?:\.\d{1,2})?$/);
  expect(Number(await y.inputValue()) * 10).toBeCloseTo(expectedY, 8);
  const displayY = await y.inputValue();
  const dialogBox = await dialog.boundingBox();
  if (!dialogBox) throw new Error('Positionsdialog fehlt.');
  const controls = [x, y, ...['Position aufheben', 'Abbrechen', 'Position speichern'].map(name => dialog.getByRole('button', { name, exact: true }))];
  for (const control of controls) {
    await expect(control).toBeVisible();
    await expect(control).toBeEnabled();
    const box = await control.boundingBox();
    if (!box) throw new Error('Positionsdialog enthält ein unsichtbares Bedienelement.');
    expect(box.x).toBeGreaterThanOrEqual(dialogBox.x);
    expect(box.x + box.width).toBeLessThanOrEqual(dialogBox.x + dialogBox.width);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
  }
  await x.click();
  await expect(x).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(y).toBeFocused();
  await page.screenshot({ path: 'screenshots/hierarchy/position-dialog-320.png' });

  await x.fill('700.123456789012');
  await dialog.getByRole('button', { name: 'Position speichern', exact: true }).click();
  await page.getByRole('button', { name: 'Position von Flur festlegen', exact: true }).click();
  await expect(x).toHaveValue('700.123456789012');
  await expect(y).toHaveValue(displayY);
});
