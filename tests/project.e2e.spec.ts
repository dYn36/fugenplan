import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DEFAULT_PROJECT } from '../src/lib/project';
import { seedLegacyProject, storedWorkspace as stored } from './helpers';
import type { Point } from '../src/types';

const fixture = fileURLToPath(new URL('./fixtures/grundriss-drei-seiten.pdf', import.meta.url));
const pdf = await readFile(fixture);
const manifest = JSON.parse(await readFile(new URL('./fixtures/grundriss-erwartungen.json', import.meta.url), 'utf8')) as {
  pages: { width: number; height: number; calibration: { start: Point; end: Point; lengthMm: number }; rooms: { points: Point[] }[] }[];
};
const steps = (page: Page) => page.getByRole('navigation', { name: 'Schritte zum Verlegeplan' });
const overview = (page: Page) => page.getByRole('region', { name: 'Projektübersicht', exact: true });

async function input(page: Page, label: string, value: string) {
  const field = page.getByRole('textbox', { name: label, exact: true });
  await field.fill(value); await field.press('Enter');
}

async function upload(page: Page, replaceExample = false) {
  await page.getByRole('button', { name: 'Grundriss', exact: true }).click();
  await page.getByLabel('PDF-Grundriss öffnen', { exact: true }).setInputFiles(fixture);
  await expect(page.getByTestId('pdf-overlay')).toBeVisible();
  const usePage = page.getByRole('button', { name: 'Seite verwenden', exact: true });
  await expect(usePage).toBeEnabled();
  if (replaceExample) await page.getByRole('checkbox', { name: /Beispielraum beim ersten Raum ersetzen/ }).check();
  await usePage.click();
}

async function point(page: Page, value: Point) {
  const details = page.locator('.fpdf-precise');
  if (await details.getAttribute('open') === null) await details.locator('summary').click();
  await page.getByRole('textbox', { name: 'X auf Seite', exact: true }).fill(String(value.x / manifest.pages[0].width * 100));
  await page.getByRole('textbox', { name: 'Y auf Seite', exact: true }).fill(String(value.y / manifest.pages[0].height * 100));
  await page.getByRole('button', { name: 'Punkt setzen', exact: true }).click();
}

async function calibrate(page: Page) {
  await page.getByRole('button', { name: 'Wand markieren', exact: true }).click();
  await point(page, manifest.pages[0].calibration.start);
  await point(page, manifest.pages[0].calibration.end);
  await expect(page.getByRole('textbox', { name: 'Länge der Wand', exact: true })).toBeFocused();
  await page.getByRole('textbox', { name: 'Länge der Wand', exact: true }).fill('480');
  await page.getByRole('button', { name: 'Maßstab speichern', exact: true }).click();
  await expect(steps(page).getByRole('button', { name: 'Raum', exact: true })).toHaveAttribute('aria-current', 'step');
  const { start, end, lengthMm } = manifest.pages[0].calibration;
  await expect.poll(async () => (await stored(page)).floorPlan?.pages[0].calibration).toEqual({ start, end, lengthMm });
}

async function markRoom(page: Page, name: string, index: number, next = false) {
  await page.getByRole('button', { name: next ? 'Weiteren Raum markieren' : 'Raum markieren', exact: true }).click();
  await page.getByRole('textbox', { name: 'Raumname', exact: true }).fill(name);
  for (const value of manifest.pages[0].rooms[index].points) await point(page, value);
  await page.getByRole('button', { name: 'Raum übernehmen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Raum übernommen', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Raum übernommen', exact: true })).toBeFocused();
  await expect.poll(async () => (await stored(page)).rooms.some(room => room.project.name === name)).toBe(true);
}

async function accessibility(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => node.target) }))).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await seedLegacyProject(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Etage 1', exact: true })).toBeVisible();
});

