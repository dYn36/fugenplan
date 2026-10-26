import { readFile } from 'node:fs/promises';
import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const plan = (page: Page) => page.getByTestId('floor-plan');
const pieces = (page: Page) => plan(page).locator('[data-piece]');
const runtimeErrors = new WeakMap<Page, string[]>();
const networkRequests = new WeakMap<Page, string[]>();

async function download(page: Page, button: Locator) {
  const event = page.waitForEvent('download');
  await button.click();
  const result = await event;
  expect(await result.failure()).toBeNull();
  const path = await result.path();
  expect(path).not.toBeNull();
  return { name: result.suggestedFilename(), content: await readFile(path!, 'utf8') };
}

async function openExport(page: Page) {
  await page.getByRole('button', { name: 'Exportieren', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Plan mitnehmen' })).toBeVisible();
}

async function setNumber(page: Page, label: string, value: string) {
  const input = page.getByRole('textbox', { name: label, exact: true });
  await input.fill(value);
  await input.press('Enter');
  await expect(input).not.toHaveAttribute('aria-invalid', 'true');
}

async function panel(page: Page, name: 'Raum' | 'Belag' | 'Verlegung') {
  const button = page.getByRole('button', { name, exact: true });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

async function geometrySignature(page: Page) {
  return pieces(page).evaluateAll(elements => elements.map(element => element.getAttribute('d')).join('|'));
}

async function pieceBoxes(page: Page) {
  return pieces(page).evaluateAll(elements => elements.map(element => {
    const box = (element as SVGGraphicsElement).getBBox();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  }));
}

async function assertNoHorizontalOverflow(page: Page) {
  const size = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(size.content).toBeLessThanOrEqual(size.viewport + 1);
}

async function assertAccessible(page: Page) {
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const serious = audit.violations.filter(item => item.impact === 'serious' || item.impact === 'critical');
  expect(serious.map(item => ({
    id: item.id,
    description: item.description,
    nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })),
  }))).toEqual([]);
}

async function configureExactGrid(page: Page) {
  await panel(page, 'Raum');
  await setNumber(page, 'Breite', '120,6');
  await setNumber(page, 'Tiefe', '90,6');
  await panel(page, 'Belag');
  await setNumber(page, 'Länge', '39,8');
  await setNumber(page, 'Breite', '29,8');
  await setNumber(page, 'Fuge', '3');
  await setNumber(page, 'Randfuge', '3');
  await panel(page, 'Verlegung');
  await page.getByRole('button', { name: 'Kreuzverband', exact: true }).click();
  await setNumber(page, 'Versatz X', '0,3');
  await setNumber(page, 'Versatz Y', '0,3');
  await expect(pieces(page)).toHaveCount(9);
  await expect.poll(async () => (await pieceBoxes(page)).every(box => Math.abs(box.width - 398) < 0.01 && Math.abs(box.height - 298) < 0.01)).toBe(true);
}

test.beforeEach(async ({ page }) => {
  runtimeErrors.set(page, []);
  networkRequests.set(page, []);
  page.on('pageerror', error => runtimeErrors.get(page)!.push(error.message));
  page.context().on('request', request => networkRequests.get(page)!.push(request.url()));
  page.on('websocket', socket => networkRequests.get(page)!.push(socket.url()));
  await page.goto('/');
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await expect(plan(page)).toBeVisible();
  await expect.poll(() => pieces(page).count()).toBeGreaterThan(0);
});

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page), 'Keine unbehandelten JavaScript-Fehler').toEqual([]);
});

