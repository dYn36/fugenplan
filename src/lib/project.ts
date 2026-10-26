import type { Project, RoomConfig, SavedVariant } from '../types';
import { roomVertexCount } from './layout-start';

export const STORAGE_KEY = 'fugenplan.project.v1';
export const VARIANTS_KEY = 'fugenplan.variants.v1';
export const RECOVERED_START_NOTICE = 'Eine nicht mehr vorhandene Startposition wurde zurückgesetzt. Deine Räume und Maße sind erhalten.';
// Only browser storage uses recovery. Imported files remain strictly validated.
export type ProjectParseOptions = { recoverStaleStart?: () => void };
export const DEFAULT_PROJECT: Project = {
  version: 1,
  name: 'Wohnzimmer',
  room: { shape: 'rectangle', width: 4200, height: 3600, notchWidth: 1400, notchHeight: 1200,
    points: [{x:0,y:0},{x:4200,y:0},{x:4200,y:3600},{x:0,y:3600}], obstacles: [] },
  material: { kind: 'tile', width: 600, height: 300, grout: 3, edgeGap: 5, color: 'limestone', piecesPerPack: 8, reserve: 10, minCut: 50 },
  layout: { pattern: 'third', angle: 0, offsetX: 0, offsetY: 0 },
};

const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Die Projektdatei enthält ungültige Daten.');
  return v as Record<string, unknown>;
};
const number = (v: unknown, min: number, max: number, field: string): number => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new Error(`${field}: Wert außerhalb des gültigen Bereichs.`);
  return v;
};
const choice = <T extends string>(v: unknown, options: readonly T[], field: string): T => {
  if (typeof v !== 'string' || !options.includes(v as T)) throw new Error(`${field}: Auswahl ist ungültig.`);
  return v as T;
};

/** Retain a start only while the edited room has the same vertex indexing. */
export function updateRoom(project: Project, next: Partial<RoomConfig>): Project {
  const room = { ...project.room, ...next };
  const count = roomVertexCount(room);
  const topologyChanged = room.shape !== project.room.shape
    || room.points.length !== project.room.points.length
    || count !== roomVertexCount(project.room);
  const { start, ...layout } = project.layout;
  const resetStart = start && (topologyChanged || !Number.isInteger(start.index) || start.index < 0 || start.index >= count);
  return { ...project, room, layout: resetStart ? { ...layout, offsetX: 0, offsetY: 0 } : project.layout };
}

/** Rebuild a bounded, known schema. Never merge an imported object into state. */
export function parseProject(input: unknown, options: ProjectParseOptions = {}): Project {
  const p = record(input);
  if (p.version !== 1) throw new Error('Diese Projektversion wird nicht unterstützt.');
  if (typeof p.name !== 'string' || p.name.length > 100) throw new Error('Der Projektname darf höchstens 100 Zeichen haben.');
  const r = record(p.room), m = record(p.material), l = record(p.layout);
  if (!Number.isInteger(m.piecesPerPack)) throw new Error('Packungsinhalt: Bitte eine ganze Zahl eingeben.');
  if (!Array.isArray(r.points) || r.points.length < 3 || r.points.length > 32) throw new Error('Die Raumkontur braucht 3 bis 32 Punkte.');
  if (!Array.isArray(r.obstacles) || r.obstacles.length > 24) throw new Error('Höchstens 24 Hindernisse sind möglich.');
  const project: Project = {
    version: 1, name: p.name.trim() || 'Mein Raum',
    room: {
      shape: choice(r.shape, ['rectangle','l-shape','custom'], 'Raumform'),
      width: number(r.width, 100, 50000, 'Raumbreite'), height: number(r.height, 100, 50000, 'Raumtiefe'),
      notchWidth: number(r.notchWidth, 1, 50000, 'Aussparung'), notchHeight: number(r.notchHeight, 1, 50000, 'Aussparung'),
      points: r.points.map(v => { const q = record(v); return {x:number(q.x,-50000,50000,'Punkt X'),y:number(q.y,-50000,50000,'Punkt Y')}; }),
      obstacles: r.obstacles.map((v, i) => { const o=record(v); return {id:`obstacle-${i}`, x:number(o.x,-50000,50000,'Hindernis X'), y:number(o.y,-50000,50000,'Hindernis Y'), width:number(o.width,1,50000,'Hindernisbreite'),height:number(o.height,1,50000,'Hindernistiefe')}; }),
    },
    material: {
      kind: choice(m.kind,['tile','wood'],'Belag'), color:choice(m.color,['limestone','chalk','slate','oak'],'Farbe'),
      width:number(m.width,10,5000,'Produktlänge'), height:number(m.height,10,5000,'Produktbreite'),
      grout:number(m.grout,0,50,'Fuge'), edgeGap:number(m.edgeGap,0,100,'Randabstand'),
      piecesPerPack:number(m.piecesPerPack,1,1000,'Packungsinhalt'), reserve:number(m.reserve,0,100,'Reserve'), minCut:number(m.minCut,0,1000,'Mindestzuschnitt'),
    },
    layout: {pattern:choice(l.pattern,['grid','half','third','quarter','random','diagonal','herringbone'],'Muster'), angle:number(l.angle,-360,360,'Winkel'),offsetX:number(l.offsetX,-50000,50000,'Versatz X'),offsetY:number(l.offsetY,-50000,50000,'Versatz Y')},
  };
  if (l.start !== undefined) {
    const start = record(l.start);
    const kind = choice(start.kind, ['corner', 'side'], 'Startposition');
    const index = number(start.index, 0, 31, 'Startecke oder Startwand');
    if (!Number.isInteger(index)) throw new Error('Die Startposition muss eine vorhandene Ecke oder Wand sein.');
    if (index >= roomVertexCount(project.room)) {
      if (!options.recoverStaleStart) throw new Error('Startecke oder Startwand: Wert außerhalb des gültigen Bereichs.');
      project.layout.offsetX = 0;
      project.layout.offsetY = 0;
      options.recoverStaleStart();
    } else {
      project.layout.start = { kind, index };
    }
  }
  return project;
}

