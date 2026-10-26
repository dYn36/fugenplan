import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FloorPlanDocument, Workspace } from '../src/floorplan-types';
import { DEFAULT_PROJECT, RECOVERED_START_NOTICE, STORAGE_KEY } from '../src/lib/project';
import { addEmptyRoom, addPdfRoom, calibratePage, createWorkspace, currentRoom, loadWorkspace, parseWorkspace, removeRoom, replaceRoomProject, withPdf, WORKSPACE_KEY } from '../src/lib/workspace';
import { decodePdf, encodePdf, writeProjectFile } from '../src/lib/workspace-file';
import { calculateLayout, getBounds } from '../src/lib/geometry';

const calibration = { start: { x: 60, y: 340 }, end: { x: 300, y: 340 }, lengthMm: 4800 };
const document: FloorPlanDocument = {
  id: 'a'.repeat(64), name: 'Grundriss.pdf', pageCount: 2, activePage: 1,
  pages: [
    { number: 1, width: 600, height: 400, rotation: 0, calibration },
    { number: 2, width: 400, height: 600, rotation: 90, calibration: null },
  ],
};
const contour = [{ x: 60, y: 70 }, { x: 300, y: 70 }, { x: 300, y: 330 }, { x: 60, y: 330 }];
function fixture(): Workspace {
  return addPdfRoom(withPdf(createWorkspace(), structuredClone(document)), 'Küche', contour);
}

afterEach(() => vi.unstubAllGlobals());