test('Maße, Dezimalkomma, Fugen und Randabstand stimmen im gezeichneten Plan', async ({ page }) => {
  await configureExactGrid(page);
  const boxes = await pieceBoxes(page);
  expect([...new Set(boxes.map(box => box.x))].sort((a, b) => a - b)).toEqual([3, 404, 805]);
  expect([...new Set(boxes.map(box => box.y))].sort((a, b) => a - b)).toEqual([3, 304, 605]);
  await expect(pieces(page).locator('title')).toHaveText(Array.from({ length: 9 }, (_, i) => `Ganzes Element ${i + 1}: 398 × 298 mm`));

  // 3 × 398 + 2 × 3 = 1200; 3 × 298 + 2 × 3 = 900.
  // A wider joint preserves the material size and shortens the last row/column.
  await panel(page, 'Belag');
  await setNumber(page, 'Fuge', '6');
  await expect.poll(async () => (await pieceBoxes(page)).some(box => Math.abs(box.width - 392) < 0.01)).toBe(true);
  await expect.poll(async () => (await pieceBoxes(page)).some(box => Math.abs(box.height - 292) < 0.01)).toBe(true);
  expect([...new Set((await pieceBoxes(page)).map(box => box.x))].sort((a, b) => a - b)).toEqual([3, 407, 811]);

  await setNumber(page, 'Randfuge', '10');
  await expect.poll(async () => Math.min(...(await pieceBoxes(page)).map(box => box.x))).toBe(10);
  const inset = await pieceBoxes(page);
  expect(Math.min(...inset.map(box => box.y))).toBe(10);
  expect(Math.max(...inset.map(box => box.x + box.width))).toBe(1196);
  expect(Math.max(...inset.map(box => box.y + box.height))).toBe(896);
});

