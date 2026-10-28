import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FloorPlanDocument, ProjectLibrary, Workspace } from '../src/floorplan-types';
import { addBuilding, addFloor, createLibrary, currentBuilding, currentFloor, insertBuilding, LIBRARY_KEY, loadLibrary, MAX_BUILDINGS, MAX_FLOORS, moveRoomToFloor, parseBuilding, parseLibrary, removeBuilding, removeFloor, renameBuilding, renameFloor, replaceCurrentWorkspace, selectBuilding, selectFloor } from '../src/lib/library';
import { readBuildingFile, writeBuildingFile } from '../src/lib/library-file';
import { addEmptyRoom, addPdfRoom, createEmptyWorkspace, createWorkspace, parseWorkspace, removeRoom, replaceRoomProject, withPdf, WORKSPACE_KEY } from '../src/lib/workspace';
import { DEFAULT_PROJECT, STORAGE_KEY } from '../src/lib/project';

// The wrapper tests hash/metadata matching; PDF rendering itself is tested through the browser.
vi.mock('../src/lib/pdf', () => ({
  MAX_PDF_BYTES: 20 * 1024 * 1024,
  preparePdf: vi.fn(async (bytes: Uint8Array, name: string) => {
    const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
    const id = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    return { id, name, pageCount: 2, activePage: 1, pages: [1, 2].map(number => ({ number, width: 600, height: 400, rotation: 0, calibration: null })) };
  }),
}));

const calibration = { start: { x: 60, y: 340 }, end: { x: 300, y: 340 }, lengthMm: 4800 };
const document: FloorPlanDocument = {
  id: 'a'.repeat(64), name: 'Grundriss.pdf', pageCount: 2, activePage: 1,
  pages: [1, 2].map(number => ({ number, width: 600, height: 400, rotation: 0, calibration: structuredClone(calibration) })),
};
const contour = [{ x: 60, y: 70 }, { x: 300, y: 70 }, { x: 300, y: 330 }, { x: 60, y: 330 }];
function legacy(): Workspace {
  let workspace = addPdfRoom(withPdf(createWorkspace(), structuredClone(document)), 'Küche', contour);
  workspace = { ...workspace, floorPlan: { ...workspace.floorPlan!, activePage: 2 } };
  return addPdfRoom(workspace, 'Schlafzimmer', contour);
}
function populated(): ProjectLibrary {
  return createLibrary(legacy());
}
async function withRealHash() {
  const bytes = new TextEncoder().encode('%PDF-1.7\nsynthetischer Testinhalt');
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
  const id = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const library = populated(), building = library.projects[0];
  for (const floor of building.floors) {
    floor.workspace.floorPlan!.id = id;
    for (const room of floor.workspace.rooms) if (room.source) room.source.documentId = id;
  }
  return { building, bytes, id };
}
afterEach(() => vi.unstubAllGlobals());