describe('Räume aus PDF', () => {
  it('speichert die Startposition je PDF-Raum und hält sie bei einer neuen Kalibrierung an derselben Ecke', () => {
    let w = fixture();
    const first = currentRoom(w);
    w = replaceRoomProject(w, {...first.project,layout:{...first.project.layout,start:{kind:'corner',index:2}}});
    w = addPdfRoom(w,'Bad',contour.map(p=>({x:p.x+280,y:p.y})));
    const second = currentRoom(w);
    w = replaceRoomProject(w,{...second.project,layout:{...second.project.layout,start:{kind:'side',index:0}}});
    expect(parseWorkspace(w).rooms.find(room=>room.id===first.id)!.project.layout.start).toEqual({kind:'corner',index:2});
    expect(parseWorkspace(w).rooms.find(room=>room.id===second.id)!.project.layout.start).toEqual({kind:'side',index:0});
    const file = JSON.parse(writeProjectFile(w,new Uint8Array([1,2,3])));
    expect(file.workspace.rooms.find((room:{id:string})=>room.id===first.id).project.layout.start).toEqual({kind:'corner',index:2});
    w = calibratePage(w,{...calibration,lengthMm:2400});
    const changed = w.rooms.find(room=>room.id===first.id)!.project;
    expect(changed.layout.start).toEqual({kind:'corner',index:2});
    const result = calculateLayout(changed);
    expect(getBounds(result.pieces[0].polygons[0][0])).toMatchObject({maxX:2395,maxY:2595,width:600,height:300});
    expect(result.start!.reference).toEqual({x:2400,y:2600});
  });
  it('rechnet absolute PDF-Punkte in lokale Millimeter um und behält den bisherigen Raum', () => {
    const w = fixture(), room = currentRoom(w);
    expect(w.rooms).toHaveLength(2);
    expect(w.rooms[0].project).toEqual(DEFAULT_PROJECT);
    expect(room.project.room.points).toEqual([{ x: 0, y: 0 }, { x: 4800, y: 0 }, { x: 4800, y: 5200 }, { x: 0, y: 5200 }]);
    expect(room.source?.origin).toEqual({ x: 60, y: 70 });
    expect(parseWorkspace(w)).toEqual(w);
  });

  it('hält Belag und Verlegung zweier Räume getrennt', () => {
    let w = fixture();
    const first = currentRoom(w);
    w = replaceRoomProject(w, { ...first.project, material: { ...first.project.material, width: 1200, kind: 'wood' } });
    w = addPdfRoom(w, 'Bad', contour.map(p => ({ x: p.x + 280, y: p.y })));
    expect(currentRoom(w).project.material.kind).toBe('tile');
    expect(w.rooms.find(r => r.id === first.id)?.project.material.width).toBe(1200);
  });

  it('kalibriert nur Räume der aktuellen Seite und erhält physische Produktmaße', () => {
    let w = fixture();
    const first = currentRoom(w);
    w = replaceRoomProject(w, { ...first.project, room: { ...first.project.room, obstacles: [{ id: 'column', x: 1000, y: 800, width: 400, height: 600 }] } });
    w = { ...w, floorPlan: { ...w.floorPlan!, activePage: 2 } };
    w = calibratePage(w, { start: { x: 30, y: 100 }, end: { x: 30, y: 500 }, lengthMm: 2000 });
    w = addPdfRoom(w, 'Obergeschoss', [{ x: 80, y: 60 }, { x: 320, y: 60 }, { x: 320, y: 460 }, { x: 80, y: 460 }]);
    const second = structuredClone(currentRoom(w));
    w = { ...w, floorPlan: { ...w.floorPlan!, activePage: 1 } };
    w = calibratePage(w, { ...calibration, lengthMm: 2400 });
    const rescaled = w.rooms.find(r => r.id === first.id)!;
    expect(rescaled.project.room.points[2]).toEqual({ x: 2400, y: 2600 });
    expect(rescaled.project.room.obstacles[0]).toMatchObject({ x: 500, y: 400, width: 200, height: 300 });
    expect(rescaled.project.material).toEqual(first.project.material);
    expect(w.rooms.find(r => r.id === second.id)).toEqual(second);
    expect(parseWorkspace(w).rooms[1].project.room.points[2]).toEqual({ x: 2400, y: 2600 });
  });

  it('überträgt manuelle Raumänderungen zurück in die PDF-Kontur', () => {
    let w = fixture();
    const project = currentRoom(w).project;
    const points = project.room.points.map(p => ({ x: p.x + 100, y: p.y + 200 }));
    w = replaceRoomProject(w, { ...project, room: { ...project.room, points } });
    expect(currentRoom(w).source?.points[0]).toEqual({ x: 65, y: 80 });
    expect(currentRoom(w).source?.origin).toEqual({ x: 60, y: 70 });
    expect(parseWorkspace(w)).toEqual(w);
    w = calibratePage(w, { ...calibration, lengthMm: 2400 });
    expect(currentRoom(w).project.room.points[0]).toEqual({ x: 50, y: 100 });
  });

  it('erhält einen noch ungültigen Eckpunktentwurf beim erneuten Laden des Browsers', () => {
    let w = fixture();
    const project = currentRoom(w).project;
    w = replaceRoomProject(w, { ...project, room: { ...project.room, points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 0, y: 0 }] } });
    expect(parseWorkspace(w)).toEqual(w);
    expect(() => writeProjectFile(w, new Uint8Array([1]))).toThrow('Küche');
  });

  it('erhält beim PDF-Wechsel die Raumpläne und löst die alte Zuordnung', () => {
    const before = fixture();
    const restored = withPdf(before, structuredClone(document));
    expect(restored).toBe(before);
    const next = withPdf(before, { ...structuredClone(document), id: 'b'.repeat(64) });
    expect(next.rooms.map(r => r.project)).toEqual(before.rooms.map(r => r.project));
    expect(next.rooms.every(r => r.source === undefined)).toBe(true);
    expect(parseWorkspace(next)).toEqual(next);
  });

  it('begrenzt Räume und erhält beim Löschen eine gültige aktive Auswahl', () => {
    let w = fixture();
    w = removeRoom(w, w.activeRoomId);
    expect(w.rooms).toHaveLength(1);
    expect(currentRoom(w)).toBe(w.rooms[0]);
    expect(() => removeRoom(w, w.activeRoomId)).toThrow('mindestens einen Raum');
    while (w.rooms.length < 50) w = addEmptyRoom(w);
    expect(() => addEmptyRoom(w)).toThrow('höchstens 50');
    expect(() => addPdfRoom(w, 'Mehr', contour)).toThrow('höchstens 50');
  });

  it('weist fehlenden Maßstab, übergroße Räume und gekreuzte Konturen zurück', () => {
    const w = fixture();
    const unscaled = { ...w, floorPlan: { ...w.floorPlan!, activePage: 2 } };
    expect(() => addPdfRoom(unscaled, 'Raum', contour)).toThrow('Maßstab');
    expect(() => addPdfRoom(w, 'Raum', [contour[0], contour[2], contour[1], contour[3]])).toThrow();
    expect(() => calibratePage(w, { ...calibration, lengthMm: 100000 })).toThrow();
    expect(() => calibratePage(w, { ...calibration, end: { x: 601, y: 300 } })).toThrow('PDF-Seite');
    expect(w.floorPlan?.pages[0].calibration).toEqual(calibration);
  });
});