test('Alle sieben Muster, Drehung und Verschiebung ändern die Vorschau', async ({ page }) => {
  await panel(page, 'Verlegung');
  const names = ['Kreuzverband', 'Halbverband', 'Drittelverband', 'Viertelverband', 'Wilder Verband', 'Diagonalverband', 'Fischgrät'];
  let previous = await geometrySignature(page);
  for (const name of names) {
    const button = page.getByRole('button', { name, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => geometrySignature(page)).not.toBe(previous);
    previous = await geometrySignature(page);
    await expect.poll(() => pieces(page).count()).toBeGreaterThan(0);
  }
  await setNumber(page, 'Zusätzliche Drehung', '17');
  await expect.poll(() => geometrySignature(page)).not.toBe(previous);
  previous = await geometrySignature(page);
  await setNumber(page, 'Versatz X', '12,5');
  await expect.poll(() => geometrySignature(page)).not.toBe(previous);
  previous = await geometrySignature(page);
  await page.getByRole('button', { name: 'Belag zentrieren', exact: true }).click();
  await expect.poll(() => geometrySignature(page)).not.toBe(previous);
});

test('L-Form, freie Eckpunkte und ein Hindernis verändern den Raum', async ({ page }) => {
  await setNumber(page, 'Breite', '400');
  await setNumber(page, 'Tiefe', '300');
  await page.getByRole('button', { name: 'L-Form', exact: true }).click();
  await setNumber(page, 'Breite der Aussparung', '100');
  await setNumber(page, 'Tiefe der Aussparung', '80');
  const roomOutline = plan(page).locator('polygon').first();
  await expect(roomOutline).toHaveAttribute('points', '0,0 3000,0 3000,800 4000,800 4000,3000 0,3000');

  await page.getByRole('button', { name: 'Frei', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Punkt 6, Y', exact: true })).toHaveValue('300');
  await setNumber(page, 'Punkt 5, X', '350');
  await expect(roomOutline).toHaveAttribute('points', '0,0 3000,0 3000,800 4000,800 3500,3000 0,3000');

  await page.locator('summary').filter({ hasText: /^Hindernisse/ }).click();
  await page.getByRole('button', { name: 'Hindernis hinzufügen', exact: true }).click();
  await setNumber(page, 'Hindernis 1, X', '100');
  await setNumber(page, 'Hindernis 1, Y', '100');
  await setNumber(page, 'Hindernis 1, Breite', '50');
  await setNumber(page, 'Hindernis 1, Tiefe', '40');
  const obstacle = plan(page).locator('g').filter({ has: page.locator('title', { hasText: /^Hindernis 1$/ }) }).last().locator('rect');
  await expect(obstacle).toHaveAttribute('x', '1000');
  await expect(obstacle).toHaveAttribute('width', '500');
  await expect.poll(async () => pieces(page).evaluateAll(elements => {
    const probes = [new DOMPoint(1001, 1001), new DOMPoint(1250, 1200), new DOMPoint(1499, 1399)];
    return elements.some(element => probes.some(point => (element as SVGGeometryElement).isPointInFill(point)));
  })).toBe(false);

  await page.getByRole('button', { name: 'Hindernis 1 entfernen', exact: true }).click();
  await expect(plan(page).locator('title', { hasText: /^Hindernis 1$/ })).toHaveCount(0);
});

test('Eigene Raumkontur lässt sich auf dem Plan zeichnen', async ({ page }) => {
  await page.getByRole('button', { name: 'Frei', exact: true }).click();
  await page.getByRole('button', { name: 'Kontur zeichnen', exact: true }).click();
  const canvas = plan(page);
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  for (const [x, y] of [[0.3, 0.3], [0.7, 0.3], [0.7, 0.7], [0.3, 0.7]]) {
    await canvas.click({ position: { x: bounds!.width * x, y: bounds!.height * y } });
  }
  await page.getByRole('button', { name: 'Übernehmen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Übernehmen', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: /^Punkt \d+, X$/ })).toHaveCount(4);
  await expect.poll(() => pieces(page).count()).toBeGreaterThan(0);
  const outline = await canvas.locator('polygon').first().getAttribute('points');
  expect(outline?.split(' ')).toHaveLength(4);
});

test('Ungültige Eingaben erhalten den gültigen Plan und erklären den Fehler', async ({ page }) => {
  const previous = await geometrySignature(page);
  const width = page.getByRole('textbox', { name: 'Breite', exact: true });
  await width.fill('-1');
  await width.press('Enter');
  await expect(width).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('alert')).toContainText('Erlaubt:');
  expect(await geometrySignature(page)).toBe(previous);
  await width.focus();
  await width.press('Escape');
  await expect(width).toHaveValue('420');
  await expect(width).not.toHaveAttribute('aria-invalid', 'true');
  await setNumber(page, 'Breite', '450,5');
  await expect.poll(() => geometrySignature(page)).not.toBe(previous);
});

test('Regression: Escape verwirft Eingaben vor dem Abbruch der Startauswahl', async ({ page }) => {
  const previous = await geometrySignature(page);
  const start = page.getByRole('button', { name: 'Start wählen', exact: true });
  const picker = page.getByRole('region', { name: 'Start im Raumplan wählen' });
  await start.click();
  const width = page.getByRole('textbox', { name: 'Breite', exact: true });
  await width.fill('421');
  await width.press('Escape');
  await expect(width).toHaveValue('420');
  await expect(picker).toBeVisible();
  expect(await geometrySignature(page)).toBe(previous);
  const name = page.getByRole('textbox', { name: 'Raumname', exact: true });
  await name.fill('Unbestätigt');
  await name.press('Escape');
  await expect(name).toHaveValue('Wohnzimmer');
  await expect(picker).toBeVisible();
  await plan(page).press('Escape');
  await expect(picker).toBeHidden();
  await expect(start).toBeFocused();
  await expect(page.getByRole('button', { name: 'Rückgängig', exact: true })).toBeDisabled();
  await page.reload();
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await expect(width).toHaveValue('420');
  await expect(name).toHaveValue('Wohnzimmer');
});

test('Regression: Enter und Tab übernehmen Maße bei geöffneter Startauswahl', async ({ page }) => {
  const start = page.getByRole('button', { name: 'Start wählen', exact: true });
  const picker = page.getByRole('region', { name: 'Start im Raumplan wählen' });
  const width = page.getByRole('textbox', { name: 'Breite', exact: true });
  for (const [key, value] of [['Enter', '421'], ['Tab', '422']]) {
    await start.click();
    await width.fill(value);
    await width.press(key);
    await expect(picker).toBeHidden();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('fugenplan.project.v1') ?? '{}').room?.width)).toBe(Number(value) * 10);
    await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
    await expect(width).toHaveValue('420');
  }
});

