import ClipperLib from 'clipper-lib';
import polygonClipping from 'polygon-clipping';
import { roomVertexCount, startLabel } from './layout-start';
import type {
  Bounds, LayoutConfig, LayoutResult, MultiPolygon, Piece, Point, Project, RoomConfig,
} from '../types';

// Offsets use a 1 µm integer grid. Tile rotation and intersection retain double precision.
const OFFSET_SCALE = 1000;
const EPS = 1e-7;
const AREA_EPS = 1e-6;
export const MAX_PIECES = 12_000;
const MAX_CANDIDATES = 60_000;
const MAX_COORDINATE = 1_000_000;
const patterns = ['grid', 'half', 'third', 'quarter', 'random', 'diagonal', 'herringbone'];
type ClipMultiPolygon = polygonClipping.MultiPolygon;

type Candidate = { id: string; x: number; y: number; width: number; height: number; vertical: boolean };

export function getBounds(points: Point[]): Bounds {
  if (!points.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x); minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function signedArea(points: Point[]): number {
  if (points.length < 3) return 0;
  // Shift to the first vertex to avoid cancellation for large world coordinates.
  const origin = points[0];
  let area = 0;
  for (let i = 1; i < points.length - 1; i++) {
    area += (points[i].x - origin.x) * (points[i + 1].y - origin.y)
      - (points[i + 1].x - origin.x) * (points[i].y - origin.y);
  }
  return area / 2;
}

export function polygonArea(points: Point[]): number { return Math.abs(signedArea(points)); }

function polygonSetArea(polygons: MultiPolygon): number {
  return polygons.reduce((total, polygon) => total + polygon.reduce((area, ring, i) =>
    area + (i === 0 ? 1 : -1) * polygonArea(ring), 0), 0);
}

function rectangle(x: number, y: number, width: number, height: number): Point[] {
  return [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
}

function equalPoints(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
}

export function getRoomPolygon(room: RoomConfig): Point[] {
  if (room.shape === 'custom') {
    return room.points.slice(0, roomVertexCount(room)).map(point => ({ ...point }));
  }
  if (room.shape === 'l-shape') {
    const x = room.width - room.notchWidth;
    return [
      { x: 0, y: 0 }, { x, y: 0 }, { x, y: room.notchHeight },
      { x: room.width, y: room.notchHeight }, { x: room.width, y: room.height }, { x: 0, y: room.height },
    ];
  }
  return rectangle(0, 0, room.width, room.height);
}

function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: Point, b: Point, point: Point): boolean {
  return Math.abs(cross(a, b, point)) < EPS
    && point.x >= Math.min(a.x, b.x) - EPS && point.x <= Math.max(a.x, b.x) + EPS
    && point.y >= Math.min(a.y, b.y) - EPS && point.y <= Math.max(a.y, b.y) + EPS;
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const c1 = cross(a, b, c), c2 = cross(a, b, d), c3 = cross(c, d, a), c4 = cross(c, d, b);
  if (((c1 > EPS && c2 < -EPS) || (c1 < -EPS && c2 > EPS))
    && ((c3 > EPS && c4 < -EPS) || (c3 < -EPS && c4 > EPS))) return true;
  return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}

const validPositive = (n: number) => Number.isFinite(n) && n > 0 && n <= MAX_COORDINATE;
const validCoordinate = (n: number) => Number.isFinite(n) && Math.abs(n) <= MAX_COORDINATE;

export function validateRoom(room: RoomConfig): string[] {
  const errors: string[] = [];
  if (!['rectangle', 'l-shape', 'custom'].includes(room.shape)) return ['Diese Raumform wird nicht unterstützt.'];
  if (room.shape !== 'custom' && (!validPositive(room.width) || !validPositive(room.height))) {
    errors.push('Raumbreite und Raumlänge müssen größer als 0 und höchstens 1.000.000 mm sein.');
  }
  if (room.shape === 'l-shape' && (!validPositive(room.notchWidth) || !validPositive(room.notchHeight)
    || room.notchWidth >= room.width || room.notchHeight >= room.height)) {
    errors.push('Die Aussparung muss kleiner als der Raum sein. Beide Maße müssen größer als 0 sein.');
  }
  if (room.shape === 'custom') {
    if (!Array.isArray(room.points) || room.points.length < 3 || room.points.length > 201) {
      errors.push('Der Grundriss benötigt 3 bis 200 Eckpunkte.');
    } else if (room.points.some(point => !point || !validCoordinate(point.x) || !validCoordinate(point.y))) {
      errors.push('Alle Eckpunkte benötigen gültige Koordinaten bis ±1.000.000 mm.');
    } else {
      const points = getRoomPolygon(room);
      if (points.length < 3 || points.length > 200) errors.push('Der Grundriss benötigt 3 bis 200 Eckpunkte.');
      if (polygonArea(points) < 1) errors.push('Die Raumfläche muss mindestens 1 mm² betragen.');
      let invalid = false;
      for (let i = 0; i < points.length && !invalid; i++) {
        const next = (i + 1) % points.length;
        const after = (i + 2) % points.length;
        if (equalPoints(points[i], points[next])) { invalid = true; break; }
        if (Math.abs(cross(points[i], points[next], points[after])) < EPS) {
          const a = points[i], b = points[next], c = points[after];
          if ((b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y) < 0) { invalid = true; break; }
        }
        for (let j = i + 1; j < points.length; j++) {
          const jNext = (j + 1) % points.length;
          if (j === next || jNext === i) continue;
          if (segmentsIntersect(points[i], points[next], points[j], points[jNext])) { invalid = true; break; }
        }
      }
      if (invalid) errors.push('Die Raumkanten dürfen sich nicht kreuzen, berühren oder überlagern.');
    }
  }
  if (!Array.isArray(room.obstacles) || room.obstacles.length > 100) errors.push('Es sind höchstens 100 Hindernisse möglich.');
  else if (room.obstacles.some(obstacle => !validCoordinate(obstacle.x) || !validCoordinate(obstacle.y)
    || !validPositive(obstacle.width) || !validPositive(obstacle.height))) {
    errors.push('Hindernisse benötigen gültige Koordinaten und Maße größer als 0.');
  }
  return errors;
}

function validateProject(project: Project): void {
  const errors = validateRoom(project.room);
  const { material, layout } = project;
  if (!validPositive(material.width) || !validPositive(material.height)) {
    errors.push('Die Materialmaße müssen größer als 0 und höchstens 1.000.000 mm sein.');
  }
  if (!Number.isFinite(material.grout) || material.grout < 0 || material.grout > 10_000) {
    errors.push('Die Fugenbreite muss zwischen 0 und 10.000 mm liegen.');
  }
  if (!Number.isFinite(material.edgeGap) || material.edgeGap < 0 || material.edgeGap > 100_000) {
    errors.push('Die Randfuge muss zwischen 0 und 100.000 mm liegen.');
  }
  if (!Number.isInteger(material.piecesPerPack) || material.piecesPerPack < 1 || material.piecesPerPack > 100_000) {
    errors.push('Die Stückzahl je Paket muss eine ganze Zahl zwischen 1 und 100.000 sein.');
  }
  if (!Number.isFinite(material.reserve) || material.reserve < 0 || material.reserve > 100) {
    errors.push('Die Reserve muss zwischen 0 und 100 % liegen.');
  }
  if (!Number.isFinite(material.minCut) || material.minCut < 0 || material.minCut > MAX_COORDINATE) {
    errors.push('Die Warnschwelle für Zuschnitte muss zwischen 0 und 1.000.000 mm liegen.');
  }
  if (!patterns.includes(layout.pattern)) errors.push('Dieses Verlegemuster wird nicht unterstützt.');
  if (layout.start && (!['corner', 'side'].includes(layout.start.kind) || !Number.isInteger(layout.start.index)
    || layout.start.index < 0 || layout.start.index >= getRoomPolygon(project.room).length)) {
    errors.push('Die Startposition muss eine vorhandene Ecke oder Wand sein.');
  }
  if (!Number.isFinite(layout.angle) || Math.abs(layout.angle) > 36_000
    || !validCoordinate(layout.offsetX) || !validCoordinate(layout.offsetY)) {
    errors.push('Winkel und Versatz benötigen gültige Werte.');
  }
  if (errors.length) throw new Error(errors.join(' '));
}

function toClip(polygons: MultiPolygon): ClipMultiPolygon {
  return polygons.map(polygon => polygon.map(ring => ring.map(({ x, y }) => [x, y] as [number, number])));
}

function fromClip(polygons: ClipMultiPolygon): MultiPolygon {
  return polygons.map(polygon => polygon.map(ring => ring.map(([x, y]) => ({ x, y }))));
}

function intersectTile(usable: ClipMultiPolygon, original: Point[]): MultiPolygon {
  try {
    return fromClip(polygonClipping.intersection(usable, toClip([[original]])));
  } catch (error) {
    // Coincident rotated vertices can make the floating-point sweep fail.
    // Retry only that intersection on a 0.000001 mm integer grid. Keep holes
    // and disconnected fragments; never replace a failed cut with a full tile.
    if (!(error instanceof Error) || !/ring|segment|sweep/i.test(error.message)) throw error;
    const scale = 1_000_000;
    const clipper = new ClipperLib.Clipper();
    const paths = usable.flatMap(polygon => polygon.map((ring, index) => {
      const path = ring.map(([x,y]) => ({X:Math.round(x*scale),Y:Math.round(y*scale)}));
      if (ClipperLib.Clipper.Orientation(path) !== (index === 0)) path.reverse();
      return path;
    }));
    clipper.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
    clipper.AddPath(original.map(({x,y}) => ({X:Math.round(x*scale),Y:Math.round(y*scale)})), ClipperLib.PolyType.ptClip, true);
    const tree = new ClipperLib.PolyTree();
    if (!clipper.Execute(ClipperLib.ClipType.ctIntersection, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)) throw error;
    return ClipperLib.JS.PolyTreeToExPolygons(tree).map(polygon => [polygon.outer,...polygon.holes].map(ring =>
      ring.map(({X,Y}) => ({x:X/scale,y:Y/scale}))));
  }
}

function offsetPolygon(points: Point[], amount: number): MultiPolygon {
  if (amount === 0) return [[points.map(point => ({ ...point }))]];
  const path = points.map(({ x, y }) => ({ X: Math.round(x * OFFSET_SCALE), Y: Math.round(y * OFFSET_SCALE) }));
  if (!ClipperLib.Clipper.Orientation(path)) path.reverse();
  // Miter joins retain straight wall distances, including at concave corners.
  const offset = new ClipperLib.ClipperOffset(10, 0.25 * OFFSET_SCALE);
  offset.AddPath(path, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
  const tree = new ClipperLib.PolyTree();
  offset.Execute(tree, Math.round(amount * OFFSET_SCALE));
  return ClipperLib.JS.PolyTreeToExPolygons(tree).map(polygon => [polygon.outer, ...polygon.holes].map(ring =>
    ring.map(({ X, Y }) => ({ x: X / OFFSET_SCALE, y: Y / OFFSET_SCALE }))));
}

function roomGeometry(project: Project): { roomPolygon: Point[]; netPolygons: MultiPolygon; usablePolygons: MultiPolygon } {
  const roomPolygon = getRoomPolygon(project.room);
  const obstaclePolygons: MultiPolygon[] = project.room.obstacles.map(o => [[rectangle(o.x, o.y, o.width, o.height)]]);
  const netPolygons = obstaclePolygons.length
    ? fromClip(polygonClipping.difference(toClip([[roomPolygon]]), ...obstaclePolygons.map(toClip)))
    : [[roomPolygon]];
  let usablePolygons = offsetPolygon(roomPolygon, -project.material.edgeGap);
  if (obstaclePolygons.length && usablePolygons.length) {
    const expanded = obstaclePolygons.map(polygon => offsetPolygon(polygon[0][0], project.material.edgeGap));
    usablePolygons = fromClip(polygonClipping.difference(toClip(usablePolygons), ...expanded.map(toClip)));
  }
  return { roomPolygon, netPolygons, usablePolygons };
}

function effectiveAngle(layout: LayoutConfig): number {
  return layout.angle + (layout.pattern === 'diagonal' || layout.pattern === 'herringbone' ? 45 : 0);
}

function rotationContext(bounds: Bounds, angle: number) {
  const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
  const radians = angle * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const toWorld = (point: Point): Point => {
    const dx = point.x + bounds.minX - center.x, dy = point.y + bounds.minY - center.y;
    return { x: center.x + cos * dx - sin * dy, y: center.y + sin * dx + cos * dy };
  };
  const toLocal = (point: Point): Point => {
    const dx = point.x - center.x, dy = point.y - center.y;
    return { x: center.x + cos * dx + sin * dy - bounds.minX, y: center.y - sin * dx + cos * dy - bounds.minY };
  };
  return { toWorld, toLocal };
}

/** Align the first raster cell with the chosen wall(s), including the edge gap.
 * The raster keeps its angle. The support of the entire rectangle, rather than
 * just a vertex, touches each wall. This also works with sloping PDF contours.
 * Offsets remain translations along the same rotated axes as in free layouts.
 */
function layoutContext(project: Project, roomPolygon: Point[]) {
  const rotation = rotationContext(getBounds(roomPolygon), effectiveAngle(project.layout));
  const start = project.layout.start;
  if (!start) return rotation;
  const points = roomPolygon.map(rotation.toLocal);
  const index = start.index, a = points[index], b = points[(index + 1) % points.length];
  const winding = Math.sign(signedArea(points));
  const { material } = project;
  const fishbone = project.layout.pattern === 'herringbone';
  const width = fishbone ? Math.max(material.width, material.height) : material.width;
  const height = fishbone ? Math.min(material.width, material.height) : material.height;
  const inward = (a: Point, b: Point): Point => {
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    return { x: winding * (a.y - b.y) / length, y: winding * (b.x - a.x) / length };
  };
  const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
  const support = (normal: Point) => ({
    x: Math.abs(normal.x) < EPS ? width / 2 : normal.x < 0 ? width : 0,
    y: Math.abs(normal.y) < EPS ? height / 2 : normal.y < 0 ? height : 0,
  });
  const normal = inward(a, b), contact = support(normal);
  const reference = start.kind === 'side' ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : a;
  let origin = { x: reference.x + normal.x * material.edgeGap - contact.x,
    y: reference.y + normal.y * material.edgeGap - contact.y };
  if (start.kind === 'corner') {
    const previous = inward(points[(index + points.length - 1) % points.length], a);
    const determinant = previous.x * normal.y - previous.y * normal.x;
    if (Math.abs(determinant) > EPS) {
      const first = dot(previous, a) + material.edgeGap - dot(previous, support(previous));
      const second = dot(normal, a) + material.edgeGap - dot(normal, contact);
      origin = { x: (first * normal.y - previous.y * second) / determinant,
        y: (previous.x * second - first * normal.x) / determinant };
    }
  }
  // The herringbone generator insets each cell by half the grout width.
  if (fishbone) origin = { x: origin.x - material.grout / 2, y: origin.y - material.grout / 2 };
  return {
    toWorld: (point: Point) => rotation.toWorld({ x: point.x + origin.x, y: point.y + origin.y }),
    toLocal: (point: Point) => { const p = rotation.toLocal(point); return { x: p.x - origin.x, y: p.y - origin.y }; },
  };
}

function nearestOnSegment(point: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x, dy = b.y - a.y, lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)) : 0;
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/** A scanline inside the actual clipped contour avoids placing the marker in a
 * notch, obstacle or the empty space between disconnected cut fragments. */
function pieceInteriorPoint(piece: Piece): Point {
  let best = { point: piece.polygons[0][0][0], width: -1 };
  for (const polygon of piece.polygons) {
    const levels = [...new Set(polygon.flat().map(point => point.y))].sort((a, b) => a - b);
    for (let i = 1; i < levels.length; i++) {
      const y = (levels[i - 1] + levels[i]) / 2;
      const crossings = polygon.flatMap(ring => ring.flatMap((a, j) => {
        const b = ring[(j + 1) % ring.length];
        return (a.y > y) !== (b.y > y) ? [a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y)] : [];
      })).sort((a, b) => a - b);
      for (let j = 1; j < crossings.length; j += 2) {
        const width = crossings[j] - crossings[j - 1];
        if (width > best.width) best = { width, point: { x: (crossings[j] + crossings[j - 1]) / 2, y } };
      }
    }
  }
  return best.point;
}

