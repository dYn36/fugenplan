import { describe, expect, it } from 'vitest';
import type { FloorPlanDocument, Workspace, WorkspaceRoom } from '../src/floorplan-types';
import { dragPlacement, getFloorLayout, roomLabelPoint } from '../src/lib/floor-layout';
import { DEFAULT_PROJECT } from '../src/lib/project';
import { addPdfRoom } from '../src/lib/workspace';

const document: FloorPlanDocument = {
  id: 'a'.repeat(64), name: 'Etagen.pdf', activePage: 1, pageCount: 2,
  pages: [
    { number: 1, width: 600, height: 400, rotation: 0, calibration: { start: { x: 80, y: 80 }, end: { x: 320, y: 80 }, lengthMm: 4800 } },
    { number: 2, width: 400, height: 600, rotation: 90, calibration: { start: { x: 50, y: 50 }, end: { x: 150, y: 50 }, lengthMm: 2000 } },
  ],
};
function empty(): Workspace { return { version: 2, rooms: [], activeRoomId: '', floorPlan: structuredClone(document) }; }
function manual(id: string, x?: number, y?: number): WorkspaceRoom {
  return { id, project: structuredClone(DEFAULT_PROJECT), ...(x !== undefined && y !== undefined ? { placement: { x, y } } : {}) };
}
function twoPdfRooms(): Workspace {
  const living = [{ x: 80, y: 80 }, { x: 320, y: 80 }, { x: 320, y: 260 }, { x: 80, y: 260 }];
  const dining = [{ x: 326, y: 80 }, { x: 476, y: 80 }, { x: 476, y: 260 }, { x: 326, y: 260 }];
  return addPdfRoom(addPdfRoom(empty(), 'Wohnen', living), 'Essen', dining);
}

