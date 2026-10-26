import type { Calibration, RoomSource } from '../floorplan-types';
import type { Point, Project } from '../types';
import { getBounds, validateRoom } from './geometry';
import { parseProject } from './project';

function validPoint(point: Point): boolean {
  return !!point && Number.isFinite(point.x) && Number.isFinite(point.y);
}

function validatePoints(points: Point[]): void {
  if (!Array.isArray(points) || !points.length || points.some(point => !validPoint(point))) {
    throw new Error('Die Kontur benötigt gültige Punkte mit endlichen Koordinaten.');
  }
}

/** Millimetres per unit of the PDF page's natural, rotated viewport. */
export function calibrationScale(calibration: Calibration): number {
  if (!calibration || !validPoint(calibration.start) || !validPoint(calibration.end)) {
    throw new Error('Die Kalibrierung benötigt zwei gültige Punkte.');
  }
  if (!Number.isFinite(calibration.lengthMm) || calibration.lengthMm <= 0) {
    throw new Error('Die bekannte Wandlänge muss größer als 0 mm sein.');
  }
  const distance = Math.hypot(calibration.end.x - calibration.start.x, calibration.end.y - calibration.start.y);
  if (!Number.isFinite(distance) || distance <= 0) throw new Error('Die Kalibrierpunkte müssen voneinander entfernt liegen.');
  const scale = calibration.lengthMm / distance;
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('Aus diesen Werten ergibt sich kein gültiger Maßstab.');
  return scale;
}

export function sourceToRoom(points: Point[], calibration: Calibration, origin?: Point): { points: Point[]; origin: Point } {
  validatePoints(points);
  const scale = calibrationScale(calibration);
  const bounds = getBounds(points);
  const anchor = origin ?? { x: bounds.minX, y: bounds.minY };
  if (!validPoint(anchor)) throw new Error('Der Bezugspunkt der Raumkontur ist ungültig.');
  const converted = points.map(point => ({ x: (point.x - anchor.x) * scale, y: (point.y - anchor.y) * scale }));
  validatePoints(converted);
  return { points: converted, origin: { ...anchor } };
}

export function roomToSource(points: Point[], calibration: Calibration, origin: Point): Point[] {
  validatePoints(points);
  const scale = calibrationScale(calibration);
  if (!validPoint(origin)) throw new Error('Der Bezugspunkt der Raumkontur ist ungültig.');
  const converted = points.map(point => ({ x: point.x / scale + origin.x, y: point.y / scale + origin.y }));
  validatePoints(converted);
  return converted;
}

export function recalibrateProject(project: Project, source: RoomSource, previous: Calibration, next: Calibration): Project {
  const ratio = calibrationScale(next) / calibrationScale(previous);
  if (!Number.isFinite(ratio) || ratio <= 0) throw new Error('Der neue Maßstab ist ungültig.');
  const { points } = sourceToRoom(source.points, next, source.origin);
  const bounds = getBounds(points);
  const updated: Project = {
    ...project,
    room: {
      ...project.room,
      shape: 'custom', points, width: bounds.width, height: bounds.height,
      obstacles: project.room.obstacles.map(obstacle => ({ ...obstacle,
        x: obstacle.x * ratio, y: obstacle.y * ratio,
        width: obstacle.width * ratio, height: obstacle.height * ratio,
      })),
    },
  };
  const errors = validateRoom(updated.room);
  if (errors.length) throw new Error(`Der neue Maßstab ergibt keine gültige Raumkontur. ${errors.join(' ')}`);
  // Enforce the same limits as saving/importing. Never create a plan that cannot be reopened.
  parseProject(updated);
  return updated;
}