function markStart(project: Project, roomPolygon: Point[], pieces: Piece[]): LayoutResult['start'] {
  const start = project.layout.start;
  if (!start) return undefined;
  const a = roomPolygon[start.index], b = roomPolygon[(start.index + 1) % roomPolygon.length];
  const reference = start.kind === 'corner' ? a : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const primaryId = project.layout.pattern === 'herringbone' ? 'h-0-0' : 'r-0-0';
  let nearest = pieces[0], distance = Infinity;
  for (const piece of pieces) {
    let candidateDistance = Infinity;
    for (const polygon of piece.polygons) for (const ring of polygon) for (let i = 0; i < ring.length; i++) {
      const point = nearestOnSegment(reference, ring[i], ring[(i + 1) % ring.length]);
      candidateDistance = Math.min(candidateDistance, Math.hypot(point.x - reference.x, point.y - reference.y));
    }
    if (candidateDistance < distance - EPS || (Math.abs(candidateDistance - distance) <= EPS && piece.id === primaryId)) {
      nearest = piece; distance = candidateDistance;
    }
  }
  // Element 1 in the plan, details and CSV is always the marked start element.
  pieces.splice(pieces.indexOf(nearest), 1);
  pieces.unshift(nearest);
  return { pieceId: nearest.id, reference, point: pieceInteriorPoint(nearest), label: startLabel(project.room, start) };
}

