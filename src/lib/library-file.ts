import type { BuildingFile, BuildingProject, FloorPlanDocument } from '../floorplan-types';
import { validateRoom } from './geometry';
import { createLibrary, parseBuilding } from './library';
import { MAX_PDF_BYTES, preparePdf } from './pdf';
import { decodePdf, encodePdf, readProjectFile } from './workspace-file';

export const MAX_BUILDING_BYTES = 128 * 1024 * 1024;
export const MAX_EMBEDDED_PDF_BYTES = 80 * 1024 * 1024;
export type BuildingAsset = { id: string; bytes: Uint8Array };

function validateRooms(building: BuildingProject): void {
  for (const floor of building.floors) for (const room of floor.workspace.rooms) {
    const errors = validateRoom(room.project.room);
    if (errors.length) throw new Error(`${floor.name} / ${room.project.name}: ${errors.join(' ')} Korrigiere den Raum vor dem Export.`);
  }
}
function documents(building: BuildingProject): FloorPlanDocument[] {
  return building.floors.flatMap(floor => floor.workspace.floorPlan ? [floor.workspace.floorPlan] : []);
}
function samePdf(actual: FloorPlanDocument, saved: FloorPlanDocument): boolean {
  return actual.id === saved.id && actual.pageCount === saved.pageCount && actual.pages.every((page, index) =>
    page.width === saved.pages[index].width && page.height === saved.pages[index].height && page.rotation === saved.pages[index].rotation);
}

/** All referenced original PDFs are included exactly once, also for currently empty floors. */
export function writeBuildingFile(input: BuildingProject, assets: Record<string, Uint8Array>): string {
  const building = parseBuilding(input);
  validateRooms(building);
  const unique = [...new Set(documents(building).map(document => document.id))];
  let totalBytes = 0;
  const embedded = unique.map(id => {
    const bytes = Object.hasOwn(assets, id) ? assets[id] : undefined;
    if (!(bytes instanceof Uint8Array) || !bytes.length) throw new Error('Eine Original-PDF fehlt. Öffne dieselbe Datei in der betroffenen Etage erneut, bevor du das Projekt sicherst.');
    if (bytes.byteLength > MAX_PDF_BYTES) throw new Error('Eine PDF darf höchstens 20 MiB groß sein.');
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_EMBEDDED_PDF_BYTES) throw new Error('Die PDFs eines Projekts dürfen zusammen höchstens 80 MiB groß sein.');
    return { id, pdfBase64: encodePdf(bytes) };
  });
  const file: BuildingFile = { format: 'fugenplan', version: 3, building, assets: embedded };
  const json = JSON.stringify(file, null, 2);
  if (new TextEncoder().encode(json).byteLength > MAX_BUILDING_BYTES) throw new Error('Die Projektdatei darf höchstens 128 MiB groß sein.');
  return json;
}

export async function readBuildingFile(value: unknown): Promise<{ building: BuildingProject; assets: BuildingAsset[] }> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Die Projektdatei enthält ungültige Daten.');
  const file = value as Record<string, unknown>;
  if (file.version === 1 || file.version === 2) {
    const legacy = await readProjectFile(value);
    return { building: createLibrary(legacy.workspace).projects[0], assets: legacy.workspace.floorPlan && legacy.pdfBytes ? [{ id: legacy.workspace.floorPlan.id, bytes: legacy.pdfBytes }] : [] };
  }
  if (file.format !== 'fugenplan' || file.version !== 3) throw new Error('Diese Projektversion wird nicht unterstützt.');
  const building = parseBuilding(file.building);
  validateRooms(building);
  const savedDocuments = documents(building);
  const required = new Set(savedDocuments.map(document => document.id));
  if (!Array.isArray(file.assets) || file.assets.length !== required.size) throw new Error('Die eingebetteten PDFs sind unvollständig oder mehrfach enthalten.');
  const assets: BuildingAsset[] = [];
  let totalBytes = 0;
  for (const value of file.assets) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Die eingebettete PDF enthält ungültige Daten.');
    const asset = value as Record<string, unknown>;
    if (typeof asset.id !== 'string' || !/^[a-f0-9]{64}$/.test(asset.id) || !required.delete(asset.id)) throw new Error('Eine eingebettete PDF ist nicht zugeordnet oder mehrfach enthalten.');
    const bytes = decodePdf(asset.pdfBase64);
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_EMBEDDED_PDF_BYTES) throw new Error('Die PDFs eines Projekts dürfen zusammen höchstens 80 MiB groß sein.');
    assets.push({ id: asset.id, bytes });
  }
  // Decode and validate every asset before callers store any of them.
  for (const asset of assets) {
    const matching = savedDocuments.filter(document => document.id === asset.id);
    const actual = await preparePdf(asset.bytes, matching[0].name);
    if (!matching.every(saved => samePdf(actual, saved))) throw new Error('Eine eingebettete PDF passt nicht zu den gespeicherten Etagen.');
  }
  return { building, assets };
}