describe('Projektbibliothek und Migration', () => {
  it('startet ohne gespeicherte Daten mit einer leeren Bibliothek', () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    expect(loadLibrary()).toEqual({ library: { version: 3, activeProjectId: '', projects: [] }, error: null });
    expect(currentBuilding(createLibrary())).toBeUndefined();
    expect(currentFloor(undefined)).toBeUndefined();
  });

  it('trennt alte PDF-Seiten in Etagen und erhält sämtliche Räume, Maße und den aktiven Raum', () => {
    const before = legacy(), saved = structuredClone(before);
    const library = createLibrary(before), building = currentBuilding(library)!;
    expect(building.floors.map(floor => floor.name)).toEqual(['Seite 1', 'Seite 2']);
    expect(building.floors[0].workspace.rooms.map(room => room.project.name)).toEqual(['Wohnzimmer', 'Küche']);
    expect(building.floors[1].workspace.rooms.map(room => room.project.name)).toEqual(['Schlafzimmer']);
    expect(currentFloor(building)!.workspace.activeRoomId).toBe(before.activeRoomId);
    expect(building.floors.flatMap(floor => floor.workspace.rooms)).toEqual(before.rooms);
    expect(building.floors.map(floor => floor.workspace.floorPlan!.activePage)).toEqual([1, 2]);
    expect(building.floors[0].workspace.floorPlan!.pages).toEqual(before.floorPlan!.pages);
    expect(parseLibrary(library)).toEqual(library);
    expect(before).toEqual(saved);
    building.floors[0].workspace.floorPlan!.pages[1].calibration!.lengthMm = 10;
    expect(building.floors[1].workspace.floorPlan!.pages[1].calibration!.lengthMm).toBe(4800);
  });

  it('kann 50 alte PDF-Seiten mit jeweils einem Raum vollständig übernehmen', () => {
    const source = legacy();
    source.floorPlan!.pageCount = 50;
    source.floorPlan!.pages = Array.from({ length: 50 }, (_, index) => ({ ...structuredClone(document.pages[0]), number: index + 1 }));
    source.rooms = Array.from({ length: 50 }, (_, index) => ({ ...structuredClone(source.rooms[1]), id: `room-${index}`, source: { ...structuredClone(source.rooms[1].source!), page: index + 1 } }));
    source.activeRoomId = 'room-49';
    const migrated = createLibrary(source);
    expect(migrated.projects[0].floors).toHaveLength(MAX_FLOORS);
    expect(parseLibrary(migrated).projects[0].floors.flatMap(floor => floor.workspace.rooms)).toHaveLength(50);
  });

  it('bevorzugt neue gespeicherte Projekte, migriert alte Daten und schreibt beim Laden nichts', () => {
    const values = new Map([[STORAGE_KEY, JSON.stringify({ ...DEFAULT_PROJECT, name: 'Alter Raum' })]]);
    const write = vi.fn();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: write });
    expect(loadLibrary().library.projects[0].floors[0].workspace.rooms[0].project.name).toBe('Alter Raum');
    values.set(WORKSPACE_KEY, JSON.stringify(legacy()));
    expect(loadLibrary().library.projects[0].floors).toHaveLength(2);
    const library = addBuilding(createLibrary(), 'Neues Haus');
    values.set(LIBRARY_KEY, JSON.stringify(library));
    expect(loadLibrary().library).toEqual(library);
    values.set(LIBRARY_KEY, '{beschädigt');
    expect(loadLibrary().error).toContain('nicht geladen');
    expect(values.get(LIBRARY_KEY)).toBe('{beschädigt');
    expect(write).not.toHaveBeenCalled();
  });

  it('erhält beschädigte Legacy-Daten und meldet den Fehler', () => {
    const value = '{defekt';
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === WORKSPACE_KEY ? value : null });
    expect(loadLibrary().error).toContain('nicht geladen');
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(value);
  });

  it('akzeptiert leere Etagen nur im erweiterten Schema', () => {
    expect(() => parseWorkspace(createEmptyWorkspace())).toThrow();
    expect(parseWorkspace(createEmptyWorkspace(), { allowEmpty: true })).toEqual(createEmptyWorkspace());
    expect(() => parseWorkspace({ ...createEmptyWorkspace(), activeRoomId: 'missing' }, { allowEmpty: true })).toThrow();
    const library = addFloor(addBuilding(createLibrary(), 'Haus'), 'Erdgeschoss');
    expect(parseLibrary(library)).toEqual(library);
    expect(currentFloor(currentBuilding(library))!.workspace.rooms).toEqual([]);
  });

  it('isoliert Projekte und Etagen beim Bearbeiten und Umbenennen', () => {
    let library = populated();
    const first = structuredClone(library.projects[0]);
    library = addBuilding(library, 'Zweites Haus');
    const secondId = library.activeProjectId;
    library = addFloor(library, 'Erdgeschoss');
    const floorId = currentBuilding(library)!.activeFloorId;
    library = replaceCurrentWorkspace(library, addEmptyRoom(createEmptyWorkspace()));
    library = renameFloor(library, floorId, '  Gartengeschoss  ');
    library = renameBuilding(library, secondId, '  Gartenhaus  ');
    expect(currentBuilding(library)!.name).toBe('Gartenhaus');
    expect(currentFloor(currentBuilding(library))!.name).toBe('Gartengeschoss');
    expect(library.projects[0]).toEqual(first);
    library = selectBuilding(library, first.id);
    library = selectFloor(library, first.floors[0].id);
    expect(currentFloor(currentBuilding(library))!.workspace).toEqual(first.floors[0].workspace);
    expect(parseLibrary(library)).toEqual(library);
  });

  it('kann den letzten Raum, die letzte Etage und das letzte Projekt entfernen', () => {
    let library = addFloor(addBuilding(createLibrary(), 'Haus'), 'Etage');
    let workspace = addEmptyRoom(createEmptyWorkspace());
    workspace = removeRoom(workspace, workspace.activeRoomId, true);
    library = replaceCurrentWorkspace(library, workspace);
    library = removeFloor(library, currentBuilding(library)!.activeFloorId);
    expect(currentBuilding(library)!.activeFloorId).toBe('');
    expect(currentFloor(currentBuilding(library))).toBeUndefined();
    library = removeBuilding(library, library.activeProjectId);
    expect(parseLibrary(library)).toEqual(createLibrary());
  });

  it('verschiebt einen Raum ohne falsche PDF- oder Positionszuordnung', () => {
    const before = populated(), origin = currentBuilding(before)!.floors[0], target = currentBuilding(before)!.floors[1];
    const room = origin.workspace.rooms[1];
    room.placement = { x: 100, y: 200 };
    const library = moveRoomToFloor(before, room.id, target.id);
    const moved = currentBuilding(library)!.floors[1].workspace.rooms.find(item => item.id === room.id)!;
    expect(moved.project).toEqual(room.project);
    expect(moved.source).toBeUndefined();
    expect(moved.placement).toBeUndefined();
    expect(currentBuilding(library)!.floors[0].workspace.rooms.some(item => item.id === room.id)).toBe(false);
    expect(before.projects[0].floors[0].workspace.rooms).toContain(room);
    expect(parseLibrary(library)).toEqual(library);
  });

  it('erhält manuelle Positionen bei Änderungen und löst alte PDF-Positionen beim Vorlagenwechsel', () => {
    let workspace = createWorkspace();
    workspace.rooms[0].placement = { x: -1000, y: 2500 };
    workspace = replaceRoomProject(workspace, { ...workspace.rooms[0].project, name: 'Manuell' });
    workspace = withPdf(workspace, structuredClone(document));
    expect(workspace.rooms[0].placement).toEqual({ x: -1000, y: 2500 });
    workspace = addPdfRoom(workspace, 'PDF-Raum', contour);
    workspace.rooms[1].placement = { x: 1, y: 2 };
    workspace = withPdf(workspace, { ...structuredClone(document), id: 'b'.repeat(64) });
    expect(workspace.rooms[0].placement).toEqual({ x: -1000, y: 2500 });
    expect(workspace.rooms[1].placement).toBeUndefined();
    expect(parseWorkspace(workspace)).toEqual(workspace);
  });

  it.each([
    ['doppelte Projekte', (library: ProjectLibrary) => { library.projects.push(structuredClone(library.projects[0])); }],
    ['doppelte Etagen', (library: ProjectLibrary) => { library.projects[0].floors[1].id = library.projects[0].floors[0].id; }],
    ['doppelte Räume', (library: ProjectLibrary) => { library.projects[0].floors[1].workspace.rooms[0].id = library.projects[0].floors[0].workspace.rooms[0].id; }],
    ['fehlendes Projekt', (library: ProjectLibrary) => { library.activeProjectId = 'fehlt'; }],
    ['fehlende Etage', (library: ProjectLibrary) => { library.projects[0].activeFloorId = 'fehlt'; }],
    ['falsche Seite', (library: ProjectLibrary) => { library.projects[0].floors[0].workspace.floorPlan!.activePage = 2; }],
    ['unendliche Position', (library: ProjectLibrary) => { library.projects[0].floors[0].workspace.rooms[0].placement = { x: Infinity, y: 0 }; }],
    ['zu große Position', (library: ProjectLibrary) => { library.projects[0].floors[0].workspace.rooms[0].placement = { x: 1_000_001, y: 0 }; }],
    ['leerer Name', (library: ProjectLibrary) => { library.projects[0].name = ' '; }],
  ])('weist %s zurück', (_, mutate) => {
    const library = populated(); mutate(library);
    expect(() => parseLibrary(library)).toThrow();
  });

  it('begrenzt Projekte und Etagen ohne bestehende Daten zu verändern', () => {
    let library = createLibrary();
    for (let i = 0; i < MAX_BUILDINGS; i++) library = addBuilding(library, `Haus ${i}`);
    expect(() => addBuilding(library, 'Mehr')).toThrow('höchstens');
    for (let i = 0; i < MAX_FLOORS; i++) library = addFloor(library, `Etage ${i}`);
    expect(() => addFloor(library, 'Mehr')).toThrow('höchstens');
    expect(parseLibrary(library)).toEqual(library);
  });

  it('fügt importierte Projekte mit neuen IDs hinzu, ohne vorhandene Räume zu ersetzen', () => {
    const library = populated(), original = structuredClone(library);
    const imported = insertBuilding(library, library.projects[0]);
    expect(imported.projects).toHaveLength(2);
    expect(imported.projects[0]).toEqual(original.projects[0]);
    expect(imported.activeProjectId).toBe(imported.projects[1].id);
    expect(imported.projects[1].id).not.toBe(original.projects[0].id);
    expect(imported.projects[1].floors[0].id).not.toBe(original.projects[0].floors[0].id);
    expect(imported.projects[1].floors[0].workspace.rooms[0].id).not.toBe(original.projects[0].floors[0].workspace.rooms[0].id);
    expect(imported.projects[1].floors[0].workspace.rooms[0].project).toEqual(original.projects[0].floors[0].workspace.rooms[0].project);
    expect(parseLibrary(imported)).toEqual(imported);
  });
});