test('Manuelle Räume werden ausdrücklich angeordnet; Format 12 × 30 cm bleibt raumbezogen', async ({ page }) => {
  await page.getByRole('button', { name: 'Raum hinzufügen', exact: true }).click();
  await input(page, 'Raumname', 'Küche');
  await input(page, 'Breite', '270');
  await input(page, 'Tiefe', '220');
  await page.getByRole('button', { name: 'Belag', exact: true }).click();
  await page.getByRole('combobox', { name: 'Formatvorgabe', exact: true }).selectOption({ label: '12 × 30 cm' });
  await expect(page.getByRole('textbox', { name: 'Länge', exact: true })).toHaveValue('12');
  await expect(page.getByRole('textbox', { name: 'Breite', exact: true })).toHaveValue('30');
  await expect.poll(async () => (await stored(page)).rooms[1]?.project.material.width).toBe(120);
  expect((await stored(page)).rooms[0].project).toEqual(DEFAULT_PROJECT);
  await page.getByRole('button', { name: 'Etage', exact: true }).click();
  await expect(overview(page).getByRole('region', { name: 'Noch nicht angeordnete Räume' }).getByRole('article')).toHaveCount(2);
  await expect(page.getByRole('group', { name: 'Etagenplan Etage 1', exact: true })).toHaveCount(0);
  for (const [name, x] of [['Wohnzimmer', '0'], ['Küche', '440']]) {
    await page.getByRole('button', { name: `Position von ${name} festlegen`, exact: true }).click();
    await page.getByRole('textbox', { name: 'X in cm', exact: true }).fill(x);
    await page.getByRole('textbox', { name: 'Y in cm', exact: true }).fill('0');
    await page.getByRole('button', { name: 'Position speichern', exact: true }).click();
  }
  const drawing = page.getByRole('group', { name: 'Etagenplan Etage 1', exact: true });
  await expect(drawing.locator('[data-room-id]')).toHaveCount(2);
  await expect(drawing.getByRole('button', { name: 'Küche bearbeiten', exact: true })).toHaveAttribute('data-origin-x', '4400');
  await expect.poll(async () => (await stored(page)).rooms.map(room => room.placement)).toEqual([{ x: 0, y: 0 }, { x: 4400, y: 0 }]);
  await expect(overview(page)).toContainText('21,06 m²');
  const before = await stored(page);
  const viewBox = await drawing.getAttribute('viewBox');
  await page.getByRole('button', { name: 'Etagenplan vergrößern', exact: true }).click();
  await expect(drawing).not.toHaveAttribute('viewBox', viewBox!);
  expect(await stored(page)).toEqual(before);
  await page.getByRole('button', { name: 'Zuschnitte', exact: true }).click();
  await expect(drawing.locator('[data-piece][fill^="url"]')).not.toHaveCount(0);
  await accessibility(page);
  await page.reload();
  await expect(drawing.locator('[data-room-id]')).toHaveCount(2);
  expect((await stored(page)).rooms).toEqual(before.rooms);
});

