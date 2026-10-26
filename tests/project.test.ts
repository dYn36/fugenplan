import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateLayout, getRoomPolygon } from '../src/lib/geometry';
import { roomVertexCount } from '../src/lib/layout-start';
import { createCutCsv, createPlanSvg, svgDimensions } from '../src/lib/export';
import {
  DEFAULT_PROJECT, filename, formatArea, isUnchangedExampleProject, loadProject, loadVariants, parseProject, RECOVERED_START_NOTICE, STORAGE_KEY, updateRoom, VARIANTS_KEY,
} from '../src/lib/project';
import type { Project } from '../src/types';

const fresh = (): Project => structuredClone(DEFAULT_PROJECT);

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  };
}
beforeEach(() => vi.stubGlobal('localStorage', storage()));
afterEach(() => vi.unstubAllGlobals());

describe('Projektdatei und Schema', () => {
  it('erkennt das unveränderte Beispiel auch nach dem erneuten Einlesen', () => {
    const restored = parseProject(JSON.parse(JSON.stringify(fresh())));
    expect(isUnchangedExampleProject(fresh())).toBe(true);
    expect(isUnchangedExampleProject(restored)).toBe(true);
  });

  it('behandelt bearbeitete oder ungültige Räume nicht als ersetzbares Beispiel', () => {
    const changes: ((project: Project) => void)[] = [
      project => { project.name = 'Mein Wohnzimmer'; },
      project => { project.name = 'Wohnzimmer '; },
      project => { project.room.width = 4000; },
      project => { project.room.points[1].x = 4000; },
      project => { project.room.obstacles.push({ id: 'pillar', x: 100, y: 100, width: 100, height: 100 }); },
      project => { project.material.width = 120; },
      project => { project.layout.offsetX = 1; },
      project => { project.layout.start = { kind: 'corner', index: 0 }; },
      project => { project.room.points = []; },
    ];
    for (const change of changes) {
      const project = fresh(); change(project);
      expect(isUnchangedExampleProject(project)).toBe(false);
    }
  });

  it('erhält alle Standardwerte durch Speichern und erneutes Einlesen', () => {
    const input = fresh();
    expect(parseProject(JSON.parse(JSON.stringify(input)))).toEqual(input);
  });

  it('erhält Dezimalmaße, Konturen und Stückzahlen nach JSON-Rundreise', () => {
    const input = fresh();
    input.name = 'Bad „West“ & Gäste';
    input.room.shape = 'custom';
    input.room.points = [
      { x: -1200.25, y: 50.125 }, { x: 1900.5, y: 50.125 },
      { x: 1900.5, y: 1400.875 }, { x: -1200.25, y: 1700.5 },
    ];
    input.room.obstacles = [{ id: 'temporary-id', x: 900.125, y: 500.25, width: 220.75, height: 310.5 }];
    input.material.width = 613.25; input.material.height = 198.125;
    input.material.grout = 2.75; input.material.edgeGap = 7.125;
    input.layout = { pattern: 'herringbone', angle: 17.5, offsetX: -73.125, offsetY: 42.75 };
    const restored = parseProject(JSON.parse(JSON.stringify(input)));
    expect(restored.room.points).toEqual(input.room.points);
    expect(restored.room.obstacles.map(({ id: _id, ...obstacle }) => obstacle)).toEqual(input.room.obstacles.map(({ id: _id, ...obstacle }) => obstacle));
    expect(restored.material).toEqual(input.material);
    expect(restored.layout).toEqual(input.layout);
    const before = calculateLayout(input), after = calculateLayout(restored);
    expect(after.neededPieces).toBe(before.neededPieces);
    expect(after.coveredArea).toBe(before.coveredArea);
    expect(after.pieces.map(piece => piece.polygons)).toEqual(before.pieces.map(piece => piece.polygons));
  });

  it('baut ein eigenes Schema ohne fremde Felder oder Prototypen auf', () => {
    const input = JSON.parse(JSON.stringify(fresh()));
    input.unknown = 'nicht übernehmen';
    input.room.points[0].metadata = { unwanted: true };
    Object.defineProperty(input, '__proto__', { value: { polluted: 'unwanted' }, enumerable: true });
    const output = parseProject(input);
    expect(Object.keys(output).sort()).toEqual(['layout', 'material', 'name', 'room', 'version']);
    expect(Object.getPrototypeOf(output)).toBe(Object.prototype);
    expect(output).not.toHaveProperty('polluted');
    expect(output.room.points[0]).toEqual({ x: 0, y: 0 });
    input.room.points[0].x = 999;
    expect(output.room.points[0].x).toBe(0);
  });

  it.each([undefined, null, [], 'Projekt', 42])('weist ungültige Wurzelwerte %s zurück', input => {
    expect(() => parseProject(input)).toThrow();
  });

  it('weist fremde Versionen und unbekannte Auswahlwerte zurück', () => {
    expect(() => parseProject({ ...fresh(), version: 2 })).toThrow('Projektversion');
    expect(() => parseProject({ ...fresh(), version: '1' })).toThrow('Projektversion');
    const input = fresh();
    expect(() => parseProject({ ...input, layout: { ...input.layout, pattern: 'unknown' } })).toThrow('Muster');
    expect(() => parseProject({ ...input, material: { ...input.material, color: '<script>' } })).toThrow('Farbe');
  });

  it('weist unendliche, fehlende und als Text gespeicherte Zahlen zurück', () => {
    for (const width of [NaN, Infinity, -Infinity, undefined, '600', 0, -10]) {
      const input = fresh();
      expect(() => parseProject({ ...input, material: { ...input.material, width } })).toThrow('Produktlänge');
    }
  });

  it('weist gebrochene Stückzahlen je Paket bereits im Importschema zurück', () => {
    const input = fresh(); input.material.piecesPerPack = 1.5;
    expect(() => parseProject(input)).toThrow();
  });

  it('akzeptiert die UI-Grenzen ohne Umrechnung und weist Überschreitungen zurück', () => {
    const input = fresh(); input.room.width = 50_000; input.room.height = 100;
    input.layout.offsetX = -50_000; input.layout.offsetY = 50_000;
    input.material.width = 10; input.material.height = 5000;
    input.material.grout = 50; input.material.edgeGap = 100;
    expect(parseProject(input)).toEqual(input);
    input.layout.offsetX = -50_001;
    expect(() => parseProject(input)).toThrow('Versatz X');
  });

  it('prüft Eckpunkt- und Hindernisgrenzen', () => {
    const input = fresh();
    input.room.points = Array.from({ length: 33 }, (_, i) => ({ x: i, y: i }));
    expect(() => parseProject(input)).toThrow('32');
    input.room.points = fresh().room.points;
    input.room.obstacles = Array.from({ length: 25 }, (_, i) => ({ id: String(i), x: i, y: i, width: 10, height: 10 }));
    expect(() => parseProject(input)).toThrow('24');
  });
});

