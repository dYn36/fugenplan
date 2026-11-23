import type { BuildingFloor, BuildingProject, ProjectLibrary, Workspace } from '../floorplan-types';
import { parseProject, RECOVERED_START_NOTICE, STORAGE_KEY } from './project';
import type { ProjectParseOptions } from './project';
import { createEmptyWorkspace, createWorkspace, MAX_ROOMS, parseWorkspace, WORKSPACE_KEY } from './workspace';

export const LIBRARY_KEY = 'fugenplan.library.v3';
export const MAX_BUILDINGS = 20;
// A legacy workspace can contain 50 rooms on 50 different PDF pages.
export const MAX_FLOORS = 50;

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Die Projektsammlung enthält ungültige Daten.');
  return value as Record<string, unknown>;
};
function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 100) throw new Error(`${label} muss 1 bis 100 Zeichen enthalten.`);
  return value.trim();
}
function activeId(value: unknown, ids: string[], label: string): string {
  if (!ids.length && value === '') return '';
  if (typeof value !== 'string' || !ids.includes(value)) throw new Error(`${label} fehlt.`);
  return value;
}

function checkFloorPage(workspace: Workspace): void {
  const sourcePages = new Set(workspace.rooms.flatMap(room => room.source ? [room.source.page] : []));
  if (sourcePages.size > 1 || (sourcePages.size && !sourcePages.has(workspace.floorPlan!.activePage))) {
    throw new Error('Eine Etage kann nur Räume derselben PDF-Seite enthalten. Lege für eine andere Seite eine eigene Etage an.');
  }
}

export function parseBuilding(value: unknown, options: ProjectParseOptions = {}): BuildingProject {
  const b = object(value);
  if (!Array.isArray(b.floors) || b.floors.length > MAX_FLOORS) throw new Error(`Ein Projekt kann höchstens ${MAX_FLOORS} Etagen enthalten.`);
  const floorIds = new Set<string>(), roomIds = new Set<string>();
  const pdfMetadata = new Map<string, string>();
  const floors = b.floors.map((value): BuildingFloor => {
    const f = object(value), id = text(f.id, 'Etagenkennung');
    if (floorIds.has(id)) throw new Error('Eine Etagenkennung kommt mehrfach vor.');
    floorIds.add(id);
    const workspace = parseWorkspace(f.workspace, { ...options, allowEmpty: true });
    checkFloorPage(workspace);
    if (workspace.floorPlan) {
      const document = workspace.floorPlan;
      const metadata = JSON.stringify(document.pages.map(page => [page.number, page.width, page.height, page.rotation]));
      const previous = pdfMetadata.get(document.id);
      if (previous !== undefined && previous !== metadata) throw new Error('Die Seitendaten derselben PDF stimmen in den Etagen nicht überein.');
      pdfMetadata.set(document.id, metadata);
    }
    for (const room of workspace.rooms) {
      if (roomIds.has(room.id)) throw new Error('Eine Raumkennung kommt in mehreren Etagen vor.');
      roomIds.add(room.id);
    }
    return { id, name: text(f.name, 'Etagenname'), workspace };
  });
  return { id: text(b.id, 'Projektkennung'), name: text(b.name, 'Projektname'), activeFloorId: activeId(b.activeFloorId, [...floorIds], 'Die aktive Etage'), floors };
}

export function parseLibrary(value: unknown, options: ProjectParseOptions = {}): ProjectLibrary {
  const l = object(value);
  if (l.version !== 3) throw new Error('Diese Version der Projektsammlung wird nicht unterstützt.');
  if (!Array.isArray(l.projects) || l.projects.length > MAX_BUILDINGS) throw new Error(`Es sind höchstens ${MAX_BUILDINGS} Projekte möglich.`);
  const projectIds = new Set<string>(), floorIds = new Set<string>(), roomIds = new Set<string>();
  const projects = l.projects.map(value => {
    const building = parseBuilding(value, options);
    if (projectIds.has(building.id)) throw new Error('Eine Projektkennung kommt mehrfach vor.');
    projectIds.add(building.id);
    for (const floor of building.floors) {
      if (floorIds.has(floor.id)) throw new Error('Eine Etagenkennung kommt in mehreren Projekten vor.');
      floorIds.add(floor.id);
      for (const room of floor.workspace.rooms) {
        if (roomIds.has(room.id)) throw new Error('Eine Raumkennung kommt in mehreren Projekten vor.');
        roomIds.add(room.id);
      }
    }
    return building;
  });
  return { version: 3, activeProjectId: activeId(l.activeProjectId, [...projectIds], 'Das aktive Projekt'), projects };
}

