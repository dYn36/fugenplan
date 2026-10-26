import { describe, expect, it } from 'vitest';
import { calibrationScale, recalibrateProject, roomToSource, sourceToRoom } from '../src/lib/calibration';
import { DEFAULT_PROJECT, parseProject } from '../src/lib/project';
import type { Calibration, RoomSource } from '../src/floorplan-types';
import type { Point, Project } from '../src/types';

const calibration = (lengthMm = 4000): Calibration => ({ start: { x: 40, y: 60 }, end: { x: 440, y: 60 }, lengthMm });
const sourcePoints: Point[] = [{ x: 40, y: 60 }, { x: 440, y: 60 }, { x: 440, y: 360 }, { x: 40, y: 360 }];
const source: RoomSource = { documentId: 'a'.repeat(64), page: 1, points: sourcePoints, origin: { x: 40, y: 60 } };
function project(): Project {
  return {
    ...structuredClone(DEFAULT_PROJECT),
    room: {
      ...structuredClone(DEFAULT_PROJECT.room), shape: 'custom', width: 4000, height: 3000,
      points: sourceToRoom(sourcePoints, calibration(), source.origin).points,
      obstacles: [{ id: 'island', x: 1000, y: 1500, width: 800, height: 600 }],
    },
    layout: { pattern: 'third', angle: 27.5, offsetX: -73.25, offsetY: 112.75 },
  };
}

function closePoints(actual: Point[], expected: Point[]) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((point, index) => {
    expect(point.x).toBeCloseTo(expected[index].x, 8);
    expect(point.y).toBeCloseTo(expected[index].y, 8);
  });
}

describe('Kalibrierung einer bekannten Wandlänge', () => {
  it('liefert mm je natürlicher PDF-Viewport-Einheit', () => {
    expect(calibrationScale(calibration())).toBe(10);
    expect(calibrationScale({ start: { x: 10, y: 20 }, end: { x: 13, y: 24 }, lengthMm: 500 })).toBe(100);
  });

  it('verwendet bei senkrechten und schrägen Wänden die euklidische Länge', () => {
    expect(calibrationScale({ start: { x: 9, y: 2 }, end: { x: 9, y: 402 }, lengthMm: 4000 })).toBe(10);
    expect(calibrationScale({ start: { x: 4, y: -3 }, end: { x: 244, y: 317 }, lengthMm: 4000 })).toBe(10);
  });

  it.each([0, -1, NaN, Infinity, -Infinity])('weist ungültige Wandlänge %s zurück', lengthMm => {
    expect(() => calibrationScale(calibration(lengthMm))).toThrow('Wandlänge');
  });

  it('weist zusammenfallende oder ungültige Kalibrierpunkte zurück', () => {
    expect(() => calibrationScale({ start: { x: 3, y: 4 }, end: { x: 3, y: 4 }, lengthMm: 1000 })).toThrow('entfernt');
    expect(() => calibrationScale({ ...calibration(), start: { x: NaN, y: 1 } })).toThrow('Punkte');
    expect(() => calibrationScale({ ...calibration(), end: { x: Infinity, y: 1 } })).toThrow('Punkte');
  });

  it('weist einen numerisch nicht darstellbaren Maßstab zurück', () => {
    expect(() => calibrationScale({ start: { x: 0, y: 0 }, end: { x: Number.MIN_VALUE, y: 0 }, lengthMm: 1e6 })).toThrow('Maßstab');
  });
});

describe('Transformation zwischen PDF-Koordinaten und Millimetern', () => {
  it('setzt den Ursprung auf die linke obere Konturgrenze', () => {
    const result = sourceToRoom(sourcePoints, calibration());
    expect(result.origin).toEqual({ x: 40, y: 60 });
    expect(result.points).toEqual([{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }]);
  });

  it('erhält einen ausdrücklich gesetzten PDF-Ursprung', () => {
    const origin = { x: -100, y: -200 };
    const result = sourceToRoom(sourcePoints, calibration(), origin);
    expect(result.origin).toEqual(origin);
    expect(result.origin).not.toBe(origin);
    expect(result.points[0]).toEqual({ x: 1400, y: 2600 });
    closePoints(roomToSource(result.points, calibration(), origin), sourcePoints);
  });

  it('erhält die PDF-Achsen; die Kalibrierwand dreht den Raum nicht', () => {
    const vertical = { start: { x: 100, y: 100 }, end: { x: 100, y: 500 }, lengthMm: 4000 };
    expect(sourceToRoom(sourcePoints, vertical)).toEqual(sourceToRoom(sourcePoints, calibration()));
  });

  it('erhält Bruchteile und negative Koordinaten bei der Rücktransformation', () => {
    const points = [{ x: -210.125, y: 71.375 }, { x: 350.875, y: 91.25 }, { x: 410.5, y: 410.125 }];
    const custom = { start: { x: 8.25, y: 4.125 }, end: { x: 308.75, y: 104.625 }, lengthMm: 3123.75 };
    const converted = sourceToRoom(points, custom);
    closePoints(roomToSource(converted.points, custom, converted.origin), points);
  });

  it('arbeitet bei großen Quellkoordinaten ohne gerundete Raumkonturen', () => {
    const points = [{ x: 99_999_100.125, y: -99_999_200.25 }, { x: 99_999_300.5, y: -99_999_100.75 }, { x: 99_999_000.75, y: -99_999_000.125 }];
    const converted = sourceToRoom(points, calibration());
    closePoints(roomToSource(converted.points, calibration(), converted.origin), points);
  });

  it('verändert weder Quellpunkte noch den Kalibrierungsursprung', () => {
    const points = structuredClone(sourcePoints), before = structuredClone(points), input = calibration();
    const converted = sourceToRoom(points, input);
    converted.points[0].x = 900;
    converted.origin.x = 800;
    expect(points).toEqual(before);
    expect(input).toEqual(calibration());
  });

  it('weist leere Konturen, ungültige Ursprünge und Überläufe zurück', () => {
    expect(() => sourceToRoom([], calibration())).toThrow('Kontur');
    expect(() => sourceToRoom(sourcePoints, calibration(), { x: NaN, y: 0 })).toThrow('Bezugspunkt');
    expect(() => roomToSource(sourcePoints, calibration(), { x: 0, y: Infinity })).toThrow('Bezugspunkt');
    expect(() => sourceToRoom([{ x: Number.MAX_VALUE, y: 0 }], calibration(), { x: 0, y: 0 })).toThrow('Koordinaten');
  });
});