describe('Lokaler Speicher', () => {
  it('liefert unabhängige Ausgangswerte ohne gespeicherte Daten', () => {
    const first = loadProject(), second = loadProject();
    expect(first.error).toBeNull();
    first.project.room.width = 999;
    expect(second.project.room.width).toBe(DEFAULT_PROJECT.room.width);
    expect(DEFAULT_PROJECT.room.width).toBe(4200);
  });

  it('meldet beschädigte Daten und erhält den ursprünglichen Speicherinhalt', () => {
    const damaged = '{kaputt';
    localStorage.setItem(STORAGE_KEY, damaged);
    const result = loadProject();
    expect(result.error).toContain('nicht geladen');
    expect(result.project).toEqual(DEFAULT_PROJECT);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(damaged);
  });

  it.each(['corner', 'side'] as const)('erhält einen alten Einzelraum mit veralteter Startposition %s', kind => {
    const input = fresh();
    input.name = 'Dreieck';
    input.room.shape = 'custom';
    input.room.points[3] = { ...input.room.points[0] };
    input.layout = { ...input.layout, start: { kind, index: 3 }, offsetX: 120, offsetY: -70 };
    const saved = JSON.stringify(input);
    localStorage.setItem(STORAGE_KEY, saved);

    const loaded = loadProject();
    expect(loaded.error).toBeNull();
    expect(loaded.warning).toBe(RECOVERED_START_NOTICE);
    expect(loaded.project).toEqual({ ...input, layout: { pattern: 'third', angle: 0, offsetX: 0, offsetY: 0 } });
    expect(calculateLayout(loaded.project).roomPolygon).toHaveLength(3);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
    expect(() => parseProject(input)).toThrow('Start');
  });

  it.each([
    { kind: 'corner', index: -1 }, { kind: 'corner', index: 32 },
    { kind: 'side', index: 2.5 }, { kind: 'unknown', index: 3 }, null,
  ])('repariert keine strukturell ungültigen Startdaten: %j', start => {
    const input = fresh();
    const saved = JSON.stringify({ ...input, layout: { ...input.layout, start } });
    localStorage.setItem(STORAGE_KEY, saved);
    expect(loadProject().error).toContain('nicht geladen');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
  });

  it('erhält gültige Startposition und Versatz beim Laden unverändert', () => {
    const input = fresh();
    input.layout = { ...input.layout, start: { kind: 'side', index: 3 }, offsetX: 120, offsetY: -70 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(input));
    expect(loadProject()).toEqual({ project: input, error: null });
  });

  it('erhält gültige gespeicherte Varianten, wenn eine andere Variante defekt ist', () => {
    localStorage.setItem(VARIANTS_KEY, JSON.stringify([
      { id: 'one', name: 'Kreuzverband', project: fresh(), createdAt: '2026-10-25' },
      { id: 'broken', name: 'Fehler', project: { version: 99 } },
      { id: 'two', name: 'Diagonal', project: { ...fresh(), layout: { ...fresh().layout, pattern: 'diagonal' } }, createdAt: '2026-10-25' },
    ]));
    const variants = loadVariants();
    expect(variants.map(variant => variant.name)).toEqual(['Kreuzverband', 'Diagonal']);
    expect(variants[1].project.layout.pattern).toBe('diagonal');
  });

  it('erholt sich von blockiertem Browserspeicher', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Storage blocked'); } });
    expect(loadProject().error).not.toBeNull();
    expect(loadVariants()).toEqual([]);
  });
});

