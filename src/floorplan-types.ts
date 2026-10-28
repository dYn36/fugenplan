import type { Point, Project } from './types';

// PDF coordinates use the page's natural viewport, including its intrinsic rotation.
export type Calibration = { start: Point; end: Point; lengthMm: number };
export type FloorPlanPage = {
  number: number;
  width: number;
  height: number;
  rotation: number;
  calibration: Calibration | null;
};
export type FloorPlanDocument = {
  id: string;
  name: string;
  pageCount: number;
  activePage: number;
  pages: FloorPlanPage[];
};
export type RoomSource = {
  documentId: string;
  page: number;
  points: Point[];
  origin: Point;
};
// A manual placement is a translation in millimetres in the floor coordinate system.
// An attached PDF source takes precedence over this placement.
export type WorkspaceRoom = { id: string; project: Project; source?: RoomSource; placement?: Point };
export type Workspace = {
  version: 2;
  activeRoomId: string;
  rooms: WorkspaceRoom[];
  floorPlan?: FloorPlanDocument;
};
export type WorkspaceFile = {
  format: 'fugenplan';
  version: 2;
  workspace: Workspace;
  pdfBase64?: string;
};

export type BuildingFloor = { id: string; name: string; workspace: Workspace };
export type BuildingProject = { id: string; name: string; activeFloorId: string; floors: BuildingFloor[] };
export type ProjectLibrary = { version: 3; activeProjectId: string; projects: BuildingProject[] };
export type BuildingFile = {
  format: 'fugenplan';
  version: 3;
  building: BuildingProject;
  assets: { id: string; pdfBase64: string }[];
};