/** Compare schema values, because loading a project can change object key order. */
export function isUnchangedExampleProject(project: Project): boolean {
  if (project.name !== DEFAULT_PROJECT.name) return false;
  try {
    return JSON.stringify(parseProject(project)) === JSON.stringify(parseProject(DEFAULT_PROJECT));
  } catch {
    return false;
  }
}

export function loadProject(): {project:Project; error:string | null; warning?:string} {
  try {
    const saved=localStorage.getItem(STORAGE_KEY);
    let recovered=false;
    const project=saved ? parseProject(JSON.parse(saved),{recoverStaleStart:()=>{recovered=true;}}) : structuredClone(DEFAULT_PROJECT);
    return {project,error:null,...(recovered?{warning:RECOVERED_START_NOTICE}:{})};
  }
  catch { return {project:structuredClone(DEFAULT_PROJECT),error:'Der gespeicherte Plan konnte nicht geladen werden. Eine neue Eingabe speichert den aktuellen Plan.'}; }
}
export function loadVariants(): SavedVariant[] {
  try {
    const raw: unknown=JSON.parse(localStorage.getItem(VARIANTS_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.slice(0,12).flatMap((v,i)=>{try {const s=record(v);return [{id:`saved-${i}`,name:typeof s.name==='string'?s.name.slice(0,100):`Variante ${i+1}`,project:parseProject(s.project),createdAt:typeof s.createdAt==='string'?s.createdAt:''}];} catch {return [];}});
  } catch { return []; }
}
export function downloadFile(content:string, filename:string, type:string) {
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement('a'); a.href=url; a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export const filename = (name:string) => name.replace(/[^\p{L}\p{N}_-]+/gu,'-').replace(/^-|-$/g,'') || 'Fugenplan';
export const formatNumber = (v:number, digits=1) => new Intl.NumberFormat('de-DE',{maximumFractionDigits:digits}).format(v);
export const formatArea = (v:number) => `${formatNumber(v/1e6,2)} m²`;
export const PATTERN_NAMES = { grid:'Kreuzverband', half:'Halbverband', third:'Drittelverband', quarter:'Viertelverband',random:'Wilder Verband',diagonal:'Diagonalverband',herringbone:'Fischgrät' };
export const MATERIAL_COLORS = {
  limestone: ['#d6d5c8','#d2d1c3','#dbdace','#d8d7ca'],
  chalk: ['#edece6','#e6e6e0','#e9e9e3','#e1e2dc'],
  slate: ['#6d7776','#75807d','#707b78','#7b8481'],
  oak: ['#c8aa7e','#c4a276','#ceb28a','#bc9b6f'],
};
