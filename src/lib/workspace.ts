import type { Calibration, FloorPlanDocument } from '../floorplan-types';
import type { FloorPlanPage, RoomSource, Workspace, WorkspaceRoom } from '../floorplan-types';
import type { Point, Project } from '../types';
import { DEFAULT_PROJECT, loadProject, parseProject, RECOVERED_START_NOTICE } from './project';
import type { ProjectParseOptions } from './project';
import { getBounds, getRoomPolygon, validateRoom } from './geometry';
import { calibrationScale, recalibrateProject, roomToSource, sourceToRoom } from './calibration';

export const WORKSPACE_KEY = 'fugenplan.workspace.v2';
export const MAX_ROOMS = 50;

export function createWorkspace(project: Project = structuredClone(DEFAULT_PROJECT)): Workspace {
  const id = crypto.randomUUID();
  return { version: 2, activeRoomId: id, rooms: [{ id, project }] };
}

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Die Projektdatei enthält ungültige Daten.');
  return value as Record<string, unknown>;
};
const numeric = (value: unknown, min: number, max: number, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label}: Wert außerhalb des gültigen Bereichs.`);
  return value;
};
const integer = (value: unknown, min: number, max: number, label: string) => {
  const n = numeric(value, min, max, label);
  if (!Number.isInteger(n)) throw new Error(`${label}: Bitte eine ganze Zahl angeben.`);
  return n;
};
const string = (value: unknown, max: number, label: string): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label} ist ungültig.`);
  return value;
};
const point = (value: unknown): Point => {
  const p = object(value);
  return { x: numeric(p.x, -1e12, 1e12, 'Punkt X'), y: numeric(p.y, -1e12, 1e12, 'Punkt Y') };
};

function parseCalibration(value: unknown, width: number, height: number): Calibration | null {
  if (value === null) return null;
  const c = object(value);
  const result = { start: point(c.start), end: point(c.end), lengthMm: numeric(c.lengthMm, 1, 1e6, 'Wandlänge') };
  for (const p of [result.start, result.end]) {
    if (p.x < 0 || p.y < 0 || p.x > width || p.y > height) throw new Error('Die Messpunkte müssen auf der PDF-Seite liegen.');
  }
  calibrationScale(result);
  return result;
}

function parseDocument(value: unknown): FloorPlanDocument {
  const d = object(value);
  const id = string(d.id, 64, 'PDF-Kennung');
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('Die PDF-Kennung ist ungültig.');
  const pageCount = integer(d.pageCount, 1, 200, 'Seitenzahl');
  if (!Array.isArray(d.pages) || d.pages.length !== pageCount) throw new Error('Die PDF-Seiten sind unvollständig.');
  const pages = d.pages.map((value, i): FloorPlanPage => {
    const p = object(value);
    if (p.number !== i + 1) throw new Error('Die PDF-Seitenfolge ist ungültig.');
    const width = numeric(p.width, 0.001, 1e7, 'PDF-Breite'), height = numeric(p.height, 0.001, 1e7, 'PDF-Höhe');
    const rotation = numeric(p.rotation, 0, 270, 'Seitendrehung');
    if (rotation % 90) throw new Error('Die Seitendrehung ist ungültig.');
    return { number: i + 1, width, height, rotation, calibration: parseCalibration(p.calibration, width, height) };
  });
  return { id, name: string(d.name, 255, 'PDF-Name'), pageCount, activePage: integer(d.activePage, 1, pageCount, 'Aktive Seite'), pages };
}

/** Rebuild the imported schema and check the connection between PDF and room coordinates. */
export function parseWorkspace(value: unknown, options: ProjectParseOptions = {}): Workspace {
  const w = object(value);
  if (w.version !== 2) throw new Error('Diese Projektversion wird nicht unterstützt.');
  if (!Array.isArray(w.rooms) || w.rooms.length < 1 || w.rooms.length > MAX_ROOMS) throw new Error(`Ein Projekt braucht 1 bis ${MAX_ROOMS} Räume.`);
  const floorPlan = w.floorPlan === undefined ? undefined : parseDocument(w.floorPlan);
  const ids = new Set<string>();
  const rooms = w.rooms.map((value): WorkspaceRoom => {
    const r = object(value), id = string(r.id, 100, 'Raumkennung'), project = parseProject(r.project, options);
    if (ids.has(id)) throw new Error('Eine Raumkennung kommt mehrfach vor.');
    ids.add(id);
    if (r.source === undefined) return { id, project };
    const s = object(r.source);
    if (!floorPlan || s.documentId !== floorPlan.id) throw new Error('Die Raumkontur gehört zu einer anderen PDF.');
    const page = integer(s.page, 1, floorPlan.pageCount, 'Raumseite');
    const calibration = floorPlan.pages[page - 1].calibration;
    if (!calibration) throw new Error('Für die Raumkontur fehlt der Maßstab.');
    // A temporarily invalid three-point room can have a repeated closing point.
    // Preserve this editable state in browser storage; file import/export validates geometry separately.
    if (!Array.isArray(s.points) || s.points.length < 2 || s.points.length > 32) throw new Error('Die gespeicherte Raumkontur ist ungültig.');
    const source: RoomSource = { documentId: floorPlan.id, page, origin: point(s.origin), points: s.points.map(point) };
    const projected = sourceToRoom(source.points, calibration, source.origin).points;
    const actual = getRoomPolygon(project.room);
    if (projected.length !== actual.length || projected.some((p, i) => Math.hypot(p.x - actual[i].x, p.y - actual[i].y) > 0.001)) {
      throw new Error('Die Raummaße stimmen nicht mit dem PDF-Maßstab überein.');
    }
    return { id, project, source };
  });
  const activeRoomId = string(w.activeRoomId, 100, 'Aktiver Raum');
  if (!ids.has(activeRoomId)) throw new Error('Der aktive Raum fehlt.');
  return { version: 2, rooms, activeRoomId, ...(floorPlan ? { floorPlan } : {}) };
}

