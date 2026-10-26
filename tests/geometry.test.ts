import { describe, expect, it } from 'vitest';
import polygonClipping from 'polygon-clipping';
import ClipperLib from 'clipper-lib';
import {
  calculateLayout, getBounds, getCenteredLayout, getRoomPolygon, MAX_PIECES, multiPolygonPath, polygonArea, validateRoom,
} from '../src/lib/geometry';
import type { MultiPolygon, Pattern, Point, Project } from '../src/types';

function project(): Project {
  return {
    version: 1, name: 'Geometrietest',
    room: { shape: 'rectangle', width: 1200, height: 600, notchWidth: 600, notchHeight: 300, points: [], obstacles: [] },
    material: { kind: 'tile', width: 600, height: 300, grout: 0, edgeGap: 0, color: 'limestone', piecesPerPack: 4, reserve: 0, minCut: 50 },
    layout: { pattern: 'grid', angle: 0, offsetX: 0, offsetY: 0 },
  };
}

const toClip = (polygons: MultiPolygon): polygonClipping.MultiPolygon => polygons.map(polygon =>
  polygon.map(ring => ring.map(({ x, y }) => [x, y] as [number, number])));
const integerPaths = (polygons: polygonClipping.MultiPolygon): ClipperLib.Paths => polygons.flatMap(polygon =>
  polygon.map(ring => ring.map(([x, y]) => ({ X: Math.round(x * 1e6), Y: Math.round(y * 1e6) }))));
const area = (polygons: polygonClipping.MultiPolygon) => polygons.reduce((total, polygon) => total + polygon.reduce((sum, ring, i) =>
  sum + (i ? -1 : 1) * polygonArea(ring.map(([x, y]) => ({ x, y }))), 0), 0);