test('Raum entfernen verlangt benannte Entscheidung; Abbrechen und Rückgängig erhalten den Plan', async ({ page }) => {
  await page.getByRole('button', { name: 'Raum hinzufügen', exact: true }).click();
  await input(page, 'Raumname', 'Bad');
  await page.getByRole('button', { name: 'Etage', exact: true }).click();
  await page.getByRole('button', { name: 'Bad entfernen', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('„Bad“');
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(overview(page).getByRole('article')).toHaveCount(2);
  await page.getByRole('button', { name: 'Bad entfernen', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Raum entfernen', exact: true }).click();
  await expect(overview(page).getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Wohnzimmer entfernen', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect(overview(page).getByRole('article')).toHaveCount(2);
});

test('Wizard übernimmt zwei PDF-Räume ohne Ausstieg und ersetzt das Beispiel nur auf Wunsch', async ({ page }) => {
  // Reload rebuilds the project schema and changes object key order.
  await stored(page);
  await page.reload();
  await upload(page, true);
  await accessibility(page);
  await calibrate(page);
  await markRoom(page, 'PDF Küche', 0);
  await expect.poll(async () => (await stored(page)).rooms.map(room => room.project.name)).toEqual(['PDF Küche']);
  await markRoom(page, 'PDF Wohnen', 1, true);
  await expect(page.getByRole('button', { name: 'Raum prüfen', exact: true })).toBeVisible();
  await expect.poll(async () => (await stored(page)).rooms.length).toBe(2);
  const workspace = await stored(page);
  expect(workspace.floorPlan!.pages[0].calibration!.lengthMm).toBe(4800);
  expect(workspace.rooms.map(room => room.source?.points)).toEqual(manifest.pages[0].rooms.map(room => room.points));
  await accessibility(page);
  await page.getByRole('button', { name: 'Zur Etagenansicht', exact: true }).click();
  await expect(overview(page).locator('.floor-drawing-svg [data-room-id]')).toHaveCount(2);
  await expect(overview(page).locator('.floor-template-name')).toHaveText('grundriss-drei-seiten.pdf · Seite 1');
});

test('Wizard erhält Markierungen beim Zurückgehen und schützt Seiten- sowie Ansichtswechsel', async ({ page }) => {
  await upload(page);
  await calibrate(page);
  await page.getByRole('button', { name: 'Raum markieren', exact: true }).click();
  await page.getByRole('textbox', { name: 'Raumname', exact: true }).fill('Entwurf');
  for (const value of manifest.pages[0].rooms[0].points.slice(0, 3)) await point(page, value);
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Markierung verwerfen?' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Abbrechen', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Zum Maßstab', exact: true }).click();
  await page.getByRole('button', { name: 'Weiter zum Raum', exact: true }).click();
  await expect(page.getByText('3 von 32 Eckpunkten', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Raumname', exact: true })).toHaveValue('Entwurf');
  await page.getByRole('combobox', { name: 'PDF-Seite', exact: true }).selectOption('2');
  await expect(page.getByRole('dialog', { name: 'Markierung verwerfen?' })).toBeVisible();
  await page.getByRole('button', { name: 'Weiter markieren', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'PDF-Seite', exact: true })).toHaveValue('1');
  await expect(page.getByText('3 von 32 Eckpunkten', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Etage', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Markierung verwerfen?' })).toBeVisible();
  await page.getByRole('button', { name: 'Weiter markieren', exact: true }).click();
  await page.getByRole('button', { name: 'Raum übernehmen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Raum übernommen', exact: true })).toBeVisible();
  await expect.poll(async () => (await stored(page)).rooms.length).toBe(2);
});

test('Projektverlauf schützt PDF-Entwürfe auch bei Tastaturbedienung', async ({ page }) => {
  await upload(page);
  await calibrate(page);
  await page.getByRole('button', { name: 'Raum markieren', exact: true }).click();
  for (const value of manifest.pages[0].rooms[0].points.slice(0, 3)) await point(page, value);
  await page.getByTestId('pdf-overlay').focus();
  await page.keyboard.press('Control+Shift+z');
  await expect(page.getByText('3 von 32 Eckpunkten', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const before = await stored(page);
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Markierung verwerfen?' })).toBeVisible();
  await page.getByRole('button', { name: 'Weiter markieren', exact: true }).click();
  await expect(page.getByText('3 von 32 Eckpunkten', { exact: true })).toBeVisible();
  expect(await stored(page)).toEqual(before);
  await steps(page).getByRole('button', { name: 'Raum', exact: true }).focus();
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('dialog', { name: 'Markierung verwerfen?' })).toBeVisible();
  await page.getByRole('button', { name: 'Weiter markieren', exact: true }).click();
  await steps(page).getByRole('button', { name: 'Raum', exact: true }).focus();
  await page.keyboard.press('Control+Shift+z');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('3 von 32 Eckpunkten', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await page.getByRole('button', { name: 'Verwerfen und fortfahren', exact: true }).click();
  await expect.poll(async () => (await stored(page)).floorPlan?.pages[0].calibration).toBeNull();
  await page.getByRole('button', { name: 'Seite verwenden', exact: true }).click();
  await page.getByRole('button', { name: 'Wand markieren', exact: true }).click();
  await point(page, manifest.pages[0].calibration.start);
  await page.getByRole('button', { name: 'Wiederholen', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Markierung verwerfen?' })).toBeVisible();
  await page.getByRole('button', { name: 'Weiter markieren', exact: true }).click();
  await expect(page.getByText('Markiere jetzt das Ende derselben Wand.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Wiederholen', exact: true }).click();
  await page.getByRole('button', { name: 'Verwerfen und fortfahren', exact: true }).click();
  await expect.poll(async () => (await stored(page)).floorPlan?.pages[0].calibration?.lengthMm).toBe(4800);
});

test('PDF ersetzen erklärt den Verlust der Zuordnung und erhält die Raumpläne', async ({ page }) => {
  await upload(page); await calibrate(page); await markRoom(page, 'Erhalten', 0);
  const before = await stored(page);
  const other = { name: 'andere-vorlage.pdf', mimeType: 'application/pdf', buffer: Buffer.concat([pdf, Buffer.from('\n% Zweite Testvorlage\n')]) };
  await page.getByLabel('PDF-Grundriss öffnen', { exact: true }).setInputFiles(other);
  const dialog = page.getByRole('dialog', { name: 'Bisherige PDF ersetzen?', exact: true });
  await expect(dialog).toContainText('Zuordnung');
  await dialog.getByRole('button', { name: 'Bisherige PDF behalten' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel('PDF-Grundriss öffnen', { exact: true })).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await stored(page)).toEqual(before);
  await page.getByLabel('PDF-Grundriss öffnen', { exact: true }).setInputFiles(other);
  await dialog.getByRole('button', { name: 'PDF ersetzen', exact: true }).click();
  await expect.poll(async () => (await stored(page)).floorPlan?.name).toBe('andere-vorlage.pdf');
  const after = await stored(page);
  expect(after.rooms.map(room => room.project)).toEqual(before.rooms.map(room => room.project));
  expect(after.rooms.every(room => !room.source)).toBe(true);
  expect(after.floorPlan!.pages.every(item => item.calibration === null)).toBe(true);
});

test('Mobile Etagenansicht und Raumplan bleiben ohne Überlauf bedienbar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Position von Wohnzimmer festlegen', exact: true }).click();
  await page.getByRole('button', { name: 'Position speichern', exact: true }).click();
  const drawing = page.getByRole('group', { name: 'Etagenplan Etage 1', exact: true });
  await expect(drawing).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(drawing).toBeInViewport();
  await drawing.getByRole('button', { name: 'Wohnzimmer bearbeiten', exact: true }).press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Wohnzimmer', exact: true })).toBeInViewport({ ratio: 1 });
  await input(page, 'Raumname', 'Wohnzimmer mit angrenzendem Essbereich und sehr langem Namen');
  await page.getByRole('button', { name: 'Etage', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await accessibility(page);
  await page.getByRole('button', { name: 'Raumplan', exact: true }).click();
  const positions = await page.evaluate(() => ({ main: document.getElementById('workspace-main')!.getBoundingClientRect().top, settings: document.getElementById('room-settings')!.getBoundingClientRect().top }));
  expect(positions.main).toBeLessThan(positions.settings);
  await page.getByRole('button', { name: 'Raum und Belag einstellen', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Planeinstellungen', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Zur Planvorschau', exact: true }).click();
  await expect(page.getByRole('main')).toBeFocused();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    const targets = await page.locator('.header-actions button, .canvas-tools button, .view-options button').evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect();
      return { name: element.getAttribute('aria-label') || element.textContent, width: rect.width, height: rect.height };
    }).filter(rect => rect.width > 0 && rect.height > 0));
    expect(targets.length).toBeGreaterThan(5);
    for (const target of targets) {
      expect(target.width, target.name ?? '').toBeGreaterThanOrEqual(44);
      expect(target.height, target.name ?? '').toBeGreaterThanOrEqual(44);
    }
  }
});

test('Eine Etage zeigt 50 Räume und öffnet auch den letzten ohne Datenverlust', async ({ page }) => {
  test.setTimeout(60_000);
  const rooms = Array.from({ length: 50 }, (_, index) => ({ id: `test-room-${index}`, project: {
    ...structuredClone(DEFAULT_PROJECT), name: `Testraum ${index + 1}`,
    room: { ...structuredClone(DEFAULT_PROJECT.room), width: 1200, height: 900 },
  } }));
  await page.getByLabel('Projektdatei öffnen', { exact: true }).setInputFiles({ name: '50-raeume.fugenplan.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
    format: 'fugenplan', version: 2, workspace: { version: 2, activeRoomId: rooms[0].id, rooms },
  })) });
  await expect(overview(page).getByRole('article')).toHaveCount(50);
  await expect(page.getByRole('button', { name: 'Raum hinzufügen', exact: true })).toBeDisabled();
  await expect(overview(page).locator('.floor-overview-summary')).toContainText('54 m²');
  const closeNotice = page.getByRole('button', { name: 'Meldung schließen', exact: true });
  if (await closeNotice.isVisible()) await closeNotice.click();
  await page.getByRole('button', { name: 'Testraum 50 bearbeiten', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Testraum 50', exact: true })).toBeVisible();
  await expect.poll(async () => {
    const workspace = await stored(page);
    return workspace.rooms.find(room => room.id === workspace.activeRoomId)?.project.name;
  }).toBe('Testraum 50');
  expect((await stored(page)).rooms).toHaveLength(50);
  expect((await stored(page)).rooms.map(room => room.project)).toEqual(rooms.map(room => room.project));
});