function svgAttributes(svg: string) {
  const outer = svg.match(/^<svg\s[^>]+>/)?.[0];
  if (!outer) throw new Error('SVG-Wurzel fehlt');
  const width = Number(outer.match(/\bwidth="([\d.e+-]+)mm"/)?.[1]);
  const height = Number(outer.match(/\bheight="([\d.e+-]+)mm"/)?.[1]);
  const viewBox = outer.match(/\bviewBox="([^"]+)"/)?.[1].split(' ').map(Number);
  if (!viewBox) throw new Error('SVG-viewBox fehlt');
  return { width, height, viewBox };
}

describe('Maßstäblicher SVG-Export', () => {
  it.each([10, 20, 25, 50, 100, 200, 500])('erhält bei 1:%s in beiden Achsen exakt das Verhältnis mm zu Papier-mm', scale => {
    const input = fresh(); input.room.width = 1234.5; input.room.height = 678.25;
    const result = calculateLayout(input);
    const svg = createPlanSvg(input, result, scale);
    const { width, height, viewBox } = svgAttributes(svg);
    expect(viewBox[2] / width).toBeCloseTo(scale, 10);
    expect(viewBox[3] / height).toBeCloseTo(scale, 10);
    expect(width - result.bounds.width / scale).toBeCloseTo(18, 10);
    expect(height - result.bounds.height / scale).toBeCloseTo(18, 10);
    expect(svgDimensions(result, scale)).toEqual({ width, height });
  });

  it('bezieht negative Raumkoordinaten ohne Verschiebung oder Skalierungsfehler ein', () => {
    const input = fresh(); input.room.shape = 'custom';
    input.room.points = [{ x: -1500, y: -800 }, { x: 2000, y: -800 }, { x: 2000, y: 900 }, { x: -1500, y: 900 }];
    const result = calculateLayout(input);
    const { viewBox, width, height } = svgAttributes(createPlanSvg(input, result, 25));
    expect(viewBox).toEqual([-1725, -1025, 3950, 2150]);
    expect(width).toBe(158); expect(height).toBe(86);
  });

  it('zeigt cm-Bemaßung und mm-Produktwerte passend zur Geometrie', () => {
    const input = fresh(); input.room.width = 4200; input.room.height = 3600;
    const svg = createPlanSvg(input, calculateLayout(input), 25);
    expect(svg).toContain('420 cm</text>');
    expect(svg).toContain('360 cm</text>');
    expect(svg).toContain('Produkt 600 × 300 mm. Fuge 3 mm. Randabstand 5 mm.');
    expect(formatArea(15_120_000)).toBe('15,12 m²');
  });

  it('maskiert XML-Sonderzeichen im Titel und im Attribut', () => {
    const input = fresh();
    input.name = '\"><script>alert(1)</script> & \' „Raum“';
    const svg = createPlanSvg(input, calculateLayout(input), 25);
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt; &amp; &apos; „Raum“');
    expect(svg.match(/<title>/g)).toHaveLength(1);
    expect(svg.match(/aria-label="/g)).toHaveLength(1);
    expect(filename('../Bad / Ost:*?')).toBe('Bad-Ost');
  });
});

function parseCsv(csv: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  const text = csv.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ';' && !quoted) { row.push(cell); cell = ''; }
    else if (char === '\r' && text[i + 1] === '\n' && !quoted) { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
    else cell += char;
  }
  row.push(cell); rows.push(row); return rows;
}

describe('Elementliste mit Konturen', () => {
  it('erhält jede Teilkontur und verwendet ausdrücklich mm und mm²', () => {
    const input = fresh(); input.room.width = 1000; input.room.height = 1000;
    input.material.width = 1000; input.material.height = 1000; input.material.edgeGap = 0; input.material.grout = 0;
    input.layout = { pattern: 'grid', angle: 0, offsetX: 0, offsetY: 0 };
    input.room.obstacles = [{ id: 'wall', x: 490, y: 0, width: 20, height: 1000 }];
    const result = calculateLayout(input), csv = createCutCsv(result), rows = parseCsv(csv);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(rows).toHaveLength(result.pieces.length + 1);
    expect(rows[0]).toEqual(['Element', 'Typ', 'Hüllmaß Länge (mm)', 'Hüllmaß Breite (mm)', 'Verlegte Fläche (mm²)', 'Teilflächen', 'Konturpunkte (mm)', 'Startfliese']);
    const row = rows[1];
    expect(row.slice(0, 6)).toEqual(['1', 'Zuschnitt', '1000,00', '1000,00', '980000,00', '2']);
    expect(JSON.parse(row[6])).toEqual(result.pieces[0].polygons);
  });

  it('unterscheidet ganze Elemente und Zuschnitte und exportiert numerische Werte mit höchstens 0,005 mm Rundungsabweichung', () => {
    const input = fresh(); input.layout.offsetX = -127.375;
    const result = calculateLayout(input), rows = parseCsv(createCutCsv(result));
    expect(rows.slice(1).filter(row => row[1] === 'Zuschnitt')).toHaveLength(result.cutCount);
    expect(rows.slice(1).filter(row => row[1] === 'Ganz')).toHaveLength(result.fullCount);
    for (let i = 0; i < result.pieces.length; i++) {
      const row = rows[i + 1], piece = result.pieces[i];
      expect(Math.abs(Number(row[2].replace(',', '.')) - piece.width)).toBeLessThanOrEqual(0.00500001);
      expect(Math.abs(Number(row[3].replace(',', '.')) - piece.height)).toBeLessThanOrEqual(0.00500001);
      expect(Math.abs(Number(row[4].replace(',', '.')) - piece.area)).toBeLessThanOrEqual(0.00500001);
      expect(JSON.parse(row[6])).toEqual(piece.polygons);
    }
  });
});

describe('Startposition bei Raumänderungen', () => {
  it.each(['corner', 'side'] as const)('löst %s beim Schließen einer Kontur und erhält alle übrigen Eingaben', kind => {
    const input = fresh();
    input.room.shape = 'custom';
    input.layout = { ...input.layout, start: { kind, index: 3 }, angle: 17, offsetX: 120, offsetY: -70 };
    const before = structuredClone(input);
    const points = input.room.points.map((point, index) => index === 3 ? { ...input.room.points[0] } : point);
    const changed = updateRoom(input, { points });
    expect(changed).toEqual({ ...input, room: { ...input.room, points }, layout: { pattern: 'third', angle: 17, offsetX: 0, offsetY: 0 } });
    expect(input).toEqual(before);
    expect(parseProject(JSON.parse(JSON.stringify(changed)))).toEqual(changed);
    expect(calculateLayout(changed).roomPolygon).toHaveLength(3);
    const reopened = updateRoom({ ...changed, layout: { ...changed.layout, start: { kind, index: 2 } } }, { points: input.room.points });
    expect(reopened.layout.start).toBeUndefined();
    expect(calculateLayout(reopened).roomPolygon).toHaveLength(4);
  });

  it('erhält die Bindung beim Verschieben eines Eckpunkts ohne Änderung der Punktfolge', () => {
    const input = fresh(); input.room.shape = 'custom';
    input.layout = { ...input.layout, start: { kind: 'corner', index: 3 }, offsetX: 120, offsetY: -70 };
    const changed = updateRoom(input, { points: input.room.points.map((point, index) => index === 3 ? { ...point, y: 3700 } : point) });
    expect(changed.layout).toEqual(input.layout);
    expect(calculateLayout(changed).start!.reference).toEqual({ x: 0, y: 3700 });
  });

  it('setzt Bindungen bei Formwechsel und Entfernen eines Eckpunkts zurück', () => {
    const input = fresh(); input.layout.start = { kind: 'side', index: 3 };
    expect(updateRoom(input, { shape: 'custom' }).layout.start).toBeUndefined();
    input.room.shape = 'custom';
    expect(updateRoom(input, { points: input.room.points.slice(0, 3) }).layout.start).toBeUndefined();
  });

  it('ändert einen freien Versatz bei einer Konturänderung nicht', () => {
    const input = fresh(); input.layout.offsetX = 120; input.layout.offsetY = -70;
    expect(updateRoom(input, { shape: 'custom' }).layout).toEqual(input.layout);
  });

  it('zählt einen nahezu gleichen Endpunkt wie die Geometrie', () => {
    const input = fresh(); input.room.shape = 'custom';
    input.room.points[3] = { x: 0.9e-7, y: 0.9e-7 };
    expect(roomVertexCount(input.room)).toBe(3);
    expect(getRoomPolygon(input.room)).toHaveLength(3);
    expect(() => parseProject({ ...input, layout: { ...input.layout, start: { kind: 'corner', index: 3 } } })).toThrow('Start');
  });
});

describe('Gespeicherte Startposition', () => {
  it('erhält Ecke und Wand in der Projektdatei', () => {
    for (const kind of ['corner', 'side'] as const) {
      const input = fresh(); input.layout.start = { kind, index: 2 };
      const restored = parseProject(JSON.parse(JSON.stringify(input)));
      expect(restored.layout).toEqual(input.layout);
      expect(calculateLayout(restored)).toEqual(calculateLayout(input));
    }
  });

  it('lädt alte Projekte ohne Startposition ohne Änderung des Rasters', () => {
    const input = fresh();
    expect(parseProject(input).layout).toEqual(input.layout);
    expect(calculateLayout(parseProject(input)).start).toBeUndefined();
  });

  it.each([{kind:'corner',index:-1},{kind:'side',index:4},{kind:'corner',index:1.5},{kind:'unknown',index:0},null])('weist ungültige Startdaten zurück: %j', start => {
    const input = fresh();
    expect(() => parseProject({...input,layout:{...input.layout,start}})).toThrow();
  });

  it('kennzeichnet dieselbe erste Fliese in SVG und CSV', () => {
    const input = fresh(); input.layout.start = { kind: 'corner', index: 2 };
    const result = calculateLayout(input), rows = parseCsv(createCutCsv(result));
    expect(rows[1][0]).toBe('1');
    expect(rows[1][7]).toBe('Ja');
    expect(rows.slice(2).every(row => row[7] === '')).toBe(true);
    expect(JSON.parse(rows[1][6])).toEqual(result.pieces[0].polygons);
    const svg = createPlanSvg(input, result);
    expect(svg).toContain('Startfliese 1: Unten rechts');
    expect(svg).toContain(`cx="${result.start!.point.x}" cy="${result.start!.point.y}"`);
    expect(svg).toContain('>Start</text>');
  });
});