function assertInvariants(input: Project, compareUnion = true) {
  const result = calculateLayout(input);
  expect(result.neededPieces).toBe(result.fullCount + result.cutCount);
  expect(result.neededPieces).toBe(result.pieces.length);
  expect(new Set(result.pieces.map(piece => piece.id)).size).toBe(result.neededPieces);
  expect(result.coveredArea).toBeLessThanOrEqual(result.usableArea + 0.01);
  expect(result.usableArea).toBeLessThanOrEqual(result.roomArea + 0.01);
  expect(result.pieces.every(piece => Number.isFinite(piece.area) && piece.area > 0)).toBe(true);
  const tileArea = input.material.width * input.material.height;
  expect(result.wasteArea + result.coveredArea).toBeCloseTo(result.neededPieces * tileArea, 5);
  expect(result.pieces.every(piece => piece.area <= tileArea + 0.01)).toBe(true);
  if (compareUnion) {
    const polygons = result.pieces.map(piece => toClip(piece.polygons));
    // Independent integer geometry avoids float sweep-line ambiguity at identical tile seams.
    const clipper = new ClipperLib.Clipper();
    const paths = polygons.flatMap(integerPaths);
    clipper.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
    const union: ClipperLib.Paths = [];
    clipper.Execute(ClipperLib.ClipType.ctUnion, union, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
    const unionArea = Math.abs(union.reduce((sum, ring) => sum + ClipperLib.Clipper.Area(ring), 0)) / 1e12;
    expect(Math.abs(unionArea - result.coveredArea)).toBeLessThan(0.01);
    const outside = new ClipperLib.Clipper();
    outside.AddPaths(union, ClipperLib.PolyType.ptSubject, true);
    outside.AddPaths(integerPaths(toClip(result.usablePolygons)), ClipperLib.PolyType.ptClip, true);
    const outsidePaths: ClipperLib.Paths = [];
    outside.Execute(ClipperLib.ClipType.ctDifference, outsidePaths, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
    const outsideArea = Math.abs(outsidePaths.reduce((sum, ring) => sum + ClipperLib.Clipper.Area(ring), 0)) / 1e12;
    expect(outsideArea).toBeLessThan(0.01);
    if (input.material.grout === 0) expect(result.coveredArea).toBeCloseTo(result.usableArea, 4);
  }
  return result;
}

function startProject(): Project {
  const input = project();
  input.room.width = 1300; input.room.height = 700;
  input.material.width = 400; input.material.height = 200;
  input.material.grout = 3; input.material.edgeGap = 5;
  return input;
}

function pointInRing(point: Point, ring: Point[]): boolean {
  let inside = false;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function assertStartMarker(result: ReturnType<typeof calculateLayout>) {
  const start = result.start!;
  expect(start).toBeDefined();
  expect(result.pieces[0].id).toBe(start.pieceId);
  expect(result.pieces[0].polygons.some(polygon => pointInRing(start.point, polygon[0])
    && polygon.slice(1).every(hole => !pointInRing(start.point, hole)))).toBe(true);
}

describe('Start an Ecke oder Wand', () => {
  it.each([[0,5,5],[1,895,5],[2,895,495],[3,5,495]])('legt die ganze Startfliese an Ecke %i mit 5 mm Randfuge', (index, x, y) => {
    const input = startProject(); input.layout.start = { kind: 'corner', index };
    const result = assertInvariants(input), first = result.pieces[0];
    expect(first.cut).toBe(false);
    expect(getBounds(first.polygons[0][0])).toMatchObject({ minX:x,minY:y,width:400,height:200 });
    expect(result.neededPieces).toBe(16);
    assertStartMarker(result);
  });

  it.each([[0,450,5],[1,895,250],[2,450,495],[3,5,250]])('zentriert die ganze Startfliese an Wand %i', (index, x, y) => {
    const input = startProject(); input.layout.start = { kind: 'side', index };
    const result = assertInvariants(input);
    expect(result.pieces[0].cut).toBe(false);
    expect(getBounds(result.pieces[0].polygons[0][0])).toMatchObject({minX:x,minY:y,width:400,height:200});
    assertStartMarker(result);
  });

  it('ändert die tatsächlichen Zuschnitte und Mengen beim Wechsel zwischen Ecke und Wand', () => {
    const input = startProject(); input.layout.start = { kind: 'corner', index: 0 };
    const corner = assertInvariants(input);
    input.layout.start = { kind: 'side', index: 1 };
    const side = assertInvariants(input);
    expect(side.pieces.map(piece => piece.polygons)).not.toEqual(corner.pieces.map(piece => piece.polygons));
    expect(side.cutCount).not.toBe(corner.cutCount);
    expect(side.wastePercent).not.toBe(corner.wastePercent);
  });

  it('hält die Startecke bei geändertem Raum- und Produktmaß sowie Randfuge fest', () => {
    const input = startProject(); input.layout.start = { kind: 'corner', index: 2 };
    input.room.width = 1710; input.room.height = 955;
    input.material.width = 310; input.material.height = 180; input.material.edgeGap = 12;
    const result = assertInvariants(input);
    expect(getBounds(result.pieces[0].polygons[0][0])).toMatchObject({minX:1388,minY:763,maxX:1698,maxY:943,width:310,height:180});
    expect(result.pieces[0].cut).toBe(false);
  });

  it('zeigt bei manuellem Versatz den Zuschnitt an der Startstelle als Element 1', () => {
    const input = startProject(); input.layout.start = { kind: 'corner', index: 0 };
    input.layout.offsetX = -70; input.layout.offsetY = -30;
    const result = assertInvariants(input);
    expect(result.pieces[0]).toMatchObject({cut:true,width:330,height:170});
    assertStartMarker(result);
    expect(getCenteredLayout(input).start).toBeUndefined();
  });

  it.each(['grid','half','third','quarter','random','diagonal','herringbone'] as const)('erhält Flächen, Fugen und Startmarker für %s bei allen Ecken und Wänden', pattern => {
    for (const angle of [0, 23.7, 90]) for (const kind of ['corner','side'] as const) for (let index=0;index<4;index++) {
      const input = startProject(); input.layout = { pattern, angle, offsetX:0,offsetY:0,start:{kind,index} };
      const result = assertInvariants(input);
      assertStartMarker(result);
      input.material.grout = 0;
      assertInvariants(input);
    }
  });

  it('verwendet die tatsächlichen Ecken einer schrägen PDF-Kontur in beiden Umlaufrichtungen', () => {
    const input = startProject(); input.room.shape = 'custom';
    const contour = [{x:100,y:50},{x:1400,y:300},{x:1250,y:1000},{x:-50,y:750}];
    for (const points of [contour,[...contour].reverse()]) {
      input.room.points = points;
      for (let index=0;index<4;index++) {
        input.layout.start = { kind:'corner',index };
        const result = assertInvariants(input);
        expect(result.start!.reference).toEqual(points[index]);
        assertStartMarker(result);
      }
    }
  });

  it('unterstützt alle sechs Ecken und Wände eines L-Raumes einschließlich Innenecke', () => {
    const input = startProject(); input.room.shape = 'l-shape'; input.room.notchWidth=450;input.room.notchHeight=280;
    for (const kind of ['corner','side'] as const) for (let index=0;index<6;index++) {
      input.layout.start = {kind,index};
      const result = assertInvariants(input);
      expect(result.start!.label).toContain(String(index+1));
      assertStartMarker(result);
    }
  });

  it('setzt den Startmarker trotz Hindernis und getrennten Teilflächen auf verlegten Belag', () => {
    const input = startProject(); input.layout.start = {kind:'corner',index:0};
    input.room.obstacles = [{id:'blocked',x:0,y:0,width:500,height:250},{id:'split',x:680,y:0,width:20,height:700}];
    const result = assertInvariants(input);
    assertStartMarker(result);
    expect(result.start!.point.x >= 505 || result.start!.point.y >= 255).toBe(true);
  });

  it('verträgt einen zusätzlichen Punkt auf einer geraden Wand', () => {
    const input = startProject(); input.room.shape='custom';
    input.room.points=[{x:0,y:0},{x:650,y:0},{x:1300,y:0},{x:1300,y:700},{x:0,y:700}];
    input.layout.start={kind:'corner',index:1};
    assertStartMarker(assertInvariants(input));
  });
});

describe('millimetergenaue Grundgeometrie', () => {
  it('zählt vier vollständig passende Fliesen ohne Verschnitt', () => {
    const result = assertInvariants(project());
    expect(result.fullCount).toBe(4);
    expect(result.cutCount).toBe(0);
    expect(result.roomArea).toBe(720_000);
    expect(result.coveredArea).toBe(720_000);
    expect(result.wasteArea).toBe(0);
    expect(result.minCutWidth).toBe(0);
  });

  it('berechnet Fugen als echte freie Flächen', () => {
    const input = project();
    input.room.width = 1203; input.room.height = 603; input.material.grout = 3;
    const result = assertInvariants(input);
    expect(result.fullCount).toBe(4);
    expect(result.cutCount).toBe(0);
    expect(result.usableArea - result.coveredArea).toBe(5409);
    const row = result.pieces.filter(piece => Math.abs(getBounds(piece.original).minY) < 0.001);
    expect(getBounds(row[1].original).minX - getBounds(row[0].original).maxX).toBe(3);
  });

  it('zieht Randfugen vor der Fliesenaufteilung ab', () => {
    const input = project();
    input.room.width = 1223; input.room.height = 623;
    input.material.grout = 3; input.material.edgeGap = 10;
    input.layout.offsetX = 10; input.layout.offsetY = 10;
    const result = assertInvariants(input);
    expect(result.fullCount).toBe(4); expect(result.cutCount).toBe(0);
    expect(result.usableArea).toBe(1203 * 603);
    expect(getBounds(result.usablePolygons[0][0])).toEqual({ minX: 10, minY: 10, maxX: 1213, maxY: 613, width: 1203, height: 603 });
  });

  it('behält Fugen und Zuschnitte im Bereich unter einem Millimeter', () => {
    const input = project();
    input.room.width = 1200.25; input.room.height = 600.75;
    input.material.width = 600.125; input.material.height = 300.375;
    input.material.edgeGap = 0.125;
    const result = assertInvariants(input);
    expect(result.usableArea).toBeCloseTo(1200 * 600.5, 5);
    expect(result.cutCount).toBe(4);
    expect(result.pieces[0].width).toBeCloseTo(600, 6);
  });

  it('setzt negative Rasterverschiebungen periodisch korrekt um', () => {
    const input = project(); input.layout.offsetX = -100;
    const result = assertInvariants(input);
    expect(result.neededPieces).toBe(6);
    expect(result.cutCount).toBe(4); expect(result.fullCount).toBe(2);
    expect(result.minCutWidth).toBeCloseTo(100, 6);
    input.layout.offsetX = 500;
    const shifted = assertInvariants(input);
    expect(shifted.coveredArea).toBe(result.coveredArea);
    expect(shifted.neededPieces).toBe(result.neededPieces);
    expect(shifted.minCutWidth).toBe(result.minCutWidth);
  });

  it('zählt Ausgangsstücke, Verschnitt, Reserve und volle Pakete getrennt', () => {
    const input = project(); input.layout.offsetX = -100;
    input.material.reserve = 10; input.material.piecesPerPack = 4;
    const result = calculateLayout(input);
    expect(result.neededPieces).toBe(6);
    expect(result.wasteArea).toBe(360_000);
    expect(result.wastePercent).toBeCloseTo(100 / 3, 8);
    expect(result.recommendedPieces).toBe(7);
    expect(result.packs).toBe(2);
  });
});

describe('Raumformen und Hindernisse', () => {
  it('setzt die L-Aussparung rechts oben um', () => {
    const input = project(); input.room.shape = 'l-shape'; input.room.height = 900;
    input.material.width = 300;
    const result = assertInvariants(input);
    expect(result.roomArea).toBe(900_000);
    expect(result.neededPieces).toBe(10);
    expect(result.cutCount).toBe(0);
    expect(result.pieces.some(piece => { const b = getBounds(piece.original); return b.minX >= 600 && b.minY < 300; })).toBe(false);
  });

  it('erzeugt bei konkaven Kanten einen echten inneren Polygonversatz', () => {
    const input = project(); input.room.shape = 'l-shape'; input.room.height = 900;
    input.material.edgeGap = 10;
    const result = assertInvariants(input);
    expect(result.usableArea).toBe(900_000 - 4200 * 10 + 4 * 10 ** 2);
    expect(result.usablePolygons[0][0].some(point => point.x === 590 && point.y === 310)).toBe(true);
  });

  it('schneidet einen konkaven freien Grundriss und ignoriert dessen ungenutzte Breite/Höhe', () => {
    const input = project(); input.room.shape = 'custom';
    input.room.width = 0; input.room.height = 0;
    input.room.points = [
      { x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 600 }, { x: 900, y: 600 },
      { x: 900, y: 0 }, { x: 1200, y: 0 }, { x: 1200, y: 900 }, { x: 0, y: 900 },
    ];
    input.material.width = 300;
    const result = assertInvariants(input);
    expect(result.roomArea).toBe(720_000);
    expect(result.neededPieces).toBe(8);
    input.room.points.reverse();
    expect(assertInvariants(input).coveredArea).toBe(result.coveredArea);
  });

  it('behält zwei Teilflächen bei, wenn Randfugen einen schmalen Durchgang schließen', () => {
    const input = project(); input.room.shape = 'custom';
    input.room.points = [
      { x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 190 }, { x: 800, y: 190 },
      { x: 800, y: 0 }, { x: 1200, y: 0 }, { x: 1200, y: 400 }, { x: 800, y: 400 },
      { x: 800, y: 210 }, { x: 400, y: 210 }, { x: 400, y: 400 }, { x: 0, y: 400 },
    ];
    input.material.edgeGap = 11;
    const result = assertInvariants(input);
    expect(result.usablePolygons.length).toBe(2);
  });

  it('zieht Hindernisse und deren Randfugen exakt ab', () => {
    const input = project(); input.room.height = 900; input.material.edgeGap = 10;
    input.room.obstacles = [{ id: 'insel', x: 300, y: 300, width: 600, height: 300 }];
    const result = assertInvariants(input);
    expect(result.roomArea).toBe(900_000);
    expect(result.usableArea).toBe(1180 * 880 - 620 * 320);
  });

  it('subtrahiert überlappende und teilweise außerhalb liegende Hindernisse nur einmal', () => {
    const input = project();
    input.room.obstacles = [
      { id: 'a', x: -100, y: 0, width: 400, height: 300 },
      { id: 'b', x: 200, y: 0, width: 200, height: 300 },
    ];
    const result = assertInvariants(input);
    expect(result.roomArea).toBe(720_000 - 400 * 300);
  });

  it('zählt ein Ausgangsstück auch mit mehreren getrennten Schnittteilen nur einmal', () => {
    const input = project(); input.room.width = 1000; input.room.height = 1000;
    input.material.width = 1000; input.material.height = 1000;
    input.room.obstacles = [{ id: 'wand', x: 490, y: 0, width: 20, height: 1000 }];
    const result = assertInvariants(input);
    expect(result.neededPieces).toBe(1);
    expect(result.pieces[0].polygons.length).toBe(2);
    expect(result.pieces[0].minDimension).toBe(490);
    expect(result.wasteArea).toBe(20_000);
    expect(result.warnings.join(' ')).toContain('getrennte Teilstücke');
  });

  it('erhält Innenlöcher und zieht deren Fläche ab', () => {
    const input = project(); input.room.width = 1000; input.room.height = 1000;
    input.material.width = 1000; input.material.height = 1000;
    input.room.obstacles = [{ id: 'säule', x: 400, y: 400, width: 200, height: 200 }];
    const result = assertInvariants(input);
    expect(result.pieces[0].polygons[0].length).toBe(2);
    expect(result.coveredArea).toBe(960_000);
  });
});

describe('Muster, Drehung und Zentrieren', () => {
  it.each([['half', 7, 5, 2], ['third', 8, 4, 4], ['quarter', 8, 4, 4]] as const)
  ('berechnet %s mit periodischem Zeilenversatz', (pattern, total, full, cut) => {
    const input = project(); input.room.height = 900; input.layout.pattern = pattern;
    const result = assertInvariants(input);
    expect(result.neededPieces).toBe(total);
    expect(result.fullCount).toBe(full); expect(result.cutCount).toBe(cut);
  });

  it('erzeugt einen reproduzierbaren wilden Verband auch für negative Zeilen', () => {
    const input = project(); input.layout.pattern = 'random'; input.layout.offsetY = 450;
    expect(assertInvariants(input)).toEqual(calculateLayout(input));
  });

  it.each(['grid', 'half', 'third', 'quarter', 'random', 'diagonal', 'herringbone'] as Pattern[])
  ('bedeckt bei %s mit beliebiger Drehung ohne Fuge genau den Grundriss', pattern => {
    const input = project(); input.room.width = 1730; input.room.height = 1370;
    input.material.width = 413; input.material.height = 197;
    input.layout = { pattern, angle: 23.7, offsetX: -173.5, offsetY: 147.75 };
    assertInvariants(input);
  });

  it('addiert beim Diagonalverband 45° zum eingestellten Winkel', () => {
    const input = project(); input.layout.pattern = 'diagonal'; input.layout.angle = 12;
    const result = calculateLayout(input);
    expect(result.pieces[0].angle).toBe(57);
    const [a, b] = result.pieces[0].original;
    expect(Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI).toBeCloseTo(57, 10);
  });

  it('misst Zuschnitte in Fliesenachsen unabhängig von der Weltdrehung', () => {
    const input = project(); input.room.width = 1000; input.room.height = 1000;
    input.material.width = 600; input.material.height = 250;
    input.layout.angle = 90; input.layout.offsetX = -100;
    const result = assertInvariants(input);
    expect(result.minCutWidth).toBeCloseTo(250, 5);
    expect(result.pieces.every(piece => piece.height <= 250 + 1e-5 && piece.width <= 600 + 1e-5)).toBe(true);
  });

  it('zentriert passende Raster und erzeugt gleich breite Randstücke', () => {
    const input = project(); input.room.width = 1000; input.material.grout = 3; input.material.edgeGap = 10;
    input.layout = getCenteredLayout(input);
    expect(input.layout.offsetX).toBeCloseTo(-101.5, 8);
    const result = calculateLayout(input);
    const row = result.pieces.filter(piece => getBounds(piece.original).minY < 100);
    expect(row.length).toBe(2);
    expect(row[0].width).toBeCloseTo(488.5, 5);
    expect(row[1].width).toBeCloseTo(488.5, 5);
    expect(getCenteredLayout(input)).toEqual(input.layout);
  });

  it('zentriert auch gedrehte Raster innerhalb der lokalen Raumbegrenzung', () => {
    const input = project(); input.layout.angle = 31.5; input.material.grout = 4;
    input.layout = getCenteredLayout(input);
    const result = assertInvariants(input);
    expect(Number.isFinite(result.coveredArea)).toBe(true);
    expect(getCenteredLayout(input)).toEqual(input.layout);
  });
});

function pointSegmentDistance(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}
function polygonDistance(a: Point[], b: Point[]): number {
  return Math.min(...a.flatMap(point => b.map((start, i) => pointSegmentDistance(point, start, b[(i + 1) % b.length]))),
    ...b.flatMap(point => a.map((start, i) => pointSegmentDistance(point, start, a[(i + 1) % a.length]))));
}

describe('Fischgrät: exakte Kachelung mit Fugen', () => {
  it.each([[500, 200], [513, 197], [197, 513], [300, 300], [1000, 37]])
  ('kachelt mit Seiten %s × %s ohne Lücken und Überlagerung', (width, height) => {
    const input = project(); input.room.width = 2100; input.room.height = 1500;
    input.material.width = width; input.material.height = height;
    input.layout = { pattern: 'herringbone', angle: -45, offsetX: -72, offsetY: 35 };
    assertInvariants(input);
  });

  it('hält bei ungeradem Seitenverhältnis jede Fuge exakt frei', () => {
    const input = project(); input.room.width = 1800; input.room.height = 1300;
    input.material.width = 513; input.material.height = 197; input.material.grout = 4.5;
    input.layout = { pattern: 'herringbone', angle: -12.3, offsetX: -49, offsetY: 17 };
    const result = assertInvariants(input);
    let minimumDistance = Infinity;
    for (let i = 0; i < result.pieces.length; i++) {
      for (let j = i + 1; j < result.pieces.length; j++) {
        const a = result.pieces[i], b = result.pieces[j];
        expect(area(polygonClipping.intersection(toClip([[a.original]]), toClip([[b.original]])))).toBeLessThan(0.001);
        minimumDistance = Math.min(minimumDistance, polygonDistance(a.original, b.original));
      }
    }
    expect(minimumDistance).toBeCloseTo(4.5, 7);
    expect(new Set(result.pieces.map(piece => piece.angle))).toEqual(new Set([32.7, 122.7]));
  });
});

describe('Grenzen und Hilfsfunktionen', () => {
  it('weist kreuzende, berührende und rückwärts laufende Raumkanten zurück', () => {
    const input = project(); input.room.shape = 'custom';
    const invalidPoints = [
      [{ x: 0, y: 0 }, { x: 400, y: 400 }, { x: 400, y: 0 }, { x: 0, y: 400 }],
      [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 400 }, { x: 0, y: 400 }],
      [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 200, y: 0 }, { x: 0, y: 400 }],
    ];
    for (const points of invalidPoints) {
      input.room.points = points;
      expect(validateRoom(input.room).length).toBeGreaterThan(0);
      expect(() => calculateLayout(input)).toThrow();
    }
  });

  it('akzeptiert explizit geschlossene Polygonringe ohne zusätzlichen Eckpunkt', () => {
    const input = project(); input.room.shape = 'custom';
    input.room.points = [{ x: 0, y: 0 }, { x: 1200, y: 0 }, { x: 1200, y: 600 }, { x: 0, y: 600 }, { x: 0, y: 0 }];
    expect(validateRoom(input.room)).toEqual([]);
    expect(getRoomPolygon(input.room).length).toBe(4);
    expect(calculateLayout(input).fullCount).toBe(4);
  });

  it('weist ungültige Materialmaße, Fugen, Zahlen und Pakete mit deutschen Fehlern zurück', () => {
    for (const [key, value] of [['width', 0], ['height', NaN], ['grout', -1], ['edgeGap', Infinity], ['reserve', -1], ['piecesPerPack', 0], ['piecesPerPack', 1.5], ['minCut', -1]] as const) {
      const input = project(); input.material[key] = value;
      expect(() => calculateLayout(input)).toThrow();
    }
    const input = project(); input.material.edgeGap = 600;
    expect(() => calculateLayout(input)).toThrow('keine verlegbare Fläche');
  });

  it('berechnet einen großen Raum mit über 8.000 Fliesen vollständig', () => {
    const input = project(); input.room.width = 50_000; input.room.height = 30_000;
    input.material.grout = 3;
    const result = assertInvariants(input, false);
    expect(result.neededPieces).toBe(8300);
    expect(result.neededPieces).toBeLessThan(MAX_PIECES);
    expect(result.bounds.width).toBe(50_000);
  });

  it('verhindert zu große Raster durch einen Fehler statt stiller Kürzung', () => {
    const input = project(); input.room.width = 100_000; input.room.height = 100_000;
    input.material.width = 10; input.material.height = 10;
    expect(() => calculateLayout(input)).toThrow('Raster ist zu dicht');
    input.material.width = 600; input.material.height = 600;
    expect(() => calculateLayout(input)).toThrow('mehr als 12.000');
  });

  it('berechnet Flächen auch bei großen Koordinaten stabil', () => {
    const points = [{ x: 999_000, y: 999_000 }, { x: 999_010, y: 999_000 }, { x: 999_010, y: 999_020 }, { x: 999_000, y: 999_020 }];
    expect(polygonArea(points)).toBe(200);
    expect(polygonArea([...points].reverse())).toBe(200);
    expect(getBounds([]).width).toBe(0);
  });

  it('erzeugt SVG-Pfade für Außenringe und Löcher', () => {
    const path = multiPolygonPath([[[{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }], [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }]]]);
    expect(path).toBe('M0,0L20,0L20,20ZM5,5L6,5L6,6Z');
  });
});

