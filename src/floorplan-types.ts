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
export type WorkspaceRoom = { id: string; project: Project; source?: RoomSource };
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