describe('Neukalibrierung vorhandener Räume', () => {
  it('verdoppelt Kontur und Hindernisse, erhält aber Material und Verband', () => {
    const original = project(), before = structuredClone(original);
    const result = recalibrateProject(original, source, calibration(), calibration(8000));
    expect(result.room.width).toBe(8000);
    expect(result.room.height).toBe(6000);
    expect(result.room.points).toEqual(original.room.points.map(point => ({ x: point.x * 2, y: point.y * 2 })));
    expect(result.room.obstacles).toEqual([{ id: 'island', x: 2000, y: 3000, width: 1600, height: 1200 }]);
    expect(result.material).toEqual(original.material);
    expect(result.layout).toEqual(original.layout);
    expect(original).toEqual(before);
    expect(result.room).not.toBe(original.room);
    expect(result.room.obstacles[0]).not.toBe(original.room.obstacles[0]);
  });

  it('rekonstruiert die Kontur aus ihrer PDF-Quelle statt aus gerundeten Raummaßen', () => {
    const original = project();
    original.room.points[1] = { x: 3999.5, y: 0 };
    const result = recalibrateProject(original, source, calibration(), calibration(6000));
    expect(result.room.points[1]).toEqual({ x: 6000, y: 0 });
    expect(result.room.width).toBe(6000);
  });

  it('erhält negative Hindernispositionen ohne stille Begrenzung', () => {
    const original = project(); original.room.obstacles[0].x = -25.125;
    const result = recalibrateProject(original, source, calibration(), calibration(6000));
    expect(result.room.obstacles[0].x).toBe(-37.6875);
  });

  it('kann zur ursprünglichen Kalibrierung ohne Geometrieverlust zurückkehren', () => {
    const original = project();
    const next = calibration(5793.25);
    const larger = recalibrateProject(original, source, calibration(), next);
    const restored = recalibrateProject(larger, source, next, calibration());
    closePoints(restored.room.points, original.room.points);
    expect(restored.material).toEqual(original.material);
    expect(restored.room.obstacles[0].width).toBeCloseTo(original.room.obstacles[0].width, 8);
    expect(restored.room.obstacles[0].height).toBeCloseTo(original.room.obstacles[0].height, 8);
  });

  it('liefert einen erneut importierbaren Projektstand', () => {
    const result = recalibrateProject(project(), source, calibration(), calibration(7000));
    const restored = parseProject(JSON.parse(JSON.stringify(result)));
    expect(restored.room.points).toEqual(result.room.points);
    expect(restored.room.width).toBe(result.room.width);
    expect(restored.material).toEqual(result.material);
  });

  it('weist einen gekreuzten Quellgrundriss zurück', () => {
    const crossed: RoomSource = { ...source, points: [sourcePoints[0], sourcePoints[2], sourcePoints[1], sourcePoints[3]] };
    expect(() => recalibrateProject(project(), crossed, calibration(), calibration(8000))).toThrow('Raumkontur');
  });

  it('weist Raumgrößen außerhalb des Speicherschemas zurück statt sie abzuschneiden', () => {
    const original = project(), before = structuredClone(original);
    expect(() => recalibrateProject(original, source, calibration(), calibration(80_000))).toThrow('Raumbreite');
    expect(() => recalibrateProject(original, source, calibration(), calibration(50))).toThrow('Raumbreite');
    expect(original).toEqual(before);
  });

  it('weist unzulässige skalierte Hindernisse zurück, auch wenn die Raumkontur passt', () => {
    const original = project(); original.room.obstacles[0].width = 40_000;
    expect(() => recalibrateProject(original, source, calibration(), calibration(8000))).toThrow('Hindernisbreite');
  });
});