describe('Dateien mit mehreren Etagen', () => {
  it('sichert alle Etagen, Räume, Positionen und gemeinsame PDF-Bytes verlustfrei', async () => {
    const { building, bytes, id } = await withRealHash();
    building.floors[0].workspace.rooms[0].placement = { x: 750, y: -800 };
    const json = writeBuildingFile(building, { [id]: bytes });
    expect(JSON.parse(json).assets).toHaveLength(1);
    const read = await readBuildingFile(JSON.parse(json));
    expect(read.building).toEqual(building);
    expect(read.assets).toEqual([{ id, bytes }]);
  });

  it('sichert auch Projekte ohne Etagen und Etagen ohne Räume', async () => {
    let library = addBuilding(createLibrary(), 'Leer');
    const building = currentBuilding(library)!;
    expect((await readBuildingFile(JSON.parse(writeBuildingFile(building, {})))).building).toEqual(building);
    library = addFloor(library, 'Noch leer');
    const next = currentBuilding(library)!;
    expect((await readBuildingFile(JSON.parse(writeBuildingFile(next, {})))).building).toEqual(next);
  });

  it('liest bisherige Einzelraum- und Workspace-Dateien', async () => {
    const v1 = await readBuildingFile(structuredClone(DEFAULT_PROJECT));
    expect(v1.building.floors[0].workspace.rooms[0].project).toEqual(DEFAULT_PROJECT);
    expect(v1.assets).toEqual([]);
    const workspace = addEmptyRoom(createWorkspace());
    const v2 = await readBuildingFile({ format: 'fugenplan', version: 2, workspace });
    expect(v2.building.floors[0].workspace).toEqual(workspace);
  });

  it('weist eine fehlende, fremde, doppelte oder geänderte PDF zurück', async () => {
    const { building, bytes, id } = await withRealHash();
    expect(() => writeBuildingFile(building, {})).toThrow('Original-PDF fehlt');
    const original = JSON.parse(writeBuildingFile(building, { [id]: bytes }));
    const missing = structuredClone(original); missing.assets = [];
    await expect(readBuildingFile(missing)).rejects.toThrow('unvollständig');
    const duplicate = structuredClone(original); duplicate.assets.push(duplicate.assets[0]);
    await expect(readBuildingFile(duplicate)).rejects.toThrow('mehrfach');
    const foreign = structuredClone(original); foreign.assets[0].id = 'f'.repeat(64);
    await expect(readBuildingFile(foreign)).rejects.toThrow('nicht zugeordnet');
    const tampered = structuredClone(original); tampered.assets[0].pdfBase64 = btoa('%PDF-1.7\nanderer Inhalt');
    await expect(readBuildingFile(tampered)).rejects.toThrow('passt nicht');
  });

  it('prüft PDF-Metadaten aller Etagen auch bei deduplizierten Bytes', async () => {
    const { building, bytes, id } = await withRealHash();
    const file = JSON.parse(writeBuildingFile(building, { [id]: bytes }));
    file.building.floors[1].workspace.floorPlan.pages[1].width += 10;
    await expect(readBuildingFile(file)).rejects.toThrow('Seitendaten');
  });

  it('verhindert Export und Import ungültiger inaktiver Raumkonturen', async () => {
    const { building, bytes, id } = await withRealHash();
    const room = building.floors[0].workspace.rooms[0];
    room.project.room.shape = 'custom';
    room.project.room.points = [{ x: 0, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }, { x: 1000, y: 0 }];
    expect(() => writeBuildingFile(building, { [id]: bytes })).toThrow('Wohnzimmer');
    await expect(readBuildingFile({ format: 'fugenplan', version: 3, building, assets: [] })).rejects.toThrow('Wohnzimmer');
  });

  it('weist falsche Formatversion und ungültige Projektstruktur zurück', async () => {
    await expect(readBuildingFile({ format: 'fremd', version: 3 })).rejects.toThrow('Projektversion');
    expect(() => parseBuilding({ name: 'Haus', id: 'haus', activeFloorId: 'fehlend', floors: [] })).toThrow('aktive Etage');
  });
});