function modulo(value: number, modulus: number): number { return ((value % modulus) + modulus) % modulus; }

function rowOffset(row: number, pattern: LayoutConfig['pattern']): number {
  if (pattern === 'half') return modulo(row, 2) / 2;
  if (pattern === 'third') return modulo(row, 3) / 3;
  if (pattern === 'quarter') return modulo(row, 4) / 4;
  if (pattern === 'random') {
    // A fixed integer hash keeps negative rows, reloads and exports reproducible.
    let hash = row | 0;
    hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
    hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
    return ((hash ^ (hash >>> 16)) >>> 0) / 4_294_967_296;
  }
  return 0;
}

function* candidates(project: Project, bounds: Bounds): Generator<Candidate> {
  const { material, layout } = project;
  const { grout } = material;
  let candidateCount = 0;
  const checkCount = () => {
    if (++candidateCount > MAX_CANDIDATES) throw new Error('Das Raster ist zu dicht. Die Grenze liegt bei 60.000 Rasterelementen. Vergrößere das Materialformat oder verkleinere den Raum.');
  };
  if (layout.pattern === 'herringbone') {
    const long = Math.max(material.width, material.height), short = Math.min(material.width, material.height);
    const length = long + grout, width = short + grout;
    // The two rectangular cells tile the plane under translations (L, −L) and (S, S).
    // Insetting every cell by g/2 produces a constant perpendicular grout width g.
    const minX = bounds.minX - layout.offsetX - length;
    const maxX = bounds.maxX - layout.offsetX;
    const minY = bounds.minY - layout.offsetY - length - width;
    const maxY = bounds.maxY - layout.offsetY;
    const aMin = Math.ceil((minX - maxY) / (2 * length)) - 1;
    const aMax = Math.floor((maxX - minY) / (2 * length)) + 1;
    if (aMax - aMin > MAX_CANDIDATES) throw new Error('Das Raster ist zu dicht. Vergrößere das Materialformat oder verkleinere den Raum.');
    for (let a = aMin; a <= aMax; a++) {
      const bMin = Math.ceil(Math.max(minX - a * length, minY + a * length) / width);
      const bMax = Math.floor(Math.min(maxX - a * length, maxY + a * length) / width);
      for (let b = bMin; b <= bMax; b++) {
        const x = layout.offsetX + a * length + b * width + grout / 2;
        const y = layout.offsetY - a * length + b * width + grout / 2;
        checkCount();
        yield { id: `h-${a}-${b}`, x, y, width: long, height: short, vertical: false };
        checkCount();
        yield { id: `v-${a}-${b}`, x, y: y + width, width: short, height: long, vertical: true };
      }
    }
  } else {
    const pitchX = material.width + grout, pitchY = material.height + grout;
    const firstRow = Math.ceil((bounds.minY - layout.offsetY - material.height) / pitchY);
    const lastRow = Math.floor((bounds.maxY - layout.offsetY) / pitchY);
    const columnsPerRow = Math.ceil((bounds.width + material.width) / pitchX) + 1;
    if ((lastRow - firstRow + 1) * columnsPerRow > MAX_CANDIDATES) {
      throw new Error('Das Raster ist zu dicht. Die Grenze liegt bei 60.000 Rasterelementen. Vergrößere das Materialformat oder verkleinere den Raum.');
    }
    for (let row = firstRow; row <= lastRow; row++) {
      const shift = layout.offsetX + rowOffset(row, layout.pattern) * pitchX;
      const firstColumn = Math.ceil((bounds.minX - shift - material.width) / pitchX);
      const lastColumn = Math.floor((bounds.maxX - shift) / pitchX);
      for (let column = firstColumn; column <= lastColumn; column++) {
        checkCount();
        yield { id: `r-${row}-${column}`, x: shift + column * pitchX, y: layout.offsetY + row * pitchY,
          width: material.width, height: material.height, vertical: false };
      }
    }
  }
}

