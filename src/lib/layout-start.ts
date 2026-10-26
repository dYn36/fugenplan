import type { LayoutStart, RoomConfig } from '../types';

export function startLabel(room: RoomConfig, start: LayoutStart): string {
  if (room.shape === 'rectangle') {
    return (start.kind === 'corner'
      ? ['Oben links', 'Oben rechts', 'Unten rechts', 'Unten links']
      : ['Obere Wand · Mitte', 'Rechte Wand · Mitte', 'Untere Wand · Mitte', 'Linke Wand · Mitte'])[start.index];
  }
  return start.kind === 'corner' ? `Ecke ${start.index + 1}` : `Wand ${start.index + 1} · Mitte`;
}

export function roomVertexCount(room: RoomConfig): number {
  if (room.shape === 'rectangle') return 4;
  if (room.shape === 'l-shape') return 6;
  const first = room.points[0], last = room.points[room.points.length - 1];
  const closed = room.points.length > 1 && first && last
    && Math.abs(first.x - last.x) < 1e-7 && Math.abs(first.y - last.y) < 1e-7;
  return room.points.length - (closed ? 1 : 0);
}