describe('zusätzliche geometrische Invarianten', () => {
  it('behält Flächen und Stückzahlen beim Verschieben eines freien Grundrisses bei', () => {
    const input = project(); input.room.shape = 'custom';
    input.room.points = [{ x: 0, y: 0 }, { x: 1800, y: 100 }, { x: 1600, y: 1300 }, { x: 200, y: 1500 }];
    input.material.edgeGap = 7; input.material.grout = 3;
    input.layout.angle = 17;
    const before = assertInvariants(input);
    input.room.points = input.room.points.map(point => ({ x: point.x - 5000, y: point.y + 9000 }));
    const after = assertInvariants(input);
    expect(after.neededPieces).toBe(before.neededPieces);
    expect(after.coveredArea).toBeCloseTo(before.coveredArea, 5);
    expect(after.usableArea).toBeCloseTo(before.usableArea, 5);
  });

  it('prüft 35 reproduzierbare Kombinationen aus Muster, konkavem Grundriss, Randfuge und Hindernissen', () => {
    let seed = 49817;
    const random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
    const allPatterns: Pattern[] = ['grid', 'half', 'third', 'quarter', 'random', 'diagonal', 'herringbone'];
    for (let i = 0; i < 35; i++) {
      const input = project();
      input.room.shape = 'custom';
      input.room.points = Array.from({ length: 8 }, (_, j) => {
        const radius = j % 2 === 0 ? 1400 : 800;
        const angle = j / 8 * 2 * Math.PI;
        return { x: Math.cos(angle) * radius + 1500, y: Math.sin(angle) * radius + 1500 };
      });
      input.room.obstacles = [{ id: 'säule', x: 1400, y: 1400, width: 200, height: 200 }];
      input.material.width = 250 + random() * 400;
      input.material.height = 100 + random() * 150;
      input.material.grout = i % 2 ? 3.5 : 0;
      input.material.edgeGap = 5;
      input.layout = { pattern: allPatterns[i % 7], angle: random() * 360, offsetX: random() * 1000 - 500, offsetY: random() * 1000 - 500 };
      assertInvariants(input);
    }
  });
});
