import { describe, expect, it } from 'vitest';
import type { ProjectLibrary } from '../src/floorplan-types';
import { mergeLibraryConflict, sameLibraryContents } from '../src/lib/library-conflict';
import { addBuilding, addFloor, createLibrary, currentBuilding, currentFloor, MAX_BUILDINGS, parseLibrary, removeBuilding, renameBuilding, replaceCurrentWorkspace, selectBuilding, selectFloor } from '../src/lib/library';
import { addEmptyRoom, createEmptyWorkspace } from '../src/lib/workspace';

function fixture(): ProjectLibrary {
  let library = addBuilding(createLibrary(), 'Haus');
  library = addFloor(library, 'Erdgeschoss');
  library = replaceCurrentWorkspace(library, addEmptyRoom(addEmptyRoom(createEmptyWorkspace())));
  library = addFloor(library, 'Obergeschoss');
  library = replaceCurrentWorkspace(library, addEmptyRoom(createEmptyWorkspace()));
  return addBuilding(library, 'Ferienwohnung');
}

describe('Inhaltsvergleich der Projektsammlung', () => {
  it('ignoriert die Auswahl von Projekt, Etage und Raum', () => {
    const baseline = fixture();
    const house = baseline.projects[0];
    let navigated = selectBuilding(baseline, house.id);
    navigated = selectFloor(navigated, house.floors[0].id);
    const workspace = currentFloor(currentBuilding(navigated))!.workspace;
    navigated = replaceCurrentWorkspace(navigated, { ...workspace, activeRoomId: workspace.rooms[0].id });
    expect(navigated).not.toEqual(baseline);
    expect(sameLibraryContents(baseline, navigated)).toBe(true);
    expect(sameLibraryContents(navigated, baseline)).toBe(true);
  });

  it.each([
    ['Projektname', (library: ProjectLibrary) => { library.projects[0].name = 'Haus am See'; }],
    ['Etagenname', (library: ProjectLibrary) => { library.projects[0].floors[0].name = 'Keller'; }],
    ['Raummaße', (library: ProjectLibrary) => { library.projects[0].floors[0].workspace.rooms[0].project.room.width = 2300; }],
    ['Raumposition', (library: ProjectLibrary) => { library.projects[0].floors[0].workspace.rooms[0].placement = { x: 100, y: 200 }; }],
    ['Projektreihenfolge', (library: ProjectLibrary) => { library.projects.reverse(); }],
  ] as const)('erkennt Änderungen an %s', (_label, edit) => {
    const baseline = fixture(), edited = structuredClone(baseline);
    edit(edited);
    expect(sameLibraryContents(baseline, edited)).toBe(false);
    expect(sameLibraryContents(edited, baseline)).toBe(false);
  });

  it('erkennt neue oder gelöschte Projekte auch bei leerer Sammlung', () => {
    const empty = createLibrary(), withProject = addBuilding(empty, 'Haus');
    expect(sameLibraryContents(empty, createLibrary())).toBe(true);
    expect(sameLibraryContents(empty, withProject)).toBe(false);
    expect(sameLibraryContents(withProject, empty)).toBe(false);
  });

  it('ignoriert die Reihenfolge von Objektschlüsseln auch in verschachtelten Daten', () => {
    const baseline = fixture();
    const workspace = baseline.projects[0].floors[0].workspace;
    workspace.rooms[0].placement = { x: 100, y: 200 };
    workspace.floorPlan = {
      id: 'a'.repeat(64), name: 'Grundriss.pdf', pageCount: 1, activePage: 1,
      pages: [{ number: 1, width: 600, height: 400, rotation: 0, calibration: { start: { x: 10, y: 20 }, end: { x: 110, y: 20 }, lengthMm: 4000 } }],
    };
    const reordered: ProjectLibrary = JSON.parse(JSON.stringify(baseline, (_key, value: unknown) => {
      return value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).reverse())
        : value;
    }));
    const before = structuredClone({ baseline, reordered });
    expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(baseline));
    expect(sameLibraryContents(baseline, reordered)).toBe(true);
    expect({ baseline, reordered }).toEqual(before);
  });

  it('behandelt die aktive PDF-Seite weiterhin als Inhalt', () => {
    const baseline = addFloor(addBuilding(createLibrary(), 'Haus'), 'Etage');
    baseline.projects[0].floors[0].workspace.floorPlan = {
      id: 'a'.repeat(64), name: 'Grundriss.pdf', pageCount: 2, activePage: 1,
      pages: [1, 2].map(number => ({ number, width: 600, height: 400, rotation: 0, calibration: null })),
    };
    const changed = structuredClone(baseline);
    changed.projects[0].floors[0].workspace.floorPlan!.activePage = 2;
    expect(sameLibraryContents(baseline, changed)).toBe(false);
  });
});