function isAxisAlignedRectangle(polygons: MultiPolygon): boolean {
  if (polygons.length !== 1 || polygons[0].length !== 1) return false;
  const points = polygons[0][0], bounds = getBounds(points);
  return points.every(point => (Math.abs(point.x - bounds.minX) < EPS || Math.abs(point.x - bounds.maxX) < EPS)
    && (Math.abs(point.y - bounds.minY) < EPS || Math.abs(point.y - bounds.maxY) < EPS))
    && Math.abs(polygonArea(points) - bounds.width * bounds.height) < AREA_EPS;
}

export function calculateLayout(project: Project): LayoutResult {
  validateProject(project);
  const { roomPolygon, netPolygons, usablePolygons } = roomGeometry(project);
  const bounds = getBounds(roomPolygon);
  const usableArea = polygonSetArea(usablePolygons);
  if (usableArea < AREA_EPS) throw new Error('Nach Randfugen und Hindernissen bleibt keine verlegbare Fläche.');
  const angle = effectiveAngle(project.layout);
  const { toWorld, toLocal } = layoutContext(project, roomPolygon);
  const localBounds = getBounds(usablePolygons.flatMap(polygon => polygon[0].map(toLocal)));
  const usableBounds = getBounds(usablePolygons.flatMap(polygon => polygon[0]));
  const axisAligned = isAxisAlignedRectangle(usablePolygons);
  const clipUsable = toClip(usablePolygons);
  const originalArea = project.material.width * project.material.height;
  const pieces: Piece[] = [];
  const warnings: string[] = [];
  let fullCount = 0, cutCount = 0, coveredArea = 0, minCutWidth = Infinity, smallCutCount = 0, splitCount = 0;
  for (const candidate of candidates(project, localBounds)) {
    const original = rectangle(candidate.x, candidate.y, candidate.width, candidate.height).map(toWorld);
    const originalBounds = getBounds(original);
    if (originalBounds.maxX < usableBounds.minX || originalBounds.minX > usableBounds.maxX
      || originalBounds.maxY < usableBounds.minY || originalBounds.minY > usableBounds.maxY) continue;
    const entireTile = axisAligned && original.every(point => point.x >= usableBounds.minX - EPS && point.x <= usableBounds.maxX + EPS
      && point.y >= usableBounds.minY - EPS && point.y <= usableBounds.maxY + EPS);
    const polygons = entireTile ? [[original]] : intersectTile(clipUsable, original);
    const area = polygonSetArea(polygons);
    if (area < AREA_EPS) continue;
    if (pieces.length >= MAX_PIECES) throw new Error('Der Plan benötigt mehr als 12.000 Stücke. Vergrößere das Materialformat oder verkleinere den Raum.');
    const cut = originalArea - area > Math.max(AREA_EPS, originalArea * 1e-9);
    const componentBounds = polygons.map(polygon => getBounds(polygon[0].map(toLocal)));
    const pieceBounds = getBounds(polygons.flatMap(polygon => polygon[0].map(toLocal)));
    const minDimension = Math.min(...componentBounds.map(box => Math.min(box.width, box.height)));
    const piece: Piece = {
      id: candidate.id, original, polygons, area: Math.min(area, originalArea), cut,
      width: candidate.vertical ? pieceBounds.height : pieceBounds.width,
      height: candidate.vertical ? pieceBounds.width : pieceBounds.height,
      minDimension, angle: angle + (candidate.vertical ? 90 : 0),
    };
    pieces.push(piece);
    coveredArea += piece.area;
    if (cut) {
      cutCount++;
      minCutWidth = Math.min(minCutWidth, minDimension);
      if (minDimension + EPS < project.material.minCut) smallCutCount++;
      if (polygons.length > 1) splitCount++;
    } else fullCount++;
  }
  if (!pieces.length) throw new Error('Dieses Raster trifft keine verlegbare Fläche. Ändere Fugenbreite oder Versatz.');
  if (smallCutCount) warnings.push(`${smallCutCount} Zuschnitt${smallCutCount === 1 ? '' : 'e'} mit einem Hüllmaß unter ${project.material.minCut.toLocaleString('de-DE')} mm. Prüfe die Schnittkontur.`);
  if (splitCount) warnings.push(`${splitCount} Ausgangsstück${splitCount === 1 ? '' : 'e'} ${splitCount === 1 ? 'ergibt' : 'ergeben'} mehrere getrennte Teilstücke.`);
  if (project.layout.pattern === 'herringbone' && Math.abs(project.material.width - project.material.height) < EPS) {
    warnings.push('Quadratische Formate ergeben im Fischgrät ein quadratisches Raster.');
  }
  const neededPieces = fullCount + cutCount;
  const purchasedArea = neededPieces * originalArea;
  const wasteArea = Math.max(0, purchasedArea - coveredArea);
  const recommendedPieces = Math.ceil(neededPieces * (1 + project.material.reserve / 100) - EPS);
  const start = markStart(project, roomPolygon, pieces);
  return {
    pieces, roomPolygon, usablePolygons, bounds,
    roomArea: polygonSetArea(netPolygons), usableArea, coveredArea, fullCount, cutCount,
    wasteArea, wastePercent: purchasedArea ? wasteArea / purchasedArea * 100 : 0,
    neededPieces, recommendedPieces, packs: Math.ceil(recommendedPieces / project.material.piecesPerPack),
    minCutWidth: Number.isFinite(minCutWidth) ? minCutWidth : 0, warnings, ...(start ? { start } : {}),
  };
}