for (const kind of ['Ecke', 'Wandmitte']) {
  test(`Regression: Geschlossene Kontur löst den Start ${kind} und bleibt ladbar`, async ({ page }) => {
    await page.getByRole('button', { name: 'Neuen Raum hinzufügen', exact: true }).click();
    await page.getByRole('button', { name: 'Frei', exact: true }).click();
    await page.getByRole('button', { name: 'Start wählen', exact: true }).click();
    await page.getByRole('button', { name: kind, exact: true }).click();
    await page.getByText('Aus Liste wählen', { exact: true }).click();
    await page.getByRole('combobox', { name: kind === 'Ecke' ? 'Startecke aus Liste' : 'Startwand aus Liste' }).selectOption('3');
    await expect(page.getByRole('button', { name: 'Start ändern', exact: true })).toBeEnabled();
    await setNumber(page, 'Punkt 4, Y', '0');
    await expect(plan(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start wählen', exact: true })).toBeEnabled();
    await expect.poll(() => page.evaluate(() => {
      const w = JSON.parse(localStorage.getItem('fugenplan.workspace.v2') ?? '{}');
      return w.rooms?.find((room: { id: string }) => room.id === w.activeRoomId)?.project.room.points[3].y;
    })).toBe(0);
    await page.reload();
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
    await expect(plan(page)).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Räume im Projekt' }).getByRole('button')).toHaveText(['Wohnzimmer', 'Raum 2']);
    await expect(page.getByRole('textbox', { name: 'Punkt 4, Y', exact: true })).toHaveValue('0');
    await expect(page.getByRole('button', { name: 'Start wählen', exact: true })).toBeEnabled();
  });
}

test('Rückgängig, Wiederholen und lokales Speichern erhalten die Raummaße', async ({ page }) => {
  const width = page.getByRole('textbox', { name: 'Breite', exact: true });
  await setNumber(page, 'Breite', '480');
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect(width).toHaveValue('420');
  await page.getByRole('button', { name: 'Wiederholen', exact: true }).click();
  await expect(width).toHaveValue('480');
  await page.keyboard.press('Control+z');
  await expect(width).toHaveValue('420');
  await page.keyboard.press('Control+Shift+z');
  await expect(width).toHaveValue('480');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('fugenplan.project.v1') ?? '{}').room?.width)).toBe(4800);
  await page.reload();
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await expect(width).toHaveValue('480');
  await expect(plan(page).locator('polygon').first()).toHaveAttribute('points', '0,0 4800,0 4800,3600 0,3600');
});

