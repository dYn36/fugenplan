import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { version as pdfVersion } from 'pdfjs-dist/package.json';
import type { FloorPlanDocument, FloorPlanPage } from '../floorplan-types';

export const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_PDF_PAGES = 200;
const MAX_PAGE_SIZE = 10_000_000;
const MAX_EMBEDDED_IMAGE_PIXELS = 64_000_000;
export const MAX_PREVIEW_PIXELS = 16_000_000;

class PdfImportError extends Error {}

function validateBytes(bytes: Uint8Array): void {
  if (!(bytes instanceof Uint8Array) || !bytes.byteLength) throw new PdfImportError('Die PDF-Datei ist leer.');
  if (bytes.byteLength > MAX_PDF_BYTES) throw new PdfImportError('Die PDF-Datei darf höchstens 20 MiB groß sein.');
  // PDF.js also accepts a PDF header within the first 1,024 bytes.
  const header = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  if (!/%PDF-\d\.\d/.test(header)) throw new PdfImportError('Die Datei hat keinen gültigen PDF-Kopf. Wähle eine PDF-Datei.');
}

function pdfError(error: unknown): Error {
  if (error instanceof PdfImportError) return error;
  const name = error instanceof Error ? error.name : '';
  if (name === 'PasswordException') return new Error('Diese PDF-Datei ist verschlüsselt. Speichere eine unverschlüsselte Kopie und öffne sie erneut.');
  if (['InvalidPDFException', 'FormatError', 'UnknownErrorException'].includes(name)) {
    return new Error('Die PDF-Datei ist beschädigt oder unvollständig. Speichere eine neue PDF-Kopie und öffne sie erneut.');
  }
  return new Error('Die PDF-Datei konnte nicht gelesen werden. Prüfe die Datei und öffne sie erneut.');
}

function assetUrl(folder: string): string {
  return new URL(`${import.meta.env.BASE_URL}pdfjs/${pdfVersion}/${folder}/`, document.baseURI).href;
}

/** The caller must call pdf.loadingTask.destroy() when its preview is no longer needed. */
export async function openPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  validateBytes(bytes);
  let task: PDFDocumentLoadingTask | undefined;
  let pdf: PDFDocumentProxy | undefined;
  try {
    // Load the renderer only when a PDF is opened. No PDF content is sent to a URL.
    const { getDocument, GlobalWorkerOptions, VerbosityLevel } = await import('pdfjs-dist');
    GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    task = getDocument({
      // PDF.js transfers this buffer to its worker. Retain the caller's original bytes.
      data: new Uint8Array(bytes),
      cMapUrl: assetUrl('cmaps'), cMapPacked: true,
      standardFontDataUrl: assetUrl('standard_fonts'),
      wasmUrl: assetUrl('wasm'), iccUrl: assetUrl('iccs'),
      useWorkerFetch: true, useSystemFonts: false,
      enableXfa: false, stopAtErrors: true,
      maxImageSize: MAX_EMBEDDED_IMAGE_PIXELS,
      canvasMaxAreaInBytes: MAX_PREVIEW_PIXELS * 4,
      disableRange: true, disableStream: true, disableAutoFetch: true,
      verbosity: VerbosityLevel.ERRORS,
    });
    pdf = await task.promise;
    if (!Number.isInteger(pdf.numPages) || pdf.numPages < 1) throw new PdfImportError('Die PDF-Datei enthält keine gültigen Seiten.');
    if (pdf.numPages > MAX_PDF_PAGES) throw new PdfImportError('Die PDF-Datei darf höchstens 200 Seiten enthalten.');
    const metadata = await pdf.getMetadata();
    const info = metadata.info as { EncryptFilterName?: unknown };
    // Also reject documents encrypted with an empty user password.
    if (info.EncryptFilterName != null) {
      throw new PdfImportError('Diese PDF-Datei ist verschlüsselt. Speichere eine unverschlüsselte Kopie und öffne sie erneut.');
    }
    return pdf;
  } catch (error) {
    try { if (pdf) await pdf.loadingTask.destroy(); else if (task) await task.destroy(); } catch { /* Keep the original import error. */ }
    throw pdfError(error);
  }
}

export async function preparePdf(bytes: Uint8Array, name: string): Promise<FloorPlanDocument> {
  validateBytes(bytes);
  if (typeof name !== 'string' || name.length > 255) throw new PdfImportError('Der PDF-Dateiname darf höchstens 255 Zeichen haben.');
  if (!globalThis.crypto?.subtle) throw new PdfImportError('Der Browser unterstützt die lokale PDF-Prüfung nicht. Öffne Fugenplan über localhost oder HTTPS.');
  const owned = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest('SHA-256', owned.buffer);
  const id = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const pdf = await openPdf(owned);
  try {
    const pages: FloorPlanPage[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)
        || viewport.width < 0.001 || viewport.height < 0.001 || viewport.width > MAX_PAGE_SIZE || viewport.height > MAX_PAGE_SIZE) {
        throw new PdfImportError(`Seite ${number} hat ungültige Abmessungen. Speichere die Seite als neue PDF-Datei.`);
      }
      pages.push({ number, width: viewport.width, height: viewport.height, rotation: viewport.rotation, calibration: null });
      page.cleanup();
    }
    return { id, name: name.trim() || 'Grundriss.pdf', pageCount: pages.length, activePage: 1, pages };
  } catch (error) {
    throw pdfError(error);
  } finally {
    await pdf.loadingTask.destroy();
  }
}
