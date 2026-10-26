import type { Workspace, WorkspaceFile } from '../floorplan-types';
import { validateRoom } from './geometry';
import { MAX_PDF_BYTES, preparePdf } from './pdf';
import { parseProject } from './project';
import { createWorkspace, parseWorkspace } from './workspace';

export const MAX_PROJECT_BYTES = 40 * 1024 * 1024;

export function encodePdf(bytes: Uint8Array): string {
  if (bytes.length > MAX_PDF_BYTES) throw new Error('Die PDF darf höchstens 20 MB groß sein.');
  const chunks: string[] = [];
  for (let start = 0; start < bytes.length; start += 8192) chunks.push(String.fromCharCode(...bytes.subarray(start, start + 8192)));
  return btoa(chunks.join(''));
}

export function decodePdf(value: unknown): Uint8Array {
  if (typeof value !== 'string' || !value.length || value.length > Math.ceil(MAX_PDF_BYTES / 3) * 4
      || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('Die eingebettete PDF ist ungültig oder größer als 20 MB.');
  let binary: string;
  try { binary = atob(value); } catch { throw new Error('Die eingebettete PDF ist beschädigt.'); }
  if (binary.length > MAX_PDF_BYTES) throw new Error('Die PDF darf höchstens 20 MB groß sein.');
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

export async function readProjectFile(value: unknown): Promise<{ workspace: Workspace; pdfBytes: Uint8Array | null }> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Die Projektdatei enthält ungültige Daten.');
  const file = value as Record<string, unknown>;
  if (file.version === 1) return { workspace: createWorkspace(parseProject(file)), pdfBytes: null };
  if (file.version !== 2 || file.format !== 'fugenplan') throw new Error('Diese Projektversion wird nicht unterstützt.');
  const workspace = parseWorkspace(file.workspace);
  for (const room of workspace.rooms) {
    const errors = validateRoom(room.project.room);
    if (errors.length) throw new Error(`${room.project.name}: ${errors.join(' ')}`);
  }
  if (!workspace.floorPlan) {
    if (file.pdfBase64 !== undefined) throw new Error('Für die eingebettete PDF fehlen die Seitendaten.');
    return { workspace, pdfBytes: null };
  }
  const pdfBytes = decodePdf(file.pdfBase64);
  const actual = await preparePdf(pdfBytes, workspace.floorPlan.name);
  const saved = workspace.floorPlan;
  if (actual.id !== saved.id || actual.pageCount !== saved.pageCount || actual.pages.some((page, i) =>
    page.width !== saved.pages[i].width || page.height !== saved.pages[i].height || page.rotation !== saved.pages[i].rotation)) {
    throw new Error('Die eingebettete PDF passt nicht zu den gespeicherten Räumen.');
  }
  return { workspace, pdfBytes };
}

export function writeProjectFile(workspace: Workspace, pdfBytes: Uint8Array | null): string {
  parseWorkspace(workspace);
  for (const room of workspace.rooms) {
    const errors = validateRoom(room.project.room);
    if (errors.length) throw new Error(`${room.project.name}: ${errors.join(' ')} Korrigiere den Raum vor dem Export.`);
  }
  if (!workspace.floorPlan && workspace.rooms.length === 1) return JSON.stringify(workspace.rooms[0].project, null, 2);
  const file: WorkspaceFile = { format: 'fugenplan', version: 2, workspace };
  if (workspace.floorPlan) {
    if (!pdfBytes) throw new Error('Die PDF fehlt im Browserspeicher. Öffne unter „Grundriss“ dieselbe PDF erneut. Danach kannst du das vollständige Projekt sichern.');
    file.pdfBase64 = encodePdf(pdfBytes);
  }
  return JSON.stringify(file, null, 2);
}