test('Varianten lassen sich speichern, laden und getrennt vom aktuellen Plan löschen', async ({ page }) => {
  await setNumber(page, 'Breite', '360');
  await page.getByRole('button', { name: 'Variante merken', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name der Variante', exact: true }).fill('Ruhige Aufteilung');
  await page.getByRole('button', { name: 'Variante speichern', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await setNumber(page, 'Breite', '500');
  await page.getByRole('button', { name: /^Varianten/ }).click();
  await expect(page.getByRole('heading', { name: 'Ruhige Aufteilung', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await page.getByRole('button', { name: /^Varianten/ }).click();
  await page.getByRole('button', { name: 'Ruhige Aufteilung laden', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Variante laden', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Breite', exact: true })).toHaveValue('360');
  await expect(plan(page)).toBeVisible();
  await page.getByRole('button', { name: /^Varianten/ }).click();
  await page.getByRole('button', { name: 'Ruhige Aufteilung löschen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Noch keine Varianten', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Breite', exact: true })).toHaveValue('360');
});

test('Projektdatei lädt denselben Plan; eine defekte Datei erhält den aktuellen Stand', async ({ page }) => {
  await setNumber(page, 'Breite', '333,3');
  const projectName = page.getByRole('textbox', { name: 'Raumname', exact: true });
  await projectName.fill('Küche & Flur');
  await projectName.press('Enter');
  await openExport(page);
  const saved = await download(page, page.getByRole('dialog').getByRole('button', { name: /^Projektdatei/ }));
  expect(saved.name).toBe('Küche-Flur.fugenplan.json');
  const project = JSON.parse(saved.content);
  expect(project.name).toBe('Küche & Flur');
  expect(project.room.width).toBe(3333);
  expect(project.material.grout).toBe(3);
  await page.getByRole('button', { name: 'Dialog schließen', exact: true }).click();
  await setNumber(page, 'Breite', '444');
  const fileInput = page.getByLabel('Projektdatei öffnen', { exact: true });
  await fileInput.setInputFiles({ name: saved.name, mimeType: 'application/json', buffer: Buffer.from(saved.content) });
  await expect(page.getByRole('textbox', { name: 'Breite', exact: true })).toHaveValue('333,3');
  await expect(page.getByRole('heading', { name: 'Küche & Flur', exact: true })).toBeVisible();
  await fileInput.setInputFiles({ name: 'defekt.json', mimeType: 'application/json', buffer: Buffer.from('{"version":999}') });
  await expect(page.getByRole('status')).toContainText('Diese Projektversion wird nicht unterstützt.');
  await expect(page.getByRole('textbox', { name: 'Breite', exact: true })).toHaveValue('333,3');
  await expect(plan(page)).toBeVisible();
});

test('SVG und CSV enthalten die gezeichneten Maße und alle Elemente', async ({ page }) => {
  await configureExactGrid(page);
  await openExport(page);
  await page.getByLabel('Maßstab für den Plan', { exact: true }).selectOption('25');
  const svg = await download(page, page.getByRole('button', { name: /^Plan als SVG/ }));
  expect(svg.name).toBe('Wohnzimmer-1-25.svg');
  const parsed = await page.evaluate(content => {
    const document = new DOMParser().parseFromString(content, 'image/svg+xml');
    const root = document.documentElement;
    return {
      error: Boolean(document.querySelector('parsererror')),
      width: root.getAttribute('width'), height: root.getAttribute('height'),
      viewBox: root.getAttribute('viewBox')?.split(' ').map(Number),
      text: document.querySelector('desc')?.textContent,
      outline: document.querySelector('polygon')?.getAttribute('points'),
    };
  }, svg.content);
  expect(parsed.error).toBe(false);
  expect(parsed.width).toMatch(/mm$/);
  expect(parsed.height).toMatch(/mm$/);
  expect(parsed.viewBox![2] / Number.parseFloat(parsed.width!)).toBeCloseTo(25, 8);
  expect(parsed.viewBox![3] / Number.parseFloat(parsed.height!)).toBeCloseTo(25, 8);
  expect(parsed.text).toContain('Produkt 398 × 298 mm. Fuge 3 mm. Randabstand 3 mm.');
  expect(parsed.outline).toBe('0,0 1206,0 1206,906 0,906');
  const csv = await download(page, page.getByRole('button', { name: /^Elementliste als CSV/ }));
  expect(csv.name).toBe('Wohnzimmer-zuschnitte.csv');
  expect(csv.content.split(/\r?\n/)).toHaveLength(10);
  expect(csv.content.match(/"Ganz";"398,00";"298,00"/g)).toHaveLength(9);
});

test('Druckausgabe prüft das A4-Format und verwendet den gewählten Maßstab', async ({ page }) => {
  await page.evaluate(() => { window.print = () => { document.documentElement.dataset.printRequested = 'true'; }; });
  await openExport(page);
  const scale = page.getByLabel('Maßstab für den Plan', { exact: true });
  const print = page.getByRole('button', { name: /^Drucken \/ PDF/ });
  await scale.selectOption('10');
  await expect(print).toBeDisabled();
  await expect(page.getByText('Der Plan ist für A4 zu groß. Wähle einen kleineren Maßstab.', { exact: true })).toBeVisible();
  await scale.selectOption('50');
  await expect(print).toBeEnabled();
  await print.click();
  await expect(page.locator('html')).toHaveAttribute('data-print-requested', 'true');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.print-sheet')).toBeVisible();
  await expect(page.locator('.app-shell')).toBeHidden();
  await expect(page.locator('.print-sheet')).toContainText('Maßstab 1 : 50');
  await page.screenshot({ path: 'tests/screenshots/print-layout.png', fullPage: true });
});

test('Der Plan ist mit Tastatur bedienbar; Zoom verändert nur die Ansicht', async ({ page }) => {
  const canvas = plan(page);
  await canvas.focus();
  await canvas.press('Enter');
  const details = page.getByRole('region', { name: 'Elementdetails', exact: true });
  await expect(details).toBeVisible();
  const first = await details.textContent();
  await canvas.press('ArrowRight');
  await expect(details).not.toHaveText(first!);
  await canvas.press('Escape');
  await expect(page.getByRole('region', { name: 'Elementdetails', exact: true })).toHaveCount(0);
  const before = await geometrySignature(page);
  const viewport = await canvas.getAttribute('viewBox');
  await page.getByRole('button', { name: 'Vergrößern', exact: true }).click();
  await expect(canvas).not.toHaveAttribute('viewBox', viewport!);
  expect(await geometrySignature(page)).toBe(before);
  await page.getByRole('button', { name: 'Plan einpassen', exact: true }).click();
  await expect(canvas).toHaveAttribute('viewBox', viewport!);
});

test('Dielen ohne Fuge und das Verschieben mit der Maus funktionieren', async ({ page }) => {
  await panel(page, 'Belag');
  await page.getByRole('button', { name: 'Diele', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Länge', exact: true })).toHaveValue('120');
  await expect(page.getByRole('textbox', { name: 'Breite', exact: true })).toHaveValue('20');
  await expect(page.getByRole('textbox', { name: 'Fuge', exact: true })).toHaveValue('0');
  await setNumber(page, 'Randfuge', '10');
  await expect.poll(async () => (await pieceBoxes(page)).some(box => box.width === 1200 && box.height === 200)).toBe(true);
  const previous = await geometrySignature(page);
  await page.getByRole('button', { name: 'Verband verschieben', exact: true }).click();
  const bounds = await plan(page).boundingBox();
  expect(bounds).not.toBeNull();
  const x = bounds!.x + bounds!.width * 0.5;
  const y = bounds!.y + bounds!.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 45, y + 25, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => geometrySignature(page)).not.toBe(previous);
  await panel(page, 'Verlegung');
  await expect(page.getByRole('textbox', { name: 'Versatz X', exact: true })).not.toHaveValue('0');
  await expect(page.getByRole('textbox', { name: 'Versatz Y', exact: true })).not.toHaveValue('0');
});

test('Desktop ist ohne schwere Axe-Befunde und bleibt innerhalb des Fensters', async ({ page }) => {
  test.setTimeout(60_000);
  await assertNoHorizontalOverflow(page);
  await expect(page.locator('.save-status')).toContainText('Lokal gespeichert');
  await page.screenshot({ path: 'tests/screenshots/desktop-1440x1000.png' });
  for (const name of ['Raum', 'Belag', 'Verlegung'] as const) {
    await panel(page, name);
    await assertAccessible(page);
    await assertNoHorizontalOverflow(page);
  }
});

test('Mobile Ansicht bleibt bei 390 × 844 px bedienbar', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: 'tests/screenshots/mobile-390x844.png' });
  for (const name of ['Raum', 'Belag', 'Verlegung'] as const) {
    await panel(page, name);
    await assertNoHorizontalOverflow(page);
    await assertAccessible(page);
    const controls = page.locator('input:visible, select:visible');
    for (const input of await controls.all()) {
      const bounds = await input.boundingBox();
      expect(bounds, `${await input.getAttribute('aria-label')} muss sichtbar sein`).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(-1);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
    }
  }
  await panel(page, 'Raum');
  await setNumber(page, 'Breite', '450');
  await expect(plan(page).locator('polygon').first()).toHaveAttribute('points', '0,0 4500,0 4500,3600 0,3600');
  await plan(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'tests/screenshots/mobile-plan-390x844.png' });
});

test('Regression: Import und neuer Plan verwerfen einen begonnenen Zeichenentwurf', async ({ page }) => {
  const original = await geometrySignature(page);
  await openExport(page);
  const saved = await download(page, page.getByRole('dialog').getByRole('button', { name: /^Projektdatei/ }));
  await page.getByRole('button', { name: 'Dialog schließen', exact: true }).click();

  const beginDraft = async () => {
    await page.getByRole('button', { name: 'Frei', exact: true }).click();
    await page.getByRole('button', { name: 'Kontur zeichnen', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Letzten Punkt entfernen', exact: true })).toBeDisabled();
    const bounds = await plan(page).boundingBox();
    expect(bounds).not.toBeNull();
    for (const [x, y] of [[0.32, 0.35], [0.66, 0.35], [0.66, 0.65]]) {
      await plan(page).click({ position: { x: bounds!.width * x, y: bounds!.height * y } });
    }
    await expect(plan(page).locator('circle')).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Übernehmen', exact: true })).toBeEnabled();
  };

  await beginDraft();
  await page.getByLabel('Projektdatei öffnen', { exact: true }).setInputFiles({
    name: saved.name, mimeType: 'application/json', buffer: Buffer.from(saved.content),
  });
  await expect(page.getByRole('button', { name: 'Zeichnen abbrechen', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rechteck', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => geometrySignature(page)).toBe(original);

  await beginDraft();
  await page.getByRole('button', { name: 'Neuer Plan', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Neuen Plan beginnen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Zeichnen abbrechen', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rechteck', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => geometrySignature(page)).toBe(original);

  await page.getByRole('button', { name: 'Frei', exact: true }).click();
  await page.getByRole('button', { name: 'Kontur zeichnen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Letzten Punkt entfernen', exact: true })).toBeDisabled();
  await expect(plan(page).locator('circle')).toHaveCount(0);
});

test('Regression: Neuer Plan repariert beschädigte Speicherung bei sichtbaren Ausgangswerten', async ({ page }) => {
  await expect.poll(() => page.evaluate(() => localStorage.getItem('fugenplan.project.v1'))).not.toBeNull();
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem('fugenplan.project.v1')!));
  await page.evaluate(() => localStorage.setItem('fugenplan.workspace.v2', '{beschädigt'));
  await page.reload();
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await expect(plan(page)).toBeVisible();
  await expect(page.locator('.save-status')).toContainText('Nicht gespeichert');
  await expect(page.getByRole('textbox', { name: 'Breite', exact: true })).toHaveValue('420');
  await expect(page.getByRole('textbox', { name: 'Tiefe', exact: true })).toHaveValue('360');
  expect(await page.evaluate(() => localStorage.getItem('fugenplan.workspace.v2'))).toBe('{beschädigt');

  await page.getByRole('button', { name: 'Neuer Plan', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Neuen Plan beginnen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('fugenplan.project.v1')!); }
    catch { return null; }
  })).toEqual(original);
  await expect(page.locator('.save-status')).toContainText('Lokal gespeichert');
  await page.reload();
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await expect(plan(page)).toBeVisible();
  await expect(page.locator('.save-status')).toContainText('Lokal gespeichert');
  await expect(page.getByText('Der gespeicherte Plan konnte nicht geladen werden.', { exact: false })).toHaveCount(0);
});

test('Lokalbetrieb: Laden und Planänderungen lösen keine externen Netzwerkanfragen aus', async ({ page }) => {
  await setNumber(page, 'Breite', '450,5');
  await panel(page, 'Belag');
  await setNumber(page, 'Länge', '59,7');
  await setNumber(page, 'Fuge', '4');
  await panel(page, 'Verlegung');
  await page.getByRole('button', { name: 'Fischgrät', exact: true }).click();
  await setNumber(page, 'Versatz X', '5');
  await expect(page.locator('.canvas-frame')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.save-status')).toContainText('Lokal gespeichert');
  await page.waitForLoadState('networkidle');

  const observed = networkRequests.get(page)!;
  expect(observed.length, 'Der Test muss die echten Ladeanfragen beobachten.').toBeGreaterThan(0);
  const allowedHost = new URL(page.url()).host;
  const external = observed.filter(address => {
    const url = new URL(address);
    return ['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) && url.host !== allowedHost;
  });
  expect(external).toEqual([]);
});
