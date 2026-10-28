import type { Workspace, WorkspaceRoom } from '../floorplan-types';
import type { Bounds, Point } from '../types';
import { calibrationScale } from './calibration';
import { getBounds, getRoomPolygon } from './geometry';
import { MAX_PLACEMENT_MM } from './workspace';

export type PlacedRoom = {
  room: WorkspaceRoom;
  origin: Point;
  polygon: Point[];
  bounds: Bounds;
  kind: 'pdf' | 'manual';
};
export type UnplacedRoom = { room: WorkspaceRoom; reason: 'position-missing' | 'other-page' | 'reference-missing' };
export type FloorLayout = {
  placed: PlacedRoom[];
  unplaced: UnplacedRoom[];
  bounds: Bounds | null;
  template: { documentId: string; page: number; scale: number; width: number; height: number } | null;
};

/** Convert a pointer displacement to a bounded room translation, retaining 0.1 mm precision. */
export function dragPlacement(origin: Point, pixels: Point, millimetresPerPixel: number): Point {
  if (![origin.x, origin.y, pixels.x, pixels.y, millimetresPerPixel].every(Number.isFinite) || millimetresPerPixel <= 0) {
    throw new Error('Die Verschiebung benötigt einen gültigen Maßstab und gültige Koordinaten.');
  }
  const bounded = (value: number) => Math.max(-MAX_PLACEMENT_MM, Math.min(MAX_PLACEMENT_MM, Math.round(value * 10) / 10));
  return { x: bounded(origin.x + pixels.x * millimetresPerPixel), y: bounded(origin.y + pixels.y * millimetresPerPixel) };
}

/** Use one millimetre coordinate system for both the PDF and every room on this floor. */
export function getFloorLayout(workspace: Workspace): FloorLayout {
  const document = workspace.floorPlan;
  const page = document?.pages.find(item => item.number === document.activePage);
  let scale: number | null = null;
  if (page?.calibration) {
    try { scale = calibrationScale(page.calibration); } catch { /* Invalid references remain visibly unplaced. */ }
  }
  const template = document && page && scale !== null ? {
    documentId: document.id, page: page.number, scale, width: page.width * scale, height: page.height * scale,
  } : null;
  const placed: PlacedRoom[] = [];
  const unplaced: UnplacedRoom[] = [];
  for (const room of workspace.rooms) {
    let origin: Point;
    let kind: PlacedRoom['kind'];
    if (room.source) {
      if (room.source.documentId !== document?.id || scale === null) {
        unplaced.push({ room, reason: 'reference-missing' });
        continue;
      }
      if (room.source.page !== page?.number) {
        unplaced.push({ room, reason: 'other-page' });
        continue;
      }
      origin = { x: room.source.origin.x * scale, y: room.source.origin.y * scale };
      kind = 'pdf';
    } else if (room.placement && Number.isFinite(room.placement.x) && Number.isFinite(room.placement.y)) {
      origin = { ...room.placement };
      kind = 'manual';
    } else {
      unplaced.push({ room, reason: 'position-missing' });
      continue;
    }
    const polygon = getRoomPolygon(room.project.room).map(point => ({ x: point.x + origin.x, y: point.y + origin.y }));
    placed.push({ room, origin, polygon, bounds: getBounds(polygon), kind });
  }
  return { placed, unplaced, bounds: placed.length ? getBounds(placed.flatMap(room => room.polygon)) : null, template };
}

function inside(point: Point, polygon: Point[]): boolean {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}

/** Keep the room label inside concave contours rather than in an L-shaped room's notch. */
export function roomLabelPoint(polygon: Point[]): Point {
  const b = getBounds(polygon);
  const center = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  if (inside(center, polygon)) return center;
  const candidates: Point[] = [];
  for (let row = 1; row < 10; row++) for (let column = 1; column < 10; column++) {
    const point = { x: b.minX + b.width * column / 10, y: b.minY + b.height * row / 10 };
    if (inside(point, polygon)) candidates.push(point);
  }
  return candidates.sort((a, c) => Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(c.x - center.x, c.y - center.y))[0] ?? polygon[0] ?? center;
}