export function getCenteredLayout(project: Project): LayoutConfig {
  validateProject(project);
  const { roomPolygon, usablePolygons } = roomGeometry(project);
  if (!usablePolygons.length) throw new Error('Nach Randfugen und Hindernissen bleibt keine verlegbare Fläche.');
  const { toLocal } = rotationContext(getBounds(roomPolygon), effectiveAngle(project.layout));
  const bounds = getBounds(usablePolygons.flatMap(polygon => polygon[0].map(toLocal)));
  const { material } = project;
  const { start: _start, ...layout } = project.layout;
  if (layout.pattern === 'herringbone') {
    return { ...layout,
      offsetX: (bounds.minX + bounds.maxX - Math.max(material.width, material.height) - material.grout) / 2,
      offsetY: (bounds.minY + bounds.maxY - Math.min(material.width, material.height) - material.grout) / 2,
    };
  }
  const centered = (min: number, span: number, size: number) => {
    const count = Math.max(1, Math.ceil((span + material.grout) / (size + material.grout) - EPS));
    return min + (span - (count * size + (count - 1) * material.grout)) / 2;
  };
  return { ...layout,
    offsetX: centered(bounds.minX, bounds.width, material.width),
    offsetY: centered(bounds.minY, bounds.height, material.height),
  };
}

export function multiPolygonPath(polygons: MultiPolygon): string {
  const fmt = (number: number) => Number(number.toFixed(4)).toString();
  return polygons.map(polygon => polygon.map(ring => ring.length
    ? `M${ring.map(point => `${fmt(point.x)},${fmt(point.y)}`).join('L')}Z` : '').join('')).join('');
}