describe('Gemeinsame Etagenkoordinaten', () => {
  it('übersetzt eine direkte Verschiebung mit dem aktuellen Bildschirmmaßstab in Millimeter', () => {
    const origin = { x: 1200, y: 7000 };
    expect(dragPlacement(origin, { x: 80, y: -40 }, 12.25)).toEqual({ x: 2180, y: 6510 });
    expect(origin).toEqual({ x: 1200, y: 7000 });
    expect(dragPlacement(origin, { x: 1, y: 1 }, .12345)).toEqual({ x: 1200.1, y: 7000.1 });
  });

  it('begrenzt die Verschiebung und weist einen ungültigen Bildschirmmaßstab zurück', () => {
    expect(dragPlacement({ x: 999999, y: -999999 }, { x: 100, y: -100 }, 5)).toEqual({ x: 1000000, y: -1000000 });
    expect(() => dragPlacement({ x: 0, y: 0 }, { x: 20, y: 20 }, 0)).toThrow('Maßstab');
    expect(() => dragPlacement({ x: 0, y: 0 }, { x: Number.NaN, y: 20 }, 1)).toThrow('Koordinaten');
  });

  it('zeigt zwei PDF-Räume mit ihren echten Abständen und Größen in einem Millimetermaßstab', () => {
    const result = getFloorLayout(twoPdfRooms());
    expect(result.placed).toHaveLength(2);
    const [living, dining] = result.placed;
    expect(living.origin).toEqual({ x: 1600, y: 1600 });
    expect(living.bounds).toEqual({ minX: 1600, minY: 1600, maxX: 6400, maxY: 5200, width: 4800, height: 3600 });
    expect(dining.origin).toEqual({ x: 6520, y: 1600 });
    expect(dining.bounds.minX - living.bounds.maxX).toBe(120);
    expect(dining.bounds.width).toBe(3000);
    expect(result.bounds).toEqual({ minX: 1600, minY: 1600, maxX: 9520, maxY: 5200, width: 7920, height: 3600 });
    expect(result.template).toEqual({ documentId: document.id, page: 1, scale: 20, width: 12000, height: 8000 });
  });

  it('hält eine PDF-Zuordnung auch dann fest, wenn zusätzlich eine manuelle Position gespeichert ist', () => {
    const workspace = twoPdfRooms();
    workspace.rooms[0].placement = { x: 999, y: -999 };
    expect(getFloorLayout(workspace).placed[0].origin).toEqual({ x: 1600, y: 1600 });
    expect(getFloorLayout(workspace).placed[0].kind).toBe('pdf');
  });

  it('überlagert Räume einer anderen Seite nicht mit dem aktiven Etagenplan', () => {
    const workspace = twoPdfRooms();
    workspace.floorPlan!.activePage = 2;
    const result = getFloorLayout(workspace);
    expect(result.placed).toEqual([]);
    expect(result.bounds).toBeNull();
    expect(result.unplaced.map(room => room.reason)).toEqual(['other-page', 'other-page']);
    expect(result.template).toMatchObject({ page: 2, width: 8000, height: 12000 });
  });

  it('stellt fremde PDF-Referenzen trotz placement nicht als maßhaltigen Grundriss dar', () => {
    const workspace = twoPdfRooms();
    workspace.rooms[0].source!.documentId = 'b'.repeat(64);
    workspace.rooms[0].placement = { x: 0, y: 0 };
    const result = getFloorLayout(workspace);
    expect(result.placed).toHaveLength(1);
    expect(result.unplaced[0]).toMatchObject({ room: { project: { name: 'Wohnen' } }, reason: 'reference-missing' });
  });

  it('zeigt ohne gültigen Maßstab keine scheinbar maßhaltige PDF-Zuordnung', () => {
    const workspace = twoPdfRooms();
    workspace.floorPlan!.pages[0].calibration = null;
    const result = getFloorLayout(workspace);
    expect(result.placed).toHaveLength(0);
    expect(result.template).toBeNull();
    expect(result.unplaced).toHaveLength(2);
  });

  it('ordnet manuelle Räume nur mit einer expliziten Position an und ändert deren Kontur nicht', () => {
    const placed = manual('gesetzt', -2000, 1000), unplaced = manual('offen');
    const before = structuredClone(placed);
    const workspace: Workspace = { version: 2, activeRoomId: placed.id, rooms: [placed, unplaced] };
    const result = getFloorLayout(workspace);
    expect(result.placed[0].origin).toEqual({ x: -2000, y: 1000 });
    expect(result.placed[0].bounds).toMatchObject({ minX: -2000, minY: 1000, width: DEFAULT_PROJECT.room.width, height: DEFAULT_PROJECT.room.height });
    expect(result.unplaced[0]).toEqual({ room: unplaced, reason: 'position-missing' });
    expect(placed).toEqual(before);
  });

  it('erhält lokale Konturversätze statt den Raum eigenmächtig an seine Bounding Box zu versetzen', () => {
    const room = manual('versetzt', 3000, 4000);
    room.project.room = { ...room.project.room, shape: 'custom', points: [{ x: -500, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 1100 }, { x: -500, y: 1100 }] };
    const result = getFloorLayout({ version: 2, activeRoomId: room.id, rooms: [room] });
    expect(result.placed[0].polygon[0]).toEqual({ x: 2500, y: 4100 });
    expect(result.bounds).toMatchObject({ minX: 2500, minY: 4100, width: 1000, height: 1000 });
  });

  it('behandelt eine leere Etage ohne erfundene Raumkontur', () => {
    expect(getFloorLayout({ version: 2, rooms: [], activeRoomId: '' })).toEqual({ placed: [], unplaced: [], bounds: null, template: null });
  });

  it('platziert die Raumbezeichnung innerhalb eines L-Raums statt in dessen Aussparung', () => {
    const polygon = [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 1000 }, { x: 1000, y: 1000 }, { x: 1000, y: 5000 }, { x: 0, y: 5000 }];
    const point = roomLabelPoint(polygon);
    expect(point.x < 1000 || point.y < 1000).toBe(true);
    expect(point.x).toBeGreaterThan(0);
    expect(point.y).toBeGreaterThan(0);
  });
});