/** Preserve every old room, calibration and PDF page; do not infer real floor names. */
export function createLibrary(workspace?: Workspace): ProjectLibrary {
  if (!workspace) return { version: 3, activeProjectId: '', projects: [] };
  const checked = parseWorkspace(workspace, { allowEmpty: true });
  const pageNumbers = [...new Set(checked.rooms.flatMap(room => room.source ? [room.source.page] : []))].sort((a, b) => a - b);
  if (!pageNumbers.length) pageNumbers.push(checked.floorPlan?.activePage ?? 0);
  const floors: BuildingFloor[] = pageNumbers.map((page, index) => {
    const rooms = checked.rooms.filter(room => room.source ? room.source.page === page : index === 0);
    return {
      id: crypto.randomUUID(), name: page ? `Seite ${page}` : 'Etage 1',
      workspace: {
        version: 2, rooms,
        activeRoomId: rooms.some(room => room.id === checked.activeRoomId) ? checked.activeRoomId : rooms[0]?.id ?? '',
        ...(checked.floorPlan ? { floorPlan: { ...structuredClone(checked.floorPlan), activePage: page } } : {}),
      },
    };
  });
  const building: BuildingProject = {
    id: crypto.randomUUID(), name: 'Mein Projekt', floors,
    activeFloorId: floors.find(floor => floor.workspace.rooms.some(room => room.id === checked.activeRoomId))?.id ?? floors[0].id,
  };
  return { version: 3, activeProjectId: building.id, projects: [building] };
}

/** Read only: even damaged legacy data stays available in its original storage key. */
export function loadLibrary(): { library: ProjectLibrary; error: string | null; warning?: string } {
  try {
    let recovered = false;
    const options = { recoverStaleStart: () => { recovered = true; } };
    const saved = localStorage.getItem(LIBRARY_KEY);
    let library: ProjectLibrary;
    if (saved !== null) library = parseLibrary(JSON.parse(saved), options);
    else {
      const legacy = localStorage.getItem(WORKSPACE_KEY), single = localStorage.getItem(STORAGE_KEY);
      library = legacy !== null ? createLibrary(parseWorkspace(JSON.parse(legacy), options))
        : single !== null ? createLibrary(createWorkspace(parseProject(JSON.parse(single), options))) : createLibrary();
    }
    return { library, error: null, ...(recovered ? { warning: RECOVERED_START_NOTICE } : {}) };
  } catch {
    return { library: createLibrary(), error: 'Die gespeicherten Projekte konnten nicht geladen werden. Die ursprünglichen Daten bleiben im Browser erhalten.' };
  }
}

export function currentBuilding(library: ProjectLibrary): BuildingProject | undefined {
  return library.projects.find(project => project.id === library.activeProjectId);
}
export function currentFloor(building: BuildingProject | undefined): BuildingFloor | undefined {
  return building?.floors.find(floor => floor.id === building.activeFloorId);
}
function updateBuilding(library: ProjectLibrary, change: (building: BuildingProject) => BuildingProject): ProjectLibrary {
  const active = currentBuilding(library);
  if (!active) throw new Error('Öffne zuerst ein Projekt.');
  const next = change(active);
  return { ...library, projects: library.projects.map(building => building.id === active.id ? next : building) };
}

