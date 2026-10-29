import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { createFloor, createProject, setField, storedRoom, storedWorkspace } from './helpers';

const plan = (page: Page) => page.getByTestId('floor-plan');
const pieces = (page: Page) => plan(page).locator('[data-piece]');
const errors = new WeakMap<Page, string[]>();
const signature = (page: Page) => pieces(page).evaluateAll(nodes => nodes.map(node => node.getAttribute('d')).join('|'));

async function ready(page: Page) {
  await expect(plan(page)).toBeVisible();
  await expect(page.locator('.canvas-frame')).toHaveAttribute('aria-busy', 'false');
  await expect(pieces(page)).not.toHaveCount(0);
}
async function panel(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click();
}
async function number(page: Page, label: string, value: string) {
  await setField(page, label, value);
  await expect(page.getByRole('textbox', { name: label, exact: true })).not.toHaveAttribute('aria-invalid', 'true');
}
async function pick(page: Page) {
  await page.getByRole('button', { name: /^Start (wählen|ändern)$/ }).click();
  await expect(page.getByRole('region', { name: 'Start im Raumplan wählen' })).toBeVisible();
}
async function download(page: Page, button: Locator) {
  const pending = page.waitForEvent('download');
  await button.click();
  const file = await pending;
  expect(await file.failure()).toBeNull();
  return { name: file.suggestedFilename(), content: await readFile((await file.path())!, 'utf8') };
}
async function exactGrid(page: Page) {
  await panel(page, 'Raum');
  await number(page, 'Breite', '120,6');
  await number(page, 'Tiefe', '90,6');
  await panel(page, 'Belag');
  await number(page, 'Länge', '39,8');
  await number(page, 'Breite', '29,8');
  await number(page, 'Fuge', '3');
  await number(page, 'Randfuge', '3');
  await panel(page, 'Verlegung');
  await panel(page, 'Kreuzverband');
  await number(page, 'Versatz X', '0,3');
  await number(page, 'Versatz Y', '0,3');
  await expect(pieces(page)).toHaveCount(9);
}

test.beforeEach(async ({ page, browser }, testInfo) => {
  testInfo.annotations.push({ type: 'browser', description: browser.browserType().name() + ' ' + browser.version() });
  errors.set(page, []);
  page.on('pageerror', error => errors.get(page)!.push(error.message));
  await page.goto('/');
  await createProject(page, 'E2E Haus');
  await createFloor(page, 'Erdgeschoss');
  await page.getByRole('button', { name: 'Raum hinzufügen', exact: true }).click();
  await setField(page, 'Raumname', 'Prüfraum');
  await ready(page);
});
test.afterEach(({ page }) => expect(errors.get(page), 'Keine unbehandelten Browserfehler').toEqual([]));