describe('Konflikte zwischen geöffneten Tabs', () => {
  it('behält ein neues externes Projekt bei reiner Navigation im älteren Tab', () => {
    const baseline = fixture();
    const house = baseline.projects[0];
    let local = selectBuilding(baseline, house.id);
    local = selectFloor(local, house.floors[0].id);
    const workspace = currentFloor(currentBuilding(local))!.workspace;
    local = replaceCurrentWorkspace(local, { ...workspace, activeRoomId: workspace.rooms[0].id });
    const external = addBuilding(baseline, 'Neues Haus');
    expect(mergeLibraryConflict(local, baseline, external)).toEqual(external);
  });

  it('erhält lokale Raumänderungen und externe Änderungen desselben Projekts getrennt', () => {
    const baseline = fixture(), local = structuredClone(baseline), external = structuredClone(baseline);
    local.projects[0].floors[0].workspace.rooms[0].project.material.width = 120;
    external.projects[0].floors[0].workspace.rooms[1].project.material.width = 900;
    const expectedExternal = structuredClone(external);
    const merged = mergeLibraryConflict(local, baseline, external);
    expect(merged.projects).toHaveLength(3);
    expect(merged.projects.slice(0, 2)).toEqual(external.projects);
    const own = merged.projects[2];
    expect(own.name).toBe('Haus (eigene Fassung)');
    expect(own.id).not.toBe(local.projects[0].id);
    expect(own.floors[0].id).not.toBe(local.projects[0].floors[0].id);
    expect(own.floors[0].workspace.rooms[0].id).not.toBe(local.projects[0].floors[0].workspace.rooms[0].id);
    expect(own.floors[0].workspace.rooms[0].project.material.width).toBe(120);
    expect(merged.projects[0].floors[0].workspace.rooms[1].project.material.width).toBe(900);
    expect(external).toEqual(expectedExternal);
    expect(parseLibrary(merged)).toEqual(merged);
  });

  it('übernimmt unabhängige Änderungen ohne alte Fassungen fremder Projekte hinzuzufügen', () => {
    const baseline = fixture();
    const local = renameBuilding(baseline, baseline.projects[0].id, 'Haus am Park');
    const external = renameBuilding(baseline, baseline.projects[1].id, 'Ferienwohnung am See');
    const merged = mergeLibraryConflict(local, baseline, external);
    expect(merged.projects.map(project => project.name)).toEqual(['Haus', 'Ferienwohnung am See', 'Haus am Park (eigene Fassung)']);
  });

  it('erhält neue Projekte mit kollidierender ID als separate Fassung', () => {
    const baseline = createLibrary();
    const local = addFloor(addBuilding(baseline, 'Lokales Projekt'), 'Etage');
    const external = structuredClone(local);
    external.projects[0].name = 'Externes Projekt';
    const merged = mergeLibraryConflict(local, baseline, external);
    expect(merged.projects.map(project => project.name)).toEqual(['Externes Projekt', 'Lokales Projekt (eigene Fassung)']);
    expect(merged.projects[0]).toEqual(external.projects[0]);
    expect(merged.projects[1].id).not.toBe(external.projects[0].id);
    expect(parseLibrary(merged)).toEqual(merged);
  });

  it('dupliziert identische Änderungen und identische neue Projekte nicht', () => {
    const baseline = fixture();
    const local = addBuilding(renameBuilding(baseline, baseline.projects[0].id, 'Gemeinsamer Name'), 'Neues Projekt');
    const external = structuredClone(local);
    external.activeProjectId = external.projects[0].id;
    external.projects[0].activeFloorId = external.projects[0].floors[0].id;
    expect(mergeLibraryConflict(local, baseline, external)).toEqual(external);
  });

  it('übernimmt lokale Löschungen nicht in den externen Stand', () => {
    const baseline = fixture();
    const local = removeBuilding(baseline, baseline.projects[0].id);
    const external = renameBuilding(baseline, baseline.projects[0].id, 'Extern weiterbearbeitet');
    expect(mergeLibraryConflict(local, baseline, external)).toEqual(external);
  });

  it('stellt extern gelöschte Projekte nur bei echten lokalen Änderungen wieder her', () => {
    const baseline = fixture();
    const external = removeBuilding(baseline, baseline.projects[0].id);
    expect(mergeLibraryConflict(baseline, baseline, external)).toEqual(external);
    const local = renameBuilding(baseline, baseline.projects[0].id, 'Lokaler Entwurf');
    const merged = mergeLibraryConflict(local, baseline, external);
    expect(merged.projects.map(project => project.name)).toEqual(['Ferienwohnung', 'Lokaler Entwurf']);
    expect(merged.projects[1].id).not.toBe(baseline.projects[0].id);
  });

  it('behandelt eine PDF-Seitenzuordnung als Inhalt, nicht als Navigation', () => {
    const baseline = addFloor(addBuilding(createLibrary(), 'Haus'), 'Etage');
    const workspace = currentFloor(currentBuilding(baseline))!.workspace;
    workspace.floorPlan = { id: 'a'.repeat(64), name: 'Grundriss.pdf', pageCount: 2, activePage: 1, pages: [1, 2].map(number => ({ number, width: 600, height: 400, rotation: 0, calibration: null })) };
    const local = structuredClone(baseline);
    local.projects[0].floors[0].workspace.floorPlan!.activePage = 2;
    const merged = mergeLibraryConflict(local, baseline, baseline);
    expect(merged.projects).toHaveLength(2);
    expect(merged.projects[1].floors[0].workspace.floorPlan!.activePage).toBe(2);
    expect(merged.projects[0].floors[0].workspace.floorPlan!.activePage).toBe(1);
  });

  it('begrenzt den Namen einer eigenen Fassung auf 100 Zeichen', () => {
    const baseline = addBuilding(createLibrary(), 'A'.repeat(100));
    const local = addFloor(baseline, 'Neue Etage');
    const merged = mergeLibraryConflict(local, baseline, baseline);
    expect(merged.projects[1].name).toHaveLength(100);
    expect(merged.projects[1].name).toMatch(/ \(eigene Fassung\)$/);
    expect(parseLibrary(merged)).toEqual(merged);
  });

  it('lässt alle Eingaben auch beim Überschreiten des Projektlimits unverändert', () => {
    const baseline = createLibrary();
    const local = addBuilding(addBuilding(baseline, 'Lokal A'), 'Lokal B');
    let external = createLibrary();
    for (let index = 0; index < MAX_BUILDINGS - 1; index++) external = addBuilding(external, `Extern ${index}`);
    const before = structuredClone({ local, baseline, external });
    // The first addition fits; the second must fail without committing a partial result.
    expect(() => mergeLibraryConflict(local, baseline, external)).toThrow('höchstens');
    expect({ local, baseline, external }).toEqual(before);
  });
});