export function replaceCurrentWorkspace(library: ProjectLibrary, workspace: Workspace): ProjectLibrary {
  checkFloorPage(workspace);
  return updateBuilding(library, building => {
    const floor = currentFloor(building);
    if (!floor) throw new Error('Lege zuerst eine Etage an.');
    return { ...building, floors: building.floors.map(item => item.id === floor.id ? { ...item, workspace } : item) };
  });
}
export function ensureBuildingCapacity(library: ProjectLibrary): void {
  if (library.projects.length >= MAX_BUILDINGS) throw new Error(`Es sind höchstens ${MAX_BUILDINGS} Projekte möglich.`);
}
export function addBuilding(library: ProjectLibrary, name: string): ProjectLibrary {
  ensureBuildingCapacity(library);
  const building: BuildingProject = { id: crypto.randomUUID(), name: text(name, 'Projektname'), activeFloorId: '', floors: [] };
  return { ...library, activeProjectId: building.id, projects: [...library.projects, building] };
}
export function renameBuilding(library: ProjectLibrary, id: string, name: string): ProjectLibrary {
  if (!library.projects.some(building => building.id === id)) throw new Error('Das Projekt wurde nicht gefunden.');
  const checked = text(name, 'Projektname');
  return { ...library, projects: library.projects.map(building => building.id === id ? { ...building, name: checked } : building) };
}
export function removeBuilding(library: ProjectLibrary, id: string): ProjectLibrary {
  if (!library.projects.some(building => building.id === id)) throw new Error('Das Projekt wurde nicht gefunden.');
  const projects = library.projects.filter(building => building.id !== id);
  return { ...library, projects, activeProjectId: id === library.activeProjectId ? projects[0]?.id ?? '' : library.activeProjectId };
}
export function selectBuilding(library: ProjectLibrary, id: string): ProjectLibrary {
  if (!library.projects.some(building => building.id === id)) throw new Error('Das Projekt wurde nicht gefunden.');
  return { ...library, activeProjectId: id };
}
export function addFloor(library: ProjectLibrary, name: string): ProjectLibrary {
  return updateBuilding(library, building => {
    if (building.floors.length >= MAX_FLOORS) throw new Error(`Ein Projekt kann höchstens ${MAX_FLOORS} Etagen enthalten.`);
    const floor = { id: crypto.randomUUID(), name: text(name, 'Etagenname'), workspace: createEmptyWorkspace() };
    return { ...building, activeFloorId: floor.id, floors: [...building.floors, floor] };
  });
}
export function renameFloor(library: ProjectLibrary, id: string, name: string): ProjectLibrary {
  const checked = text(name, 'Etagenname');
  return updateBuilding(library, building => {
    if (!building.floors.some(floor => floor.id === id)) throw new Error('Die Etage wurde nicht gefunden.');
    return { ...building, floors: building.floors.map(floor => floor.id === id ? { ...floor, name: checked } : floor) };
  });
}
export function removeFloor(library: ProjectLibrary, id: string): ProjectLibrary {
  return updateBuilding(library, building => {
    if (!building.floors.some(floor => floor.id === id)) throw new Error('Die Etage wurde nicht gefunden.');
    const floors = building.floors.filter(floor => floor.id !== id);
    return { ...building, floors, activeFloorId: id === building.activeFloorId ? floors[0]?.id ?? '' : building.activeFloorId };
  });
}
export function selectFloor(library: ProjectLibrary, id: string): ProjectLibrary {
  return updateBuilding(library, building => {
    if (!building.floors.some(floor => floor.id === id)) throw new Error('Die Etage wurde nicht gefunden.');
    return { ...building, activeFloorId: id };
  });
}
export function moveRoomToFloor(library: ProjectLibrary, roomId: string, targetFloorId: string): ProjectLibrary {
  return updateBuilding(library, building => {
    const origin = building.floors.find(floor => floor.workspace.rooms.some(room => room.id === roomId));
    const target = building.floors.find(floor => floor.id === targetFloorId);
    if (!origin || !target) throw new Error('Der Raum oder die Zieletage wurde nicht gefunden.');
    if (origin.id === target.id) return building;
    if (target.workspace.rooms.length >= MAX_ROOMS) throw new Error(`Die Zieletage kann höchstens ${MAX_ROOMS} Räume enthalten.`);
    const room = origin.workspace.rooms.find(room => room.id === roomId)!;
    // Neither PDF coordinates nor a manual position can establish the location on another floor.
    const moved = { id: room.id, project: room.project };
    return { ...building, floors: building.floors.map(floor => {
      if (floor.id === target.id) return { ...floor, workspace: { ...floor.workspace, activeRoomId: roomId, rooms: [...floor.workspace.rooms, moved] } };
      if (floor.id !== origin.id) return floor;
      const rooms = floor.workspace.rooms.filter(room => room.id !== roomId);
      return { ...floor, workspace: { ...floor.workspace, rooms, activeRoomId: floor.workspace.activeRoomId === roomId ? rooms[0]?.id ?? '' : floor.workspace.activeRoomId } };
    }) };
  });
}

/** File imports are additional projects. Fresh IDs prevent reference collisions. */
export function insertBuilding(library: ProjectLibrary, input: BuildingProject): ProjectLibrary {
  ensureBuildingCapacity(library);
  const checked = parseBuilding(input);
  const floorIds = new Map(checked.floors.map(floor => [floor.id, crypto.randomUUID()]));
  const building: BuildingProject = { ...checked, id: crypto.randomUUID(), activeFloorId: floorIds.get(checked.activeFloorId) ?? '', floors: checked.floors.map(floor => {
    const roomIds = new Map(floor.workspace.rooms.map(room => [room.id, crypto.randomUUID()]));
    return { ...floor, id: floorIds.get(floor.id)!, workspace: { ...floor.workspace, activeRoomId: roomIds.get(floor.workspace.activeRoomId) ?? '', rooms: floor.workspace.rooms.map(room => ({ ...room, id: roomIds.get(room.id)! })) } };
  }) };
  return { ...library, activeProjectId: building.id, projects: [...library.projects, building] };
}
