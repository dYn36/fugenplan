// All lengths are in millimetres. Areas are in square millimetres.
export type Point = { x: number; y: number };
export type Polygon = Point[][];
export type MultiPolygon = Polygon[];
export type Pattern = 'grid' | 'half' | 'third' | 'quarter' | 'random' | 'diagonal' | 'herringbone';
export type Obstacle = { id: string; x: number; y: number; width: number; height: number };
export type RoomConfig = {
  shape: 'rectangle' | 'l-shape' | 'custom';
  width: number;
  height: number;
  notchWidth: number;
  notchHeight: number;
  points: Point[];
  obstacles: Obstacle[];
};
export type MaterialConfig = {
  kind: 'tile' | 'wood';
  width: number;
  height: number;
  grout: number;
  edgeGap: number;
  color: 'limestone' | 'chalk' | 'slate' | 'oak';
  piecesPerPack: number;
  reserve: number;
  minCut: number;
};
export type LayoutStart = { kind: 'corner' | 'side'; index: number };
export type LayoutConfig = { pattern: Pattern; angle: number; offsetX: number; offsetY: number; start?: LayoutStart };
export type Project = {
  version: 1;
  name: string;
  room: RoomConfig;
  material: MaterialConfig;
  layout: LayoutConfig;
};
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
export type Piece = {
  id: string;
  original: Point[];
  polygons: MultiPolygon;
  area: number;
  cut: boolean;
  width: number;
  height: number;
  minDimension: number;
  angle: number;
};
export type LayoutResult = {
  pieces: Piece[];
  roomPolygon: Point[];
  usablePolygons: MultiPolygon;
  bounds: Bounds;
  roomArea: number;
  usableArea: number;
  coveredArea: number;
  fullCount: number;
  cutCount: number;
  wasteArea: number;
  wastePercent: number;
  neededPieces: number;
  recommendedPieces: number;
  packs: number;
  minCutWidth: number;
  warnings: string[];
  start?: { pieceId: string; point: Point; reference: Point; label: string };
};
export type SavedVariant = { id: string; name: string; project: Project; createdAt: string };