export function loadWorkspace(): { workspace: Workspace; error: string | null; warning?: string } {
  try {
    const saved = localStorage.getItem(WORKSPACE_KEY);
    if (saved) {
      let recovered=false;
      const workspace=parseWorkspace(JSON.parse(saved),{recoverStaleStart:()=>{recovered=true;}});
      return {workspace,error:null,...(recovered?{warning:RECOVERED_START_NOTICE}:{})};
    }
    const previous = loadProject();
    return { workspace: createWorkspace(previous.project), error: previous.error, ...(previous.warning?{warning:previous.warning}:{}) };
  } catch {
    return { workspace: createWorkspace(), error: 'Das gespeicherte Projekt konnte nicht geladen werden. Eine neue Eingabe speichert den aktuellen Stand.' };
  }
}

export function currentRoom(workspace: Workspace): WorkspaceRoom {
  return workspace.rooms.find(room => room.id === workspace.activeRoomId)!;
}

/** Keep the PDF outline in sync when a room is changed in the ordinary room controls. */
export function replaceRoomProject(workspace: Workspace, project: Project, detach = false): Workspace {
  return { ...workspace, rooms: workspace.rooms.map(room => {
    if (room.id !== workspace.activeRoomId) return room;
    if (detach || !room.source) return { id: room.id, project };
    const calibration = workspace.floorPlan?.pages[room.source.page - 1]?.calibration;
    if (!calibration) throw new Error('Für diesen Raum fehlt der PDF-Maßstab.');
    return { ...room, project, source: { ...room.source, points: roomToSource(getRoomPolygon(project.room), calibration, room.source.origin) } };
  }) };
}

export function withPdf(workspace: Workspace, document: FloorPlanDocument): Workspace {
  if (workspace.floorPlan?.id === document.id) return workspace;
  // Retain the actual room plans when replacing the PDF; their old PDF mapping is no longer valid.
  return { ...workspace, floorPlan: document, rooms: workspace.rooms.map(({ id, project }) => ({ id, project })) };
}

export function calibratePage(workspace: Workspace, calibration: Calibration): Workspace {
  const document = workspace.floorPlan;
  if (!document) throw new Error('Lade zuerst eine PDF.');
  const page = document.pages[document.activePage - 1];
  const checked = parseCalibration(calibration, page.width, page.height)!;
  const rooms = workspace.rooms.map(room => {
    if (room.source?.documentId !== document.id || room.source.page !== page.number) return room;
    if (!page.calibration) throw new Error('Der bisherige Maßstab fehlt.');
    return { ...room, project: recalibrateProject(room.project, room.source, page.calibration, checked) };
  });
  return { ...workspace, rooms, floorPlan: { ...document, pages: document.pages.map(p => p.number === page.number ? { ...p, calibration: checked } : p) } };
}

export function addPdfRoom(workspace: Workspace, name: string, sourcePoints: Point[]): Workspace {
  const document = workspace.floorPlan;
  if (!document) throw new Error('Lade zuerst eine PDF.');
  if (workspace.rooms.length >= MAX_ROOMS) throw new Error(`Es sind höchstens ${MAX_ROOMS} Räume möglich.`);
  const page = document.pages[document.activePage - 1];
  if (!page.calibration) throw new Error('Lege zuerst den Maßstab für diese Seite fest.');
  if (sourcePoints.some(p => p.x < 0 || p.y < 0 || p.x > page.width || p.y > page.height)) throw new Error('Die Raumkontur muss auf der PDF-Seite liegen.');
  const { points, origin } = sourceToRoom(sourcePoints, page.calibration);
  const bounds = getBounds(points);
  if (bounds.width < 100 || bounds.height < 100 || bounds.width > 50000 || bounds.height > 50000) throw new Error('Der Raum muss zwischen 10 cm und 50 m breit und tief sein. Prüfe den Maßstab.');
  const project = parseProject({ ...structuredClone(DEFAULT_PROJECT), name: name.trim() || `Raum ${workspace.rooms.length + 1}`, room: {
    ...structuredClone(DEFAULT_PROJECT.room), shape: 'custom', points, width: bounds.width, height: bounds.height, obstacles: [],
  } });
  const errors = validateRoom(project.room);
  if (errors.length) throw new Error(errors.join(' '));
  const id = crypto.randomUUID();
  const room: WorkspaceRoom = { id, project, source: { documentId: document.id, page: page.number, points: sourcePoints.map(p => ({ ...p })), origin } };
  return { ...workspace, activeRoomId: id, rooms: [...workspace.rooms, room] };
}

export function removeRoom(workspace: Workspace, id: string): Workspace {
  if (workspace.rooms.length === 1) throw new Error('Ein Projekt braucht mindestens einen Raum.');
  const rooms = workspace.rooms.filter(room => room.id !== id);
  return { ...workspace, rooms, activeRoomId: id === workspace.activeRoomId ? rooms[0].id : workspace.activeRoomId };
}

export function addEmptyRoom(workspace: Workspace): Workspace {
  if (workspace.rooms.length >= MAX_ROOMS) throw new Error(`Es sind höchstens ${MAX_ROOMS} Räume möglich.`);
  const id = crypto.randomUUID(), project = structuredClone(DEFAULT_PROJECT);
  project.name = `Raum ${workspace.rooms.length + 1}`;
  return { ...workspace, activeRoomId: id, rooms: [...workspace.rooms, { id, project }] };
}