test('Alle elf Formatvorgaben und vier Oberflächen ändern den sichtbaren Belag und bleiben gespeichert', async ({ page }) => {
  await panel(page, 'Verlegung');
  await panel(page, 'Kreuzverband');
  await number(page, 'Versatz X', '0,5');
  await number(page, 'Versatz Y', '0,5');
  await panel(page, 'Belag');
  const groups = [
    { button: 'Fliese', kind: 'tile', formats: [[12, 30], [60, 60], [60, 30], [120, 60], [30, 30], [20, 20], [20, 10]] },
    { button: 'Diele', kind: 'wood', formats: [[120, 20], [180, 20], [220, 18], [60, 12]] },
  ];
  for (const group of groups) {
    await panel(page, group.button);
    for (const [width, height] of group.formats) {
      await page.getByRole('combobox', { name: 'Formatvorgabe' }).selectOption({ label: width + ' × ' + height + ' cm' });
      await expect.poll(async () => {
        const material = (await storedRoom(page)).material;
        return [material.kind, material.width, material.height];
      }).toEqual([group.kind, width * 10, height * 10]);
      await expect.poll(() => pieces(page).evaluateAll((nodes, size) => nodes.some(node => {
        const box = (node as SVGGraphicsElement).getBBox();
        return Math.abs(box.width - size[0]) < .01 && Math.abs(box.height - size[1]) < .01;
      }), [width * 10, height * 10])).toBe(true);
    }
  }
  const geometry = await signature(page);
  let previous = await pieces(page).first().getAttribute('fill');
  for (const [label, color] of [['Kalkstein', 'limestone'], ['Kreide', 'chalk'], ['Schiefer', 'slate'], ['Eiche', 'oak']]) {
    const swatch = page.getByRole('button', { name: label, exact: true });
    await swatch.click();
    await expect(swatch).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await storedRoom(page)).material.color).toBe(color);
    await expect(pieces(page).first()).not.toHaveAttribute('fill', previous!);
    previous = await pieces(page).first().getAttribute('fill');
    expect(await signature(page)).toBe(geometry);
  }
  await panel(page, 'Fliese');
  await expect(page.getByRole('textbox', { name: 'Fuge', exact: true })).toHaveValue('3');
  await expect.poll(async () => (await storedRoom(page)).material.kind).toBe('tile');
  await page.reload();
  await panel(page, 'Raumplan');
  await panel(page, 'Belag');
  await expect(page.getByRole('button', { name: 'Fliese', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: 'Länge', exact: true })).toHaveValue('60');
  await expect(page.getByRole('button', { name: 'Kalkstein', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('Reserve, Paketinhalt und Warnschwelle ergeben nachvollziehbare Mengen und prüfbare Zuschnitte', async ({ page }) => {
  await exactGrid(page);
  await panel(page, 'Belag');
  await number(page, 'Reserve', '25');
  await number(page, 'Stück je Paket', '5');
  // Neun ganze Elemente; ceil(9 * 1,25) = 12, ceil(12 / 5) = 3.
  await expect(page.locator('.plan-footnotes')).toContainText('12 Elemente inkl. 25 % Reserve · 3 Pakete à 5 Stück');
  const packages = page.getByRole('textbox', { name: 'Stück je Paket', exact: true });
  await packages.fill('2,5');
  await packages.press('Enter');
  await expect(packages).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('alert')).toContainText('ganze Zahl');
  expect((await storedRoom(page)).material.piecesPerPack).toBe(5);
  await packages.press('Escape');
  await number(page, 'Reserve', '0');
  await expect(page.locator('.plan-footnotes')).toContainText('9 Elemente inkl. 0 % Reserve · 2 Pakete à 5 Stück');
  await panel(page, 'Raum');
  await number(page, 'Breite', '130,6');
  await panel(page, 'Belag');
  await number(page, 'Schmale Zuschnitte markieren unter', '150');
  await expect(page.locator('.plan-note')).toContainText('3 Zuschnitte mit einem Hüllmaß unter 150 mm');
  await page.locator('.plan-note').getByRole('button', { name: 'Prüfen', exact: true }).click();
  const detail = page.getByRole('region', { name: 'Elementdetails' });
  await expect(detail).toContainText('Zuschnitt');
  await expect(detail).toContainText('97');
  await page.getByRole('button', { name: 'Elementdetails schließen', exact: true }).click();
  const geometry = await signature(page);
  await number(page, 'Schmale Zuschnitte markieren unter', '0');
  await expect(page.locator('.plan-note').getByRole('button', { name: 'Prüfen', exact: true })).toHaveCount(0);
  expect(await signature(page)).toBe(geometry);
});

for (const width of [1440, 390]) {
  test('Alle vier Ecken und Wandmitten sind direkt wählbar bei ' + width + ' Pixeln', async ({ page }) => {
    test.setTimeout(60_000);
    await panel(page, 'Verlegung');
    await panel(page, 'Kreuzverband');
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    if (width === 390) {
      await panel(page, 'Raum und Belag einstellen');
      await expect(page.getByRole('complementary', { name: 'Planeinstellungen' })).toBeFocused();
      await panel(page, 'Zur Planvorschau');
      await expect(page.getByRole('main')).toBeFocused();
    }
    const room = (await storedRoom(page)).room;
    const corners = [[0, 0], [room.width, 0], [room.width, room.height], [0, room.height]];
    const sides = [[room.width / 2, 0], [room.width, room.height / 2], [room.width / 2, room.height], [0, room.height / 2]];
    for (const kind of ['corner', 'side'] as const) {
      for (let index = 0; index < 4; index++) {
        await pick(page);
        await panel(page, kind === 'corner' ? 'Ecke' : 'Wandmitte');
        const target = plan(page).getByRole('button', { name: new RegExp('^' + (kind === 'corner' ? 'Ecke' : 'Wandmitte') + ' ' + (index + 1) + ':') });
        const point = (kind === 'corner' ? corners : sides)[index];
        await expect(target.locator('circle').first()).toHaveAttribute('cx', String(point[0]));
        await expect(target.locator('circle').first()).toHaveAttribute('cy', String(point[1]));
        await target.click();
        await expect.poll(async () => (await storedRoom(page)).layout.start).toEqual({ kind, index });
        const marker = page.getByTestId('start-marker');
        await expect(marker).toBeVisible();
        await expect.poll(() => marker.locator('circle').evaluate(node => {
          const circle = node as SVGCircleElement;
          const piece = node.parentElement!.querySelector('path') as SVGGeometryElement;
          return piece.isPointInFill(new DOMPoint(circle.cx.baseVal.value, circle.cy.baseVal.value));
        })).toBe(true);
        await expect(page.getByRole('region', { name: 'Start im Raumplan wählen' })).toHaveCount(0);
      }
    }
    await page.getByRole('button', { name: 'Startfliese prüfen', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Elementdetails' })).toContainText('Startfliese 1');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}

test('Startwahl per Tastatur und Liste, Ausrichten, Aufheben, Zentrieren und Export bleiben konsistent', async ({ page }) => {
  await panel(page, 'L-Form');
  await number(page, 'Breite', '400');
  await number(page, 'Tiefe', '300');
  await number(page, 'Breite der Aussparung', '100');
  await number(page, 'Tiefe der Aussparung', '80');
  await expect.poll(async () => (await storedRoom(page)).room.notchHeight).toBe(800);
  const unchanged = await storedRoom(page);
  await pick(page);
  const initialView = await plan(page).getAttribute('viewBox');
  await plan(page).press('+');
  await expect(plan(page)).not.toHaveAttribute('viewBox', initialView!);
  await plan(page).press('ArrowRight');
  await plan(page).press('-');
  const box = (await plan(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 20, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByRole('region', { name: 'Start im Raumplan wählen' })).toBeVisible();
  await plan(page).press('Escape');
  await expect(page.getByRole('button', { name: 'Start wählen', exact: true })).toBeFocused();
  expect(await storedRoom(page)).toEqual(unchanged);
  await panel(page, 'Plan einpassen');
  await pick(page);
  await expect(plan(page).getByRole('button', { name: /^Ecke \d+:/ })).toHaveCount(6);
  await plan(page).getByRole('button', { name: /^Ecke 3:/ }).press('Enter');
  await expect.poll(async () => (await storedRoom(page)).layout.start).toEqual({ kind: 'corner', index: 2 });
  await pick(page);
  await plan(page).getByRole('button', { name: /^Ecke 2:/ }).press('Space');
  await expect.poll(async () => (await storedRoom(page)).layout.start).toEqual({ kind: 'corner', index: 1 });
  await pick(page);
  await panel(page, 'Wandmitte');
  await page.getByText('Aus Liste wählen', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Startwand aus Liste' }).selectOption('2');
  await expect(page.getByTestId('start-marker').locator('circle')).toHaveAttribute('cx', '3500');
  await expect(page.getByTestId('start-marker').locator('circle')).toHaveAttribute('cy', '955');
  await panel(page, 'Verlegung');
  let previous = await signature(page);
  for (const angle of [45, 90, 0]) {
    await panel(page, angle + '°');
    await expect.poll(async () => (await storedRoom(page)).layout.angle).toBe(angle);
    await expect.poll(() => signature(page)).not.toBe(previous);
    previous = await signature(page);
  }
  await number(page, 'Versatz X', '12,5');
  await number(page, 'Versatz Y', '-7');
  await panel(page, 'Am Start neu ausrichten');
  await expect.poll(async () => (await storedRoom(page)).layout).toMatchObject({ start: { kind: 'side', index: 2 }, offsetX: 0, offsetY: 0 });
  await panel(page, 'Rückgängig');
  await expect(page.getByRole('textbox', { name: 'Versatz X' })).toHaveValue('12,5');
  await expect(page.getByRole('textbox', { name: 'Versatz Y' })).toHaveValue('-7');
  await panel(page, 'Start aufheben');
  await expect(page.getByTestId('start-marker')).toHaveCount(0);
  await panel(page, 'Rückgängig');
  await panel(page, 'Belag zentrieren');
  await expect(page.getByTestId('start-marker')).toHaveCount(0);
  await panel(page, 'Rückgängig');
  await expect.poll(async () => (await storedRoom(page)).layout).toMatchObject({ start: { kind: 'side', index: 2 }, offsetX: 125, offsetY: -70 });
  const before = await storedRoom(page);
  expect(before.layout).toMatchObject({ start: { kind: 'side', index: 2 }, offsetX: 125, offsetY: -70 });
  await page.reload();
  await panel(page, 'Raumplan');
  await expect(page.getByTestId('start-marker')).toBeVisible();
  await panel(page, 'Exportieren');
  const file = await download(page, page.getByRole('dialog').getByRole('button', { name: /^Projektdatei/ }));
  expect(JSON.parse(file.content).building.floors[0].workspace.rooms[0].project).toEqual(before);
  for (const scale of [10, 20, 25, 50, 100, 200, 500]) {
    await page.getByRole('combobox', { name: 'Maßstab für den Plan' }).selectOption(String(scale));
    const svg = await download(page, page.getByRole('button', { name: /^Plan als SVG/ }));
    expect(svg.name).toContain('-1-' + scale + '.svg');
    expect(svg.content).toContain('Startfliese 1: Wand 3 · Mitte');
    expect(svg.content).not.toContain('als Start wählen');
    const ratio = await page.evaluate(contents => {
      const root = new DOMParser().parseFromString(contents, 'image/svg+xml').documentElement;
      return Number(root.getAttribute('viewBox')!.split(' ')[2]) / parseFloat(root.getAttribute('width')!);
    }, svg.content);
    expect(ratio).toBeCloseTo(scale, 8);
  }
  const csv = await download(page, page.getByRole('button', { name: /^Elementliste als CSV/ }));
  expect(csv.content.split('\r\n')[1]).toMatch(/^"1";.*;"Ja"$/);
});

test('Freie Eckpunkte lassen sich ergänzen, ändern und bis zum Dreieck entfernen', async ({ page }) => {
  const name = page.getByRole('textbox', { name: 'Raumname', exact: true });
  await name.fill('');
  await name.press('Enter');
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  expect((await storedRoom(page)).name).toBe('Prüfraum');
  await name.press('Escape');
  await expect(name).toHaveValue('Prüfraum');
  await panel(page, 'Frei');
  await pick(page);
  await plan(page).getByRole('button', { name: /^Ecke 1:/ }).press('Enter');
  await panel(page, 'Punkt hinzufügen');
  await expect(page.getByRole('textbox', { name: 'Punkt 5, Y', exact: true })).toHaveValue('180');
  await expect(page.getByTestId('start-marker')).toHaveCount(0);
  await number(page, 'Punkt 5, X', '20');
  await expect(plan(page).locator('polygon').first()).toHaveAttribute('points', '0,0 4200,0 4200,3600 0,3600 200,1800');
  await panel(page, 'Punkt 5 entfernen');
  await panel(page, 'Punkt 4 entfernen');
  await expect(page.getByRole('textbox', { name: /^Punkt \d+, X$/ })).toHaveCount(3);
  for (const button of await page.getByRole('button', { name: /^Punkt \d+ entfernen$/ }).all()) await expect(button).toBeDisabled();
  await expect.poll(async () => (await storedRoom(page)).room.points).toHaveLength(3);
  await panel(page, 'Rückgängig');
  await expect(page.getByRole('textbox', { name: 'Punkt 4, X', exact: true })).toBeVisible();
  await ready(page);
});

test('Zeichenmodus entfernt den letzten Punkt, bricht ab und übernimmt eine durch den ersten Punkt geschlossene Kontur', async ({ page }) => {
  await panel(page, 'Frei');
  await expect.poll(async () => (await storedRoom(page)).room.shape).toBe('custom');
  const before = await storedRoom(page);
  await panel(page, 'Kontur zeichnen');
  let box = (await plan(page).boundingBox())!;
  const points = [[.3, .3], [.7, .3], [.7, .7], [.3, .7]];
  for (const [x, y] of points) await plan(page).click({ position: { x: box.width * x, y: box.height * y } });
  await panel(page, 'Letzten Punkt entfernen');
  await expect(plan(page).locator('circle')).toHaveCount(3);
  await panel(page, 'Zeichnen abbrechen');
  expect(await storedRoom(page)).toEqual(before);
  await panel(page, 'Kontur zeichnen');
  box = (await plan(page).boundingBox())!;
  for (const [x, y] of [...points, points[0]]) await plan(page).click({ position: { x: box.width * x, y: box.height * y } });
  await expect(page.getByRole('button', { name: 'Übernehmen', exact: true })).toHaveCount(0);
  await expect.poll(async () => (await storedRoom(page)).room.points).not.toEqual(before.room.points);
  expect((await storedRoom(page)).room.points).toHaveLength(4);
  await ready(page);
});

test('Maße, Zuschnitte, Achsen, Auswahl, Pan, Zoom und Hilfe funktionieren ohne geänderte Raumdaten', async ({ page }) => {
  const before = await storedRoom(page);
  const geometry = await signature(page);
  await panel(page, 'Maße');
  await expect(plan(page).locator('.dimensions')).toHaveCount(0);
  await panel(page, 'Maße');
  await expect(plan(page).locator('.dimensions text')).toHaveCount(4);
  await panel(page, 'Achsen');
  await expect(plan(page).locator('g[stroke-dasharray="7 6"] line')).toHaveCount(2);
  await panel(page, 'Achsen');
  await expect(plan(page).locator('g[stroke-dasharray="7 6"]')).toHaveCount(0);
  await panel(page, 'Zuschnitte');
  await expect(pieces(page).filter({ has: page.locator('title', { hasText: /^Zuschnitt/ }) }).first()).toHaveAttribute('fill', /^url/);
  await panel(page, 'Element auswählen');
  await pieces(page).filter({ has: page.locator('title', { hasText: /^Zuschnitt/ }) }).first().click();
  await expect(page.getByRole('region', { name: 'Elementdetails' })).toContainText('Hüllmaß');
  await panel(page, 'Elementdetails schließen');
  await plan(page).press('Home');
  await expect(page.getByRole('region', { name: 'Elementdetails' })).toBeVisible();
  const first = await page.getByRole('region', { name: 'Elementdetails' }).textContent();
  await plan(page).press('End');
  await expect(page.getByRole('region', { name: 'Elementdetails' })).not.toHaveText(first!);
  await plan(page).press('Escape');
  const initial = await plan(page).getAttribute('viewBox');
  await panel(page, 'Ansicht verschieben');
  const box = (await plan(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 25, { steps: 4 });
  await page.mouse.up();
  await expect(plan(page)).not.toHaveAttribute('viewBox', initial!);
  await panel(page, 'Plan einpassen');
  await expect(plan(page)).toHaveAttribute('viewBox', initial!);
  for (let i = 0; i < 5 && await page.getByRole('button', { name: 'Verkleinern', exact: true }).isEnabled(); i++) await panel(page, 'Verkleinern');
  await expect(page.getByRole('button', { name: 'Verkleinern', exact: true })).toBeDisabled();
  for (let i = 0; i < 11 && await page.getByRole('button', { name: 'Vergrößern', exact: true }).isEnabled(); i++) await panel(page, 'Vergrößern');
  await expect(page.getByRole('button', { name: 'Vergrößern', exact: true })).toBeDisabled();
  await panel(page, 'Plan einpassen');
  expect(await signature(page)).toBe(geometry);
  expect(await storedRoom(page)).toEqual(before);
  await panel(page, 'Hilfe öffnen');
  await expect(page.getByRole('dialog')).toContainText('Wiederverwendung');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Hilfe öffnen', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Wie wird gerechnet?', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Deine Daten bleiben hier');
  await panel(page, 'Dialog schließen');
});

test('Varianten übernehmen den vollständigen Stand, schützen den Zielraum und begrenzen die Sammlung auf zwölf', async ({ page }) => {
  test.setTimeout(60_000);
  await panel(page, 'Belag');
  await number(page, 'Reserve', '17');
  await panel(page, 'Schiefer');
  await pick(page);
  await plan(page).getByRole('button', { name: /^Ecke 3:/ }).press('Enter');
  const saved = await storedRoom(page);
  await panel(page, 'Variante merken');
  await page.getByRole('textbox', { name: 'Name der Variante' }).fill('Stand A');
  await panel(page, 'Variante speichern');
  await panel(page, 'Neuen Raum hinzufügen');
  await panel(page, 'Raum');
  await number(page, 'Breite', '250');
  await expect.poll(async () => (await storedRoom(page)).room.width).toBe(2500);
  const target = await storedRoom(page);
  const targetId = (await storedWorkspace(page)).activeRoomId;
  await page.getByRole('button', { name: /^Varianten/ }).click();
  await panel(page, 'Stand A laden');
  await page.getByRole('dialog').getByRole('button', { name: 'Abbrechen', exact: true }).click();
  expect(await storedRoom(page)).toEqual(target);
  await panel(page, 'Stand A laden');
  await page.getByRole('dialog').getByRole('button', { name: 'Variante laden', exact: true }).click();
  await expect.poll(() => storedRoom(page)).toEqual(saved);
  const workspace = await storedWorkspace(page);
  expect(workspace.rooms.find(room => room.id !== targetId)!.project).toEqual(saved);
  await panel(page, 'Rückgängig');
  await expect.poll(() => storedRoom(page)).toEqual(target);
  await page.getByRole('button', { name: /^Varianten/ }).click();
  for (let i = 2; i <= 12; i++) {
    await panel(page, 'Aktuellen Plan merken');
    await page.getByRole('textbox', { name: 'Name der Variante' }).fill('Stand ' + i);
    await panel(page, 'Variante speichern');
  }
  await expect(page.locator('.variant-card')).toHaveCount(12);
  await expect(page.getByRole('button', { name: 'Aktuellen Plan merken', exact: true })).toBeDisabled();
  await panel(page, 'Stand 2 löschen');
  await expect(page.getByRole('button', { name: 'Aktuellen Plan merken', exact: true })).toBeEnabled();
  await panel(page, 'Aktuellen Plan merken');
  await page.getByRole('dialog').getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(page.locator('.variant-card')).toHaveCount(11);
  await page.reload();
  await panel(page, 'Raumplan');
  await page.getByRole('button', { name: /^Varianten/ }).click();
  await expect(page.locator('.variant-card')).toHaveCount(11);
  expect(await storedRoom(page)).toEqual(target);
});

test('Druck erzeugt einen einseitigen A4-Bericht mit Start und richtigem Papiermaß', async ({ page, browserName }, testInfo) => {
  await pick(page);
  await plan(page).getByRole('button', { name: /^Ecke 1:/ }).press('Enter');
  await panel(page, 'Exportieren');
  await page.getByRole('combobox', { name: 'Maßstab für den Plan' }).selectOption('50');
  await expect(page.getByRole('button', { name: /^Drucken \/ PDF/ })).toBeEnabled();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.app-shell')).toBeHidden();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('.print-sheet')).toContainText('Startfliese 1: Oben links');
  await expect(page.locator('.print-sheet')).toContainText('Kontrollmaß: 50 mm');
  const scale = await page.locator('.print-drawing > svg').evaluate(node => {
    const svg = node as SVGSVGElement;
    return svg.viewBox.baseVal.width / svg.width.baseVal.value * 96 / 25.4;
  });
  expect(scale).toBeCloseTo(50, 5);
  await testInfo.attach('Druckdarstellung', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  // Page.pdf is provided by Playwright only for Chromium; the print DOM is checked in both engines.
  if (browserName === 'chromium') {
    const bytes = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true, scale: 1 });
    const pdf = bytes.toString('latin1');
    expect(pdf).toMatch(/^%PDF-/);
    expect(pdf.match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
    const mediaBox = pdf.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
    expect(mediaBox).not.toBeNull();
    expect(Math.abs(Number(mediaBox![1]) - 595.28)).toBeLessThan(1);
    expect(Math.abs(Number(mediaBox![2]) - 841.89)).toBeLessThan(1);
    await mkdir('test-results/e2e-evidence', { recursive: true });
    await writeFile('test-results/e2e-evidence/verlegeplan-a4.pdf', bytes);
    await testInfo.attach('A4-Bericht als PDF', { body: bytes, contentType: 'application/pdf' });
  }
});