describe('Projektformat und Speicherung', () => {
  it.each([
    ['doppelte Kennung', (w: Workspace) => { w.rooms[1].id = w.rooms[0].id; }],
    ['fehlender aktiver Raum', (w: Workspace) => { w.activeRoomId = 'missing'; }],
    ['fremde PDF', (w: Workspace) => { w.rooms[1].source!.documentId = 'b'.repeat(64); }],
    ['falsche Raummaße', (w: Workspace) => { w.rooms[1].source!.points[0].x += 1; }],
    ['fehlender Maßstab', (w: Workspace) => { w.floorPlan!.pages[0].calibration = null; }],
    ['unvollständige Seiten', (w: Workspace) => { w.floorPlan!.pages.pop(); }],
    ['NaN', (w: Workspace) => { w.floorPlan!.pages[0].width = NaN; }],
  ])('weist %s zurück', (_, mutate) => {
    const w = fixture(); mutate(w);
    expect(() => parseWorkspace(w)).toThrow();
  });

  it('migriert den bisherigen Einzelraum und bevorzugt danach das ganze Projekt', () => {
    const values = new Map<string, string>([[STORAGE_KEY, JSON.stringify({ ...DEFAULT_PROJECT, name: 'Alt' })]]);
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null });
    expect(currentRoom(loadWorkspace().workspace).project.name).toBe('Alt');
    const w = fixture(); values.set(WORKSPACE_KEY, JSON.stringify(w));
    values.set(STORAGE_KEY, '{defekt');
    expect(loadWorkspace()).toEqual({ workspace: w, error: null });
    values.set(WORKSPACE_KEY, '{defekt');
    expect(loadWorkspace().error).toContain('nicht geladen');
    expect(values.get(WORKSPACE_KEY)).toBe('{defekt');
  });

  it.each(['corner', 'side'] as const)('rettet alle Räume und die PDF bei veralteter Startposition %s', kind => {
    const w = fixture();
    const active = currentRoom(w);
    active.project.room.points[3] = { ...active.project.room.points[0] };
    active.project.layout = { ...active.project.layout, start: { kind, index: 3 }, offsetX: 120, offsetY: -70 };
    active.source!.points.pop();
    w.activeRoomId = w.rooms[0].id;
    const saved = JSON.stringify(w);
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === WORKSPACE_KEY ? saved : null });

    const loaded = loadWorkspace();
    const expected = structuredClone(w);
    expected.rooms[1].project.layout = { pattern: 'third', angle: 0, offsetX: 0, offsetY: 0 };
    expect(loaded.error).toBeNull();
    expect(loaded.warning).toBe(RECOVERED_START_NOTICE);
    expect(loaded.workspace).toEqual(expected);
    expect(calculateLayout(loaded.workspace.rooms[1].project).roomPolygon).toHaveLength(3);
    expect(parseWorkspace(loaded.workspace)).toEqual(expected);
    expect(JSON.parse(writeProjectFile(loaded.workspace, new Uint8Array([1]))).workspace).toEqual(expected);
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(saved);
    expect(() => parseWorkspace(w)).toThrow('Start');
  });

  it('erhält nach der Start-Reparatur die übrige Validierung und die ursprünglichen Daten', () => {
    const w = fixture();
    currentRoom(w).project.layout.start = { kind: 'corner', index: 4 };
    currentRoom(w).source!.points[0].x += 1;
    const saved = JSON.stringify(w);
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === WORKSPACE_KEY ? saved : null });
    expect(loadWorkspace().error).toContain('nicht geladen');
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(saved);
  });

  it('migriert einen alten Einzelraum mit reparierter Startposition samt Hinweis', () => {
    const project = structuredClone(DEFAULT_PROJECT);
    project.name = 'Alter Raum'; project.room.shape = 'custom';
    project.room.points[3] = { ...project.room.points[0] };
    project.layout.start = { kind: 'side', index: 3 };
    const saved = JSON.stringify(project);
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === STORAGE_KEY ? saved : null });
    const loaded = loadWorkspace();
    expect(loaded.error).toBeNull();
    expect(loaded.warning).toBe(RECOVERED_START_NOTICE);
    expect(currentRoom(loaded.workspace).project.name).toBe('Alter Raum');
    expect(currentRoom(loaded.workspace).project.layout.start).toBeUndefined();
    expect(parseWorkspace(loaded.workspace)).toEqual(loaded.workspace);
  });

  it('exportiert Einzelräume kompatibel und mehrere Räume vollständig', () => {
    let w = createWorkspace();
    expect(JSON.parse(writeProjectFile(w, null))).toEqual(DEFAULT_PROJECT);
    w = addEmptyRoom(w);
    const file = JSON.parse(writeProjectFile(w, null));
    expect(file.format).toBe('fugenplan');
    expect(parseWorkspace(file.workspace)).toEqual(w);
  });

  it('verhindert den Export einer ungültigen Kontur in einem inaktiven Raum', () => {
    const w = addEmptyRoom(createWorkspace());
    w.rooms[0].project.room.shape = 'custom';
    w.rooms[0].project.room.points = [{ x: 0, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }, { x: 1000, y: 0 }];
    expect(() => writeProjectFile(w, null)).toThrow('Wohnzimmer');
  });

  it('sichert PDF-Bytes verlustfrei und verhindert unvollständige Sicherungen', () => {
    const bytes = Uint8Array.from({ length: 20000 }, (_, i) => i % 256);
    expect(decodePdf(encodePdf(bytes))).toEqual(bytes);
    const w = fixture();
    expect(() => writeProjectFile(w, null)).toThrow('PDF fehlt');
    const file = JSON.parse(writeProjectFile(w, bytes));
    expect(decodePdf(file.pdfBase64)).toEqual(bytes);
    expect(parseWorkspace(file.workspace)).toEqual(w);
    for (const bad of [null, '', 'abcd!', 'abc', '===a', '=aaa']) expect(() => decodePdf(bad)).toThrow();
  });
});
